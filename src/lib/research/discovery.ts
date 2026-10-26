import "server-only";

import { createHash } from "node:crypto";
import { fetchOfficialPage } from "@/lib/research/agent";
import { createResearchAdminClient } from "@/lib/research/server";

const DISCOVERY_INTERVAL_DAYS = 1;
const SEARCH_CONCURRENCY = 3;

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

type DiscoveryCategory = "hysa" | "savings_bonus" | "checking_bonus" | "debit_spend" | "credit_card_bonus";

type SearchHit = {
  query: string;
  category: DiscoveryCategory;
  title: string;
  url: string;
  description: string;
  rank: number;
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
};

const SOURCES: { institution: string; url: string; category: DiscoveryCategory }[] = [
  { institution: "American Express", url: "https://www.americanexpress.com/en-us/banking/online-savings/high-yield-savings-account/", category: "hysa" },
  { institution: "Synchrony Bank", url: "https://www.synchrony.com/banking/products/high-yield-savings", category: "hysa" },
  { institution: "Capital One", url: "https://www.capitalone.com/bank/savings-accounts/online-performance-savings-account/", category: "hysa" },
];

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

function canonicalizeUrl(raw: string) {
  try {
    const url = new URL(raw);
    url.hash = "";
    for (const key of Array.from(url.searchParams.keys())) {
      if (/^(utm_|gclid|fbclid|ref|source|campaign|ef_id)/i.test(key)) url.searchParams.delete(key);
    }
    url.hostname = url.hostname.toLowerCase().replace(/^www\./, "");
    url.pathname = url.pathname.replace(/\/+$/, "") || "/";
    return url.toString();
  } catch {
    return raw.trim();
  }
}

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
  const title = hit.title.replace(/\s+[|–—-]\s+.*$/, "").trim();
  if (title && title.length <= 70) return title;
  const domain = hostnameFor(hit.url).split(".")[0] || "";
  return domain ? domain.replace(/[-_]/g, " ").replace(/\b\w/g, (char) => char.toUpperCase()) : null;
}

function guessProductName(hit: SearchHit) {
  return hit.title.slice(0, 180) || null;
}

function candidateKey(category: DiscoveryCategory, rawUrl: string) {
  return createHash("sha256").update(`${category}|${canonicalizeUrl(rawUrl)}`).digest("hex");
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

async function checkSource(source: typeof SOURCES[number]) {
  const page = await fetchOfficialPage(source.url);
  if (page.fetchStatus !== "ok") return { hits: [] as SearchHit[], error: `${source.institution}: ${page.fetchStatus}` };
  const signal = /apy|annual percentage yield|bonus|cash back|direct deposit/i.exec(page.normalizedText);
  if (!signal) return { hits: [] as SearchHit[], error: `${source.institution}: no offer terms found` };
  return { error: null, hits: [{
    query: `Official page: ${source.institution}`,
    category: source.category,
    title: page.pageTitle || source.institution,
    url: source.url,
    description: page.normalizedText.slice(Math.max(0, signal.index - 100), signal.index + 1100),
    rank: 1,
  }] };
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
  return opportunities.find((opportunity) => canonicalizeUrl(opportunity.official_url) === candidateUrl) || null;
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
    const batches = await mapWithConcurrency(SOURCES, SEARCH_CONCURRENCY, checkSource);
    const failures = batches.flatMap((batch) => batch.error ? [batch.error] : []);
    if (failures.length === SOURCES.length) throw new Error(failures.join("; "));
    const rawHits = batches.flatMap((batch) => batch.hits);
    const dedupedHits: SearchHit[] = [];
    const seenKeys = new Set<string>();
    for (const hit of rawHits) {
      const key = candidateKey(hit.category, hit.url);
      if (seenKeys.has(key)) continue;
      seenKeys.add(key);
      dedupedHits.push(hit);
    }

    const keys = dedupedHits.map((hit) => candidateKey(hit.category, hit.url));
    const [{ data: existingRows, error: existingError }, { data: opportunities, error: opportunityError }] = await Promise.all([
      keys.length
        ? supabase.from("discovery_candidates").select("id,candidate_key,candidate_status,official_source_status,official_url,first_discovered_at,created_at").in("candidate_key", keys)
        : Promise.resolve({ data: [], error: null }),
      supabase.from("opportunities").select("id,institution,product_name,official_url").eq("offer_status", "live"),
    ]);
    if (existingError) throw existingError;
    if (opportunityError) throw opportunityError;

    const existingMap = new Map(((existingRows || []) as ExistingCandidate[]).map((row) => [row.candidate_key, row]));
    const knownOpportunities = (opportunities || []) as ExistingOpportunity[];
    const now = new Date().toISOString();

    const candidateRows = dedupedHits.map((hit) => {
      const key = candidateKey(hit.category, hit.url);
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
      const key = candidateKey(hit.category, hit.url);
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
      error_message: failures.length ? `Partial coverage: ${failures.join("; ")}` : null,
      completed_at: now,
      queries_count: SOURCES.length,
      results_count: dedupedHits.length,
      new_candidates: newCandidates,
      duplicate_candidates: duplicateCandidates,
    }).eq("id", runId);
    if (completeError) throw completeError;

    return {
      runId,
      status: "completed",
      queriesCount: SOURCES.length,
      resultsCount: dedupedHits.length,
      newCandidates,
      duplicateCandidates,
      nextEligibleAt: new Date(Date.now() + DISCOVERY_INTERVAL_DAYS * 86_400_000).toISOString(),
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
