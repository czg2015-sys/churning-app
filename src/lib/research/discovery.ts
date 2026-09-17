import "server-only";

import { createHash } from "node:crypto";
import { createResearchAdminClient } from "@/lib/research/server";

const SEARCH_TIMEOUT_MS = 10_000;
const DISCOVERY_INTERVAL_DAYS = 14;
const SEARCH_CONCURRENCY = 3;
const RESULTS_PER_QUERY = 20;

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

type SearchPlan = {
  query: string;
  category: DiscoveryCategory;
};

type BraveResult = {
  title?: string;
  url?: string;
  description?: string;
};

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

const SEARCH_PLANS: SearchPlan[] = [
  { category: "hysa", query: '"high yield savings" APY promotion bank' },
  { category: "hysa", query: '"savings account" APY "promo code" bank' },
  { category: "savings_bonus", query: '"savings account bonus" bank "new money"' },
  { category: "savings_bonus", query: 'bank "savings bonus" "new account" cash' },
  { category: "checking_bonus", query: '"checking account bonus" "direct deposit" bank' },
  { category: "checking_bonus", query: '"new checking account bonus" bank direct deposit' },
  { category: "checking_bonus", query: '"credit union checking bonus" "direct deposit"' },
  { category: "checking_bonus", query: 'California "checking bonus" bank credit union' },
  { category: "debit_spend", query: '"debit card bonus" checking purchases bank' },
  { category: "debit_spend", query: '"cash back debit card" checking account' },
  { category: "credit_card_bonus", query: '"credit card welcome bonus" cash back bank' },
  { category: "credit_card_bonus", query: '"credit card welcome offer" cash bonus issuer' },
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

function getDiscoveryApiKey() {
  return (process.env.DISCOVERY_SEARCH_API_KEY || process.env.BRAVE_SEARCH_API_KEY || "").trim();
}

export function hasDiscoverySearchConfig() {
  return Boolean(getDiscoveryApiKey());
}

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

function likelyOfferResult(hit: SearchHit) {
  const text = `${hit.title} ${hit.description}`.toLowerCase();
  if (!/^https:\/\//i.test(hit.url)) return false;
  if (/login|sign in|customer service|routing number|locations|careers|privacy policy/.test(text)) return false;
  const offerWords = /bonus|apy|annual percentage yield|cash back|cashback|welcome offer|direct deposit|new money|promo|promotion|reward/;
  return offerWords.test(text);
}

async function searchBrave(plan: SearchPlan): Promise<SearchHit[]> {
  const apiKey = getDiscoveryApiKey();
  if (!apiKey) throw new Error("Discovery search is not configured. Add DISCOVERY_SEARCH_API_KEY in Vercel.");

  const params = new URLSearchParams({
    q: plan.query,
    count: String(RESULTS_PER_QUERY),
    country: "US",
    search_lang: "en",
    freshness: "pm",
    safesearch: "moderate",
  });

  const response = await fetch(`https://api.search.brave.com/res/v1/web/search?${params.toString()}`, {
    headers: {
      accept: "application/json",
      "x-subscription-token": apiKey,
      "user-agent": "ChurningDiscovery/1.0 (+https://churning-app.vercel.app)",
    },
    cache: "no-store",
    signal: AbortSignal.timeout(SEARCH_TIMEOUT_MS),
  });

  if (!response.ok) throw new Error(`Discovery search returned HTTP ${response.status}.`);
  const payload = await response.json() as { web?: { results?: BraveResult[] } };
  return (payload.web?.results || [])
    .map((result, index) => ({
      query: plan.query,
      category: plan.category,
      title: (result.title || "").trim(),
      url: (result.url || "").trim(),
      description: (result.description || "").trim(),
      rank: index + 1,
    }))
    .filter((hit) => hit.url && likelyOfferResult(hit));
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
  return new Date(new Date(run.completed_at).getTime() + DISCOVERY_INTERVAL_DAYS * 86_400_000).toISOString();
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

  if (!hasDiscoverySearchConfig()) {
    return {
      runId: null,
      status: "failed",
      queriesCount: 0,
      resultsCount: 0,
      newCandidates: 0,
      duplicateCandidates: 0,
      message: "Discovery search is installed but not active. Add DISCOVERY_SEARCH_API_KEY to Vercel.",
    };
  }

  const running = await runningDiscovery();
  if (running) {
    return { runId: running.id, status: "already_running", queriesCount: 0, resultsCount: 0, newCandidates: 0, duplicateCandidates: 0, message: "A discovery sweep is already running." };
  }

  const latest = await latestCompletedRun();
  const nextEligibleAt = nextEligibleAtFrom(latest);
  if (triggerType === "cron" && !force && nextEligibleAt && Date.now() < new Date(nextEligibleAt).getTime()) {
    return { runId: latest?.id || null, status: "skipped", queriesCount: 0, resultsCount: 0, newCandidates: 0, duplicateCandidates: 0, message: "Biweekly discovery is not due yet.", nextEligibleAt };
  }

  const { data: run, error: runError } = await supabase.from("discovery_runs").insert({
    trigger_type: triggerType,
    status: "running",
    provider: "brave",
  }).select("id").single();
  if (runError || !run) throw runError || new Error("Could not start discovery run.");
  const runId = run.id as string;

  try {
    const batches = await mapWithConcurrency(SEARCH_PLANS, SEARCH_CONCURRENCY, searchBrave);
    const rawHits = batches.flat();
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
      completed_at: now,
      queries_count: SEARCH_PLANS.length,
      results_count: dedupedHits.length,
      new_candidates: newCandidates,
      duplicate_candidates: duplicateCandidates,
    }).eq("id", runId);
    if (completeError) throw completeError;

    return {
      runId,
      status: "completed",
      queriesCount: SEARCH_PLANS.length,
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
