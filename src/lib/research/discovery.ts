import "server-only";

import { createHash } from "node:crypto";
import { fetchOfficialPage } from "@/lib/research/agent";
import { createResearchAdminClient } from "@/lib/research/server";
import { parseBankAccountRss } from "./doctor-of-credit";
import { distinctAdvertisedBonusAmounts, extractExplicitBonusVariants } from "./offer-variants";

import { canonicalizeUrl, categorizeLinkedSource, isDiscoveryCategory, offerSignal, SEED_SOURCES, uniqueSources, type DiscoveryCategory, type DiscoverySource } from "./discovery-core";

const DISCOVERY_INTERVAL_DAYS = 1;
const SEARCH_CONCURRENCY = 3;
const MAX_LINKED_PAGES = 18;

export type DiscoveryTrigger = "manual" | "cron";
export type DiscoveryStatus = "completed" | "failed" | "skipped" | "already_running";

export type DiscoveryRunResult = {
  runId: string | null;
  status: DiscoveryStatus;
  queriesCount: number;
  resultsCount: number;
  newCandidates: number;
  duplicateCandidates: number;
  message?: string;
  nextEligibleAt?: string | null;
};

type SearchHit = {
  query: string;
  category: DiscoveryCategory;
  title: string;
  url: string;
  description: string;
  rank: number;
  institution: string;
  offerKey?: string;
  bonusAmount?: number;
  productHint?: string;
};

type ExistingCandidate = {
  id: string;
  candidate_key: string;
  candidate_status: string;
  official_source_status: string;
  official_url: string | null;
  first_discovered_at: string;
  created_at: string;
};

type ExistingOpportunity = {
  id: string;
  institution: string;
  product_name: string;
  official_url: string;
  category: string;
  bonus_amount: number | string | null;
};

const NON_OFFICIAL_DOMAINS = [
  "bankrate.com",
  "nerdwallet.com",
  "doctorofcredit.com",
  "thepointsguy.com",
  "forbes.com",
  "investopedia.com",
  "reddit.com",
  "slickdeals.net",
  "wallethub.com",
  "depositaccounts.com",
  "finder.com",
  "youtube.com",
  "facebook.com",
  "instagram.com",
  "x.com",
  "twitter.com",
  "tiktok.com",
];

// Direct official-page checks never call a paid search provider.
export function hasDiscoverySearchConfig() { return true; }

function hostnameFor(raw: string) {
  try {
    return new URL(raw).hostname.toLowerCase().replace(/^www\./, "");
  } catch {
    return "";
  }
}

function isNonOfficialDomain(domain: string) {
  return NON_OFFICIAL_DOMAINS.some((blocked) => domain === blocked || domain.endsWith(`.${blocked}`));
}

function possibleOfficialSource(hit: SearchHit) {
  const domain = hostnameFor(hit.url);
  if (!domain || isNonOfficialDomain(domain)) return false;
  const text = `${hit.title} ${hit.description} ${domain}`.toLowerCase();
  return /\bbank\b|credit union|\bfcu\b|\bcu\b|financial|capital one|chase|citi|discover|american express|sofi|marcus|cit/.test(text);
}

function guessInstitution(hit: SearchHit) {
  if (hit.institution) return hit.institution;
  const title = hit.title.replace(/\s+[|–—-]\s+.*$/, "").trim();
  if (title && title.length <= 70) return title;
  const domain = hostnameFor(hit.url).split(".")[0] || "";
  return domain ? domain.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : null;
}

function guessProductName(hit: SearchHit) {
  return hit.title.slice(0, 180) || null;
}

function candidateKey(category: DiscoveryCategory, rawUrl: string, offerKey?: string) {
  const originalKey = `${category}|${canonicalizeUrl(rawUrl)}`;
  return createHash("sha256").update(offerKey ? `${originalKey}|${offerKey}` : originalKey).digest("hex");
}

const discoveryDurationWords: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

function detectBenefitDuration(hit: SearchHit) {
  const text = `${hit.title} ${hit.description}`;
  const trigger = /promo(?:tional)?|\bboost\b|introductory|limited[- ]time|special\s+(?:apy|rate)|reward\s+period|bonus\s+period|rate\s+boost/i;
  const triggerMatch = trigger.exec(text);
  if (!triggerMatch || triggerMatch.index === undefined) return { days: null as number | null, text: null as string | null };

  const start = Math.max(0, triggerMatch.index - 100);
  const end = Math.min(text.length, triggerMatch.index + triggerMatch[0].length + 220);
  const chunk = text.slice(start, end);
  const duration = /\b(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(day|week|month|year)s?\b/i.exec(chunk);
  if (!duration) return { days: null as number | null, text: chunk.slice(0, 280) };

  const rawCount = duration[1].toLowerCase();
  const count = discoveryDurationWords[rawCount] || Number(rawCount);
  const unit = duration[2].toLowerCase();
  if (!Number.isFinite(count) || count <= 0) return { days: null as number | null, text: duration[0] };

  const days = unit === "day" ? count
    : unit === "week" ? count * 7
      : unit === "month" ? Math.round(count * 30.4375)
        : count * 365;
  return { days: Math.round(days), text: duration[0] };
}

async function checkSource(source: DiscoverySource, cache: Map<string, ReturnType<typeof fetchOfficialPage>>) {
  // Shared pages for multiple categories are fetched once per sweep.
  if (!cache.has(source.url)) cache.set(source.url, fetchOfficialPage(source.url));
  const page = await cache.get(source.url)!;
  const links = page.fetchStatus === "ok" ? (page.offerLinks || []) : [];
  if (page.fetchStatus !== "ok") return { hits: [] as SearchHit[], links, source, error: `${source.institution}: ${page.fetchStatus}` };
  // One official landing page can list several independently qualifying
  // consumer promotions. Record each *explicitly labeled* bonus as a distinct
  // private candidate, but never infer eligibility or automatically publish.
  if (source.category === "checking_bonus" || source.category === "savings_bonus") {
    const variants = extractExplicitBonusVariants(page.normalizedText, source.category);
    // A mixed bank landing page might mention one checking bonus and one
    // savings bonus. Still create the product-specific private candidate.
    const mentions = distinctAdvertisedBonusAmounts(page.normalizedText);
    if (variants.length >= 2 || (variants.length >= 1 && mentions.length >= 2)) {
      return { error: null, links, source, hits: variants.map((variant, index) => ({
        query: "Official page: " + source.institution,
        institution: source.institution,
        category: source.category,
        title: source.institution + " · " + variant.product + " — $" + variant.amount + " bonus (terms pending)",
        url: page.finalUrl || source.url,
        description: variant.excerpt,
        rank: index + 1,
        offerKey: variant.key,
        bonusAmount: variant.amount,
        productHint: variant.product,
      })) };
    }
  }
  const signal = offerSignal(page.normalizedText, source.category);
  if (!signal) return { hits: [] as SearchHit[], links, source, error: `${source.institution} (${source.category}): no matching offer terms found` };
  return { error: null, links, source, hits: [{
    query: `Official page: ${source.institution}`,
    institution: source.institution,
    category: source.category,
    title: page.pageTitle || source.institution,
    url: page.finalUrl || source.url,
    description: page.normalizedText.slice(Math.max(0, signal.index - 100), signal.index + 1100),
    rank: 1,
  }] };
}

// Doctor of Credit is a third-party lead feed, never proof of official terms.
// Only a headline, category and article URL enter the private review queue.
const DOC_BANK_RSS = "https://www.doctorofcredit.com/category/bank-account-bonuses/feed/";

async function readDoctorOfCreditLeads(): Promise<{ hits: SearchHit[]; error: string | null }> {
  try {
    let url = DOC_BANK_RSS;
    let response: Response | null = null;
    for (let redirect = 0; redirect < 3; redirect += 1) {
      response = await fetch(url, {
        cache: "no-store",
        redirect: "manual",
        headers: { accept: "application/rss+xml,application/xml,text/xml" },
        signal: AbortSignal.timeout(10_000),
      });
      if (response.status >= 300 && response.status < 400) {
        const location = response.headers.get("location");
        if (!location) throw new Error("RSS redirected without a destination");
        const next = new URL(location, url);
        if (next.protocol !== "https:" ||
            !["www.doctorofcredit.com", "doctorofcredit.com"].includes(next.hostname.toLowerCase()) ||
            next.pathname !== "/category/bank-account-bonuses/feed/") {
          throw new Error("RSS redirect was not to the official Doctor of Credit feed");
        }
        url = next.toString();
        continue;
      }
      break;
    }
    if (!response?.ok) throw new Error("RSS returned HTTP " + String(response?.status ?? "unknown"));
    const length = Number(response.headers.get("content-length") || 0);
    if (length > 3_000_000) throw new Error("RSS too large");
    const xml = await response.text();
    if (xml.length > 3_000_000 || !/<rss\b|<feed\b/i.test(xml)) throw new Error("RSS missing or too large");
    const leads = parseBankAccountRss(xml, 30);
    return {
      hits: leads.map((lead, rank) => ({
        query: "Doctor of Credit bank-account RSS",
        institution: lead.institution,
        category: lead.category,
        title: lead.title,
        url: lead.articleUrl,
        // Intentionally do not store or republish article descriptions or text.
        description: "Third-party discovery lead from Doctor of Credit. Verify exact bank terms and official enrollment URL before publishing.",
        rank: rank + 1,
      })),
      error: null,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return { hits: [], error: "Doctor of Credit RSS unavailable: " + message };
  }
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const output = new Array<R>(items.length);
  let index = 0;
  async function worker() {
    while (true) {
      const current = index++;
      if (current >= items.length) return;
      output[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return output;
}

async function latestCompletedRun() {
  const supabase = createResearchAdminClient();
  const { data } = await supabase
    .from("discovery_runs")
    .select("id,started_at,completed_at")
    .eq("status", "completed")
    .order("completed_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  return data as { id: string; started_at: string; completed_at: string | null } | null;
}

function nextEligibleAtFrom(run: { completed_at: string | null } | null) {
  if (!run?.completed_at) return null;
  return new Date(Date.parse(run.completed_at.slice(0, 10) + "T00:00:00.000Z") + DISCOVERY_INTERVAL_DAYS * 86_400_000).toISOString();
}

async function runningDiscovery() {
  const supabase = createResearchAdminClient();
  const twentyMinutesAgo = new Date(Date.now() - 20 * 60_000).toISOString();
  const { data } = await supabase
    .from("discovery_runs")
    .select("id")
    .eq("status", "running")
    .gte("started_at", twentyMinutesAgo)
    .limit(1)
    .maybeSingle();
  return data as { id: string } | null;
}

function matchesExistingOpportunity(hit: SearchHit, opportunities: ExistingOpportunity[]) {
  const candidateUrl = canonicalizeUrl(hit.url);
  return opportunities.find((opportunity) => {
    if (opportunity.category !== hit.category || canonicalizeUrl(opportunity.official_url) !== candidateUrl) return false;
    if (hit.offerKey) {
      const amountMatches = Number(opportunity.bonus_amount) === hit.bonusAmount;
      const productMatches = Boolean(hit.productHint && opportunity.product_name.toLowerCase().includes(hit.productHint.toLowerCase()));
      return amountMatches && productMatches;
    }
    return true;
  }) || null;
}

export async function runDiscoverySweep({ triggerType, force = false }: { triggerType: DiscoveryTrigger; force?: boolean }): Promise<DiscoveryRunResult> {
  const supabase = createResearchAdminClient();

  const running = await runningDiscovery();
  if (running) {
    return { runId: running.id, status: "already_running", queriesCount: 0, resultsCount: 0, newCandidates: 0, duplicateCandidates: 0, message: "A discovery sweep is already running." };
  }

  const latest = await latestCompletedRun();
  const nextEligibleAt = nextEligibleAtFrom(latest);
  if (triggerType === "cron" && !force && nextEligibleAt && Date.now() < new Date(nextEligibleAt).getTime()) {
    return { runId: latest?.id || null, status: "skipped", queriesCount: 0, resultsCount: 0, newCandidates: 0, duplicateCandidates: 0, message: "Daily official-page check is not due yet.", nextEligibleAt };
  }

  const { data: run, error: runError } = await supabase.from("discovery_runs").insert({
    trigger_type: triggerType,
    status: "running",
    provider: "official_pages",
  }).select("id").single();
  if (runError || !run) throw runError || new Error("Could not start discovery run.");
  const runId = run.id as string;

  try {
    const { data: opportunities, error: opportunityError } = await supabase
      .from("opportunities").select("id,institution,product_name,official_url,category,bonus_amount").eq("offer_status", "live");
    if (opportunityError) throw opportunityError;
    const knownOpportunities = (opportunities || []) as ExistingOpportunity[];
    const sources = uniqueSources([
      ...SEED_SOURCES,
      ...knownOpportunities.flatMap(row => isDiscoveryCategory(row.category)
        ? [{ institution: row.institution, url: row.official_url, category: row.category }] : []),
    ]);
    const cache = new Map<string, ReturnType<typeof fetchOfficialPage>>();
    const deadline = Date.now() + 200_000;
    const check = (source: DiscoverySource) => Date.now() < deadline
      ? checkSource(source, cache)
      : Promise.resolve({ hits: [] as SearchHit[], links: [] as string[], source, error: `${source.institution}: scan time budget reached` });
    const doctorOfCreditPromise = readDoctorOfCreditLeads();
    const batches = await mapWithConcurrency(sources, SEARCH_CONCURRENCY, check);
    const knownKeys = new Set(sources.map(source => candidateKey(source.category, source.url)));
    const linkedSources = uniqueSources(batches.flatMap(batch => batch.links.flatMap(url => {
      const category = categorizeLinkedSource(batch.source, url);
      return category ? [{ ...batch.source, url, category }] : [];
    })))
      .filter(source => !knownKeys.has(candidateKey(source.category, source.url))).slice(0, MAX_LINKED_PAGES);
    batches.push(...await mapWithConcurrency(linkedSources, SEARCH_CONCURRENCY, check));
    const checkedPages = sources.length + linkedSources.length;
    const officialFailures = batches.flatMap((batch) => batch.error ? [batch.error] : []);
    if (officialFailures.length === checkedPages) throw new Error(officialFailures.join("; "));
    const doctorOfCredit = await doctorOfCreditPromise;
    const failures = doctorOfCredit.error ? [...officialFailures, doctorOfCredit.error] : officialFailures;
    const rawHits = [...batches.flatMap((batch) => batch.hits), ...doctorOfCredit.hits];
    const dedupedHits: SearchHit[] = [];
    const seenKeys = new Set<string>();
    for (const hit of rawHits) {
      const key = candidateKey(hit.category, hit.url, hit.offerKey);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      dedupedHits.push(hit);
    }

    const keys = dedupedHits.map((hit) => candidateKey(hit.category, hit.url, hit.offerKey));
    const { data: existingRows, error: existingError } = keys.length
      ? await supabase.from("discovery_candidates").select("id,candidate_key,candidate_status,official_source_status,official_url,first_discovered_at,created_at").in("candidate_key", keys)
      : { data: [], error: null };
    if (existingError) throw existingError;
    const existingMap = new Map(((existingRows || []) as ExistingCandidate[]).map((row) => [row.candidate_key, row]));
    const now = new Date().toISOString();

    const candidateRows = dedupedHits.map((hit) => {
      const key = candidateKey(hit.category, hit.url, hit.offerKey);
      const existing = existingMap.get(key);
      const matched = matchesExistingOpportunity(hit, knownOpportunities);
      const possibleOfficial = possibleOfficialSource(hit);
      const benefitDuration = detectBenefitDuration(hit);
      const preservedStatus = existing?.candidate_status && !["discovered", "duplicate"].includes(existing.candidate_status)
        ? existing.candidate_status
        : matched ? "duplicate" : "discovered";
      const officialStatus = existing?.official_source_status === "official_confirmed"
        ? "official_confirmed"
        : possibleOfficial ? "possible_official" : "needs_official_source";

      return {
        candidate_key: key,
        institution_guess: guessInstitution(hit),
        product_name_guess: guessProductName(hit),
        category_guess: hit.category,
        source_title: hit.title,
        source_url: canonicalizeUrl(hit.url),
        source_domain: hostnameFor(hit.url),
        source_snippet: hit.description.slice(0, 1200),
        detected_benefit_duration_days: benefitDuration.days,
        detected_benefit_text: benefitDuration.text,
        official_source_status: officialStatus,
        official_url: existing?.official_url || (possibleOfficial ? canonicalizeUrl(hit.url) : null),
        candidate_status: preservedStatus,
        matched_opportunity_id: matched?.id || null,
        first_discovered_at: existing?.first_discovered_at || now,
        last_seen_at: now,
        last_discovery_run_id: runId,
        created_at: existing?.created_at || now,
        updated_at: now,
      };
    });

    let savedCandidates: Array<{ id: string; candidate_key: string }> = [];
    if (candidateRows.length) {
      const { data, error } = await supabase
        .from("discovery_candidates")
        .upsert(candidateRows, { onConflict: "candidate_key" })
        .select("id,candidate_key");
      if (error) throw error;
      savedCandidates = (data || []) as Array<{ id: string; candidate_key: string }>;
    }

    const idMap = new Map(savedCandidates.map((row) => [row.candidate_key, row.id]));
    const sightings = dedupedHits.map((hit) => {
      const key = candidateKey(hit.category, hit.url, hit.offerKey);
      return {
        run_id: runId,
        candidate_id: idMap.get(key),
        source_query: hit.query,
        source_url: canonicalizeUrl(hit.url),
        source_title: hit.title,
        source_snippet: hit.description.slice(0, 1200),
        result_rank: hit.rank,
      };
    }).filter((row): row is typeof row & { candidate_id: string } => Boolean(row.candidate_id));

    if (sightings.length) {
      const { error } = await supabase.from("discovery_sightings").upsert(sightings, { onConflict: "run_id,candidate_id,source_query,source_url", ignoreDuplicates: true });
      if (error) throw error;
    }

    const newCandidates = candidateRows.filter((row) => !existingMap.has(row.candidate_key) && !row.matched_opportunity_id).length;
    const duplicateCandidates = candidateRows.filter((row) => Boolean(row.matched_opportunity_id) || existingMap.has(row.candidate_key)).length;

    const { error: completeError } = await supabase.from("discovery_runs").update({
      status: "completed",
      error_message: failures.length ? `Partial coverage: ${failures.join("; ")}`.slice(0, 2000) : null,
      completed_at: now,
      queries_count: checkedPages,
      results_count: dedupedHits.length,
      new_candidates: newCandidates,
      duplicate_candidates: duplicateCandidates,
    }).eq("id", runId);
    if (completeError) throw completeError;

    return {
      runId,
      status: "completed",
      queriesCount: checkedPages,
      resultsCount: dedupedHits.length,
      newCandidates,
      duplicateCandidates,
      message: failures.length ? `Partial coverage: ${failures.join("; ")}` : undefined,
      nextEligibleAt: nextEligibleAtFrom({ completed_at: now }),
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from("discovery_runs").update({
      status: "failed",
      completed_at: new Date().toISOString(),
      error_message: message.slice(0, 2000),
    }).eq("id", runId);
    return { runId, status: "failed", queriesCount: 0, resultsCount: 0, newCandidates: 0, duplicateCandidates: 0, message };
  }
}
