import "server-only";

import { createHash } from "node:crypto";
import { lookup } from "node:dns/promises";
import { isIP } from "node:net";
import { createResearchAdminClient } from "@/lib/research/server";

const FETCH_TIMEOUT_MS = 12_000;
const MAX_EXCERPT_LENGTH = 1_500;
const USER_AGENT = "ChurningResearchMonitor/1.1 (+https://churning-app.vercel.app)";
const MAX_REDIRECTS = 5;
const CONCURRENCY = 4;

export type ResearchTrigger = "manual" | "cron";
export type ResearchScanScope = "full" | "expiring";

export type ResearchRunResult = {
  runId: string;
  status: "completed" | "failed" | "already_running";
  totalOffers: number;
  checkedOffers: number;
  baselineOffers: number;
  unchangedOffers: number;
  changedOffers: number;
  unreachableOffers: number;
  message?: string;
};

type LiveOpportunity = {
  id: string;
  institution: string;
  product_name: string;
  category: string;
  official_url: string;
  safety_gate: string;
  bonus_amount: number | string | null;
  apy: number | string | null;
  direct_deposit_required: number | string | null;
  monthly_fee: number | string | null;
  annual_fee?: number | string | null;
  purchase_required_spend?: number | string | null;
  qualification_days?: number | null;
  payout_days?: number | null;
  min_account_age_days?: number | null;
  required_balance?: number | string | null;
  purchase_count?: number | null;
  purchase_min_amount?: number | string | null;
  reward_rate?: number | string | null;
  benefit_duration_days?: number | null;
  expires_at?: string | null;
  last_verified_at: string | null;
};

type ExtractedTerms = {
  bonusAmount?: number;
  apy?: number;
  directDepositRequired?: number;
  monthlyFee?: number;
  annualFee?: number;
  spendRequirement?: number;
  qualificationDays?: number;
  payoutDays?: number;
  minimumAccountAgeDays?: number;
  benefitDurationDays?: number;
  cashBackRate?: number;
};

type TermDiff = {
  field: string;
  previous?: number | null;
  current?: number | null;
  stored?: number | null;
  kind: "official_page_change" | "stored_term_mismatch";
};

type MonitorState = {
  opportunity_id: string;
  last_run_id: string | null;
  monitor_status: string;
  last_checked_at: string | null;
  last_fetch_status: string | null;
  last_http_status: number | null;
  last_content_hash: string | null;
  approved_content_hash: string | null;
  approved_at: string | null;
  approved_by: string | null;
  last_changed_at: string | null;
  last_final_url: string | null;
  last_page_title: string | null;
  last_content_length: number;
  consecutive_failures: number;
  last_extracted_terms?: ExtractedTerms | null;
};

type PageScan = {
  fetchStatus: "ok" | "blocked" | "http_error" | "empty" | "network_error" | "unsafe_url";
  httpStatus: number | null;
  finalUrl: string | null;
  pageTitle: string | null;
  normalizedText: string;
  contentHash: string | null;
  contentLength: number;
  excerpt: string | null;
  errorMessage: string | null;
  detectedSignals: Record<string, unknown>;
  extractedTerms: ExtractedTerms;
};

function htmlDecode(value: string) {
  return value
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&quot;/gi, '"')
    .replace(/&#39;/gi, "'")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">");
}

function extractTitle(html: string) {
  const match = html.match(/<title[^>]*>([\s\S]*?)<\/title>/i);
  if (!match?.[1]) return null;
  return htmlDecode(match[1].replace(/\s+/g, " ").trim()).slice(0, 300) || null;
}

function normalizeHtml(html: string) {
  return htmlDecode(
    html
      .replace(/<!--[\s\S]*?-->/g, " ")
      .replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, " ")
      .replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, " ")
      .replace(/<noscript\b[^>]*>[\s\S]*?<\/noscript>/gi, " ")
      .replace(/<svg\b[^>]*>[\s\S]*?<\/svg>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/\s+/g, " ")
      .trim(),
  );
}

function unique(values: string[], max = 25) {
  return Array.from(new Set(values)).slice(0, max);
}

function detectSignals(text: string) {
  const money = unique(text.match(/\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\$\s?\d+(?:\.\d{1,2})?/g) || []);
  const percentages = unique(text.match(/\b\d+(?:\.\d+)?\s?%/g) || []);
  const days = unique(text.match(/\b\d{1,3}\s+(?:calendar\s+)?days?\b/gi) || []);
  const months = unique(text.match(/\b(?:\d{1,2}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s+months?\b/gi) || []);

  return {
    money,
    percentages,
    days,
    months,
    mentionsLimitedBenefit: /promo(?:tional)?|boost|introductory|limited[- ]time|special rate|reward period|bonus period/i.test(text),
    mentionsDirectDeposit: /direct\s+deposit/i.test(text),
    mentionsMonthlyFee: /monthly\s+(?:service\s+)?fee/i.test(text),
    mentionsAnnualFee: /annual\s+fee/i.test(text),
    mentionsApy: /\bapy\b|annual percentage yield/i.test(text),
    mentionsBonus: /\bbonus\b|cash offer|welcome offer/i.test(text),
    mentionsEarlyClosure: /early\s+clos|close(?:d|r)?\s+(?:the\s+)?account|clawback|forfeit|recoup/i.test(text),
    mentionsFDIC: /member\s+fdic|fdic[- ]insured/i.test(text),
    mentionsNCUA: /ncua|federally insured by the ncua/i.test(text),
    mentionsEligibility: /new customer|existing customer|eligible|ineligible|not eligible/i.test(text),
  };
}

function parseMoney(raw?: string | null) {
  if (!raw) return undefined;
  const value = Number(raw.replace(/[$,\s]/g, ""));
  return Number.isFinite(value) ? value : undefined;
}

function parsePercent(raw?: string | null) {
  if (!raw) return undefined;
  const value = Number(raw.replace(/[%\s]/g, ""));
  return Number.isFinite(value) ? value : undefined;
}

const durationWords: Record<string, number> = {
  one: 1, two: 2, three: 3, four: 4, five: 5, six: 6,
  seven: 7, eight: 8, nine: 9, ten: 10, eleven: 11, twelve: 12,
};

function parseDurationCount(raw: string) {
  const normalized = raw.trim().toLowerCase();
  if (durationWords[normalized]) return durationWords[normalized];
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : 0;
}

function extractLimitedBenefitDurationDays(text: string) {
  const trigger = /promo(?:tional)?|\bboost\b|introductory|limited[- ]time|special\s+(?:apy|rate)|reward\s+period|bonus\s+period|rate\s+boost/i;
  const duration = /\b(\d{1,3}|one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve)\s*(day|week|month|year)s?\b/gi;
  const triggerMatch = trigger.exec(text);
  if (!triggerMatch || triggerMatch.index === undefined) return undefined;

  const start = Math.max(0, triggerMatch.index - 180);
  const end = Math.min(text.length, triggerMatch.index + triggerMatch[0].length + 260);
  const chunk = text.slice(start, end);
  const candidates = Array.from(chunk.matchAll(duration));
  if (!candidates.length) return undefined;

  const triggerCenter = triggerMatch.index - start + triggerMatch[0].length / 2;
  candidates.sort((a, b) => Math.abs((a.index || 0) - triggerCenter) - Math.abs((b.index || 0) - triggerCenter));
  const picked = candidates[0];
  const count = parseDurationCount(picked?.[1] || "");
  const unit = (picked?.[2] || "").toLowerCase();
  if (count <= 0) return undefined;
  if (unit === "day") return Math.round(count);
  if (unit === "week") return Math.round(count * 7);
  if (unit === "month") return Math.round(count * 30.4375);
  if (unit === "year") return Math.round(count * 365);
  return undefined;
}

function closestMatch(text: string, keyword: RegExp, valuePattern: RegExp, maxDistance = 180) {
  const keywordMatch = keyword.exec(text);
  if (!keywordMatch || keywordMatch.index === undefined) return null;
  const start = Math.max(0, keywordMatch.index - maxDistance);
  const end = Math.min(text.length, keywordMatch.index + keywordMatch[0].length + maxDistance);
  const chunk = text.slice(start, end);
  const values = Array.from(chunk.matchAll(valuePattern));
  if (!values.length) return null;
  const keywordCenter = keywordMatch.index - start + keywordMatch[0].length / 2;
  values.sort((a, b) => Math.abs((a.index || 0) - keywordCenter) - Math.abs((b.index || 0) - keywordCenter));
  return values[0]?.[0] || null;
}

function extractTerms(text: string): ExtractedTerms {
  const money = /\$\s?\d{1,3}(?:,\d{3})*(?:\.\d{1,2})?|\$\s?\d+(?:\.\d{1,2})?/g;
  const percent = /\b\d+(?:\.\d+)?\s?%/g;
  const days = /\b\d{1,3}\s+(?:calendar\s+)?days?\b/gi;

  const bonusAmount = parseMoney(closestMatch(text, /\b(?:bonus|welcome offer|cash offer|earn)\b/i, money));
  const apy = parsePercent(closestMatch(text, /\b(?:apy|annual percentage yield)\b/i, percent));
  const directDepositRequired = parseMoney(closestMatch(text, /direct\s+deposit/i, money));
  const monthlyFee = parseMoney(closestMatch(text, /monthly\s+(?:service\s+)?fee/i, money));
  const annualFee = parseMoney(closestMatch(text, /annual\s+fee/i, money));
  const spendRequirement = parseMoney(closestMatch(text, /(?:spend|purchases?|purchase requirement)/i, money));
  const cashBackRate = parsePercent(closestMatch(text, /(?:cash\s*back|cashback|rewards? rate)/i, percent));
  const benefitDurationDays = extractLimitedBenefitDurationDays(text);

  const qualificationRaw = closestMatch(text, /(?:qualif|within|complete|make.*deposit|maintain)/i, days);
  const payoutRaw = closestMatch(text, /(?:payout|paid|payment|bonus.*within|receive.*bonus)/i, days);
  const minimumAgeRaw = closestMatch(text, /(?:keep.*open|remain open|minimum account age|close.*after|open for)/i, days);

  return {
    ...(bonusAmount !== undefined ? { bonusAmount } : {}),
    ...(apy !== undefined ? { apy } : {}),
    ...(directDepositRequired !== undefined ? { directDepositRequired } : {}),
    ...(monthlyFee !== undefined ? { monthlyFee } : {}),
    ...(annualFee !== undefined ? { annualFee } : {}),
    ...(spendRequirement !== undefined ? { spendRequirement } : {}),
    ...(cashBackRate !== undefined ? { cashBackRate } : {}),
    ...(qualificationRaw ? { qualificationDays: Number(qualificationRaw.match(/\d+/)?.[0] || 0) } : {}),
    ...(payoutRaw ? { payoutDays: Number(payoutRaw.match(/\d+/)?.[0] || 0) } : {}),
    ...(minimumAgeRaw ? { minimumAccountAgeDays: Number(minimumAgeRaw.match(/\d+/)?.[0] || 0) } : {}),
    ...(benefitDurationDays !== undefined ? { benefitDurationDays } : {}),
  };
}

function numberVariants(value: number | string | null | undefined, kind: "money" | "percent") {
  if (value === null || value === undefined || value === "") return [];
  const numeric = Number(value);
  if (!Number.isFinite(numeric) || numeric <= 0) return [];

  const plain = numeric % 1 === 0 ? String(numeric) : String(numeric).replace(/0+$/, "").replace(/\.$/, "");
  const comma = numeric.toLocaleString("en-US", { maximumFractionDigits: 4, useGrouping: true });
  return kind === "money"
    ? [`$${plain}`, `$${comma}`, `$ ${plain}`, `$ ${comma}`]
    : [`${plain}%`, `${plain} %`, `${comma}%`, `${comma} %`];
}

function expectedValueAppears(text: string, variants: string[]) {
  if (!variants.length) return true;
  const lower = text.toLowerCase();
  return variants.some((variant) => lower.includes(variant.toLowerCase()));
}

function buildMismatchFlags(opportunity: LiveOpportunity, text: string) {
  const flags: string[] = [];
  if (!expectedValueAppears(text, numberVariants(opportunity.bonus_amount, "money"))) flags.push("stored_bonus_not_found_on_page");
  if (!expectedValueAppears(text, numberVariants(opportunity.apy, "percent"))) flags.push("stored_apy_not_found_on_page");
  if (!expectedValueAppears(text, numberVariants(opportunity.direct_deposit_required, "money"))) flags.push("stored_dd_requirement_not_found_on_page");
  if (!expectedValueAppears(text, numberVariants(opportunity.monthly_fee, "money"))) flags.push("stored_monthly_fee_not_found_on_page");
  if (!expectedValueAppears(text, numberVariants(opportunity.annual_fee, "money"))) flags.push("stored_annual_fee_not_found_on_page");
  return flags;
}

function num(value: unknown) {
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

function different(a: number | null | undefined, b: number | null | undefined, tolerance = 0.01) {
  if (a === null || a === undefined || b === null || b === undefined) return false;
  return Math.abs(a - b) > tolerance;
}

function buildTermDiffs(opportunity: LiveOpportunity, previous: ExtractedTerms | null | undefined, current: ExtractedTerms) {
  const diffs: TermDiff[] = [];
  const pageFields: Array<[keyof ExtractedTerms, string]> = [
    ["bonusAmount", "Bonus"],
    ["apy", "APY"],
    ["directDepositRequired", "Direct deposit requirement"],
    ["monthlyFee", "Monthly fee"],
    ["annualFee", "Annual fee"],
    ["spendRequirement", "Spend requirement"],
    ["qualificationDays", "Qualification window"],
    ["payoutDays", "Payout window"],
    ["minimumAccountAgeDays", "Minimum account age"],
    ["benefitDurationDays", "Limited benefit duration"],
    ["cashBackRate", "Cash-back rate"],
  ];

  for (const [key, label] of pageFields) {
    const prev = num(previous?.[key]);
    const cur = num(current[key]);
    if (different(prev, cur)) diffs.push({ field: label, previous: prev, current: cur, kind: "official_page_change" });
  }

  const storedPairs: Array<[string, unknown, unknown]> = [
    ["Bonus", opportunity.bonus_amount, current.bonusAmount],
    ["APY", opportunity.apy, current.apy],
    ["Direct deposit requirement", opportunity.direct_deposit_required, current.directDepositRequired],
    ["Monthly fee", opportunity.monthly_fee, current.monthlyFee],
    ["Annual fee", opportunity.annual_fee, current.annualFee],
    ["Spend requirement", opportunity.purchase_required_spend, current.spendRequirement],
    ["Qualification window", opportunity.qualification_days, current.qualificationDays],
    ["Payout window", opportunity.payout_days, current.payoutDays],
    ["Minimum account age", opportunity.min_account_age_days, current.minimumAccountAgeDays],
    ["Limited benefit duration", opportunity.benefit_duration_days, current.benefitDurationDays],
    ["Cash-back rate", opportunity.reward_rate, current.cashBackRate],
  ];

  for (const [field, storedRaw, currentRaw] of storedPairs) {
    const stored = num(storedRaw);
    const cur = num(currentRaw);
    if (stored !== null && stored > 0 && cur !== null && different(stored, cur)) {
      diffs.push({ field, stored, current: cur, kind: "stored_term_mismatch" });
    }
  }

  return diffs;
}

function isPrivateIpv4(ip: string) {
  const parts = ip.split(".").map(Number);
  if (parts.length !== 4 || parts.some((part) => !Number.isInteger(part))) return false;
  const [a, b] = parts;
  return a === 10 || a === 127 || a === 0 || (a === 169 && b === 254) || (a === 172 && b >= 16 && b <= 31) || (a === 192 && b === 168);
}

function isPrivateIp(ip: string) {
  const version = isIP(ip);
  if (version === 4) return isPrivateIpv4(ip);
  if (version === 6) {
    const lower = ip.toLowerCase();
    return lower === "::1" || lower.startsWith("fc") || lower.startsWith("fd") || lower.startsWith("fe80:") || lower.startsWith("::ffff:127.") || lower.startsWith("::ffff:10.") || lower.startsWith("::ffff:192.168.");
  }
  return false;
}

async function validatePublicHttpsUrl(rawUrl: string) {
  const parsed = new URL(rawUrl);
  if (parsed.protocol !== "https:") throw new Error("Only public HTTPS official URLs may be researched.");
  const hostname = parsed.hostname.toLowerCase();
  if (!hostname || hostname === "localhost" || hostname.endsWith(".local") || hostname.endsWith(".internal")) {
    throw new Error("Local or internal research URLs are not allowed.");
  }
  if (isPrivateIp(hostname)) throw new Error("Private-network research URLs are not allowed.");
  const resolved = await lookup(hostname, { all: true, verbatim: true });
  if (!resolved.length || resolved.some((entry) => isPrivateIp(entry.address))) {
    throw new Error("The official URL resolves to a private or unavailable network address.");
  }
  return parsed;
}

async function safeFetch(url: string) {
  let current = (await validatePublicHttpsUrl(url)).toString();
  for (let redirect = 0; redirect <= MAX_REDIRECTS; redirect += 1) {
    const response = await fetch(current, {
      redirect: "manual",
      cache: "no-store",
      headers: {
        "user-agent": USER_AGENT,
        accept: "text/html,application/xhtml+xml",
        "accept-language": "en-US,en;q=0.9",
      },
      signal: AbortSignal.timeout(FETCH_TIMEOUT_MS),
    });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get("location");
      if (!location) return response;
      current = (await validatePublicHttpsUrl(new URL(location, current).toString())).toString();
      continue;
    }
    return response;
  }
  throw new Error("Too many redirects while checking the official source.");
}

async function fetchOfficialPage(url: string): Promise<PageScan> {
  try {
    const response = await safeFetch(url);
    const finalUrl = response.url || url;
    const httpStatus = response.status;
    const html = await response.text();
    const pageTitle = extractTitle(html);
    const normalizedText = normalizeHtml(html);
    const lower = normalizedText.toLowerCase();
    const blocked = response.status === 403 || response.status === 429 || /access denied|request blocked|verify you are human|captcha|bot detection|unusual traffic/.test(lower);

    let fetchStatus: PageScan["fetchStatus"] = "ok";
    if (blocked) fetchStatus = "blocked";
    else if (!response.ok) fetchStatus = "http_error";
    else if (normalizedText.length < 250) fetchStatus = "empty";

    const contentHash = normalizedText.length ? createHash("sha256").update(normalizedText).digest("hex") : null;
    const extractedTerms = extractTerms(normalizedText);
    return {
      fetchStatus,
      httpStatus,
      finalUrl,
      pageTitle,
      normalizedText,
      contentHash,
      contentLength: normalizedText.length,
      excerpt: normalizedText ? normalizedText.slice(0, MAX_EXCERPT_LENGTH) : null,
      errorMessage: fetchStatus === "ok" ? null : `Official page returned ${fetchStatus} (${httpStatus}).`,
      detectedSignals: detectSignals(normalizedText),
      extractedTerms,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const unsafe = /HTTPS|private|internal|network address/i.test(message);
    return {
      fetchStatus: unsafe ? "unsafe_url" : "network_error",
      httpStatus: null,
      finalUrl: null,
      pageTitle: null,
      normalizedText: "",
      contentHash: null,
      contentLength: 0,
      excerpt: null,
      errorMessage: message,
      detectedSignals: {},
      extractedTerms: {},
    };
  }
}

function changeStatusFor(scan: PageScan, previousHash: string | null | undefined) {
  if (scan.fetchStatus !== "ok" || !scan.contentHash) return "unreachable";
  if (!previousHash) return "baseline";
  return scan.contentHash === previousHash ? "unchanged" : "changed";
}

function monitorStatusFor(changeStatus: string, scan: PageScan, previous: MonitorState | undefined, failures: number, mismatchFlags: string[], materialChange: boolean) {
  if (materialChange || mismatchFlags.length > 0 || changeStatus === "changed") return "changed";
  if (changeStatus === "baseline") return "needs_review";
  if (changeStatus === "unreachable") return failures >= 2 ? "stale" : "unreachable";
  if (previous?.approved_content_hash && scan.contentHash === previous.approved_content_hash) return "verified";
  return "needs_review";
}

async function checkForExistingRun() {
  const supabase = createResearchAdminClient();
  const tenMinutesAgo = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { data } = await supabase.from("research_runs").select("id, started_at").eq("status", "running").gte("started_at", tenMinutesAgo).order("started_at", { ascending: false }).limit(1).maybeSingle();
  return data as { id: string; started_at: string } | null;
}

async function mapWithConcurrency<T, R>(items: T[], limit: number, fn: (item: T) => Promise<R>) {
  const results = new Array<R>(items.length);
  let index = 0;
  async function worker() {
    while (true) {
      const current = index;
      index += 1;
      if (current >= items.length) return;
      results[current] = await fn(items[current]);
    }
  }
  await Promise.all(Array.from({ length: Math.min(limit, items.length) }, () => worker()));
  return results;
}

export async function runResearchScan({
  triggerType,
  initiatedBy = null,
  scope = "full",
}: {
  triggerType: ResearchTrigger;
  initiatedBy?: string | null;
  scope?: ResearchScanScope;
}): Promise<ResearchRunResult> {
  const supabase = createResearchAdminClient();
  const existingRun = await checkForExistingRun();
  if (existingRun) {
    return { runId: existingRun.id, status: "already_running", totalOffers: 0, checkedOffers: 0, baselineOffers: 0, unchangedOffers: 0, changedOffers: 0, unreachableOffers: 0, message: "A research scan is already running." };
  }

  const { data: run, error: runError } = await supabase.from("research_runs").insert({
    trigger_type: triggerType,
    status: "running",
    initiated_by: initiatedBy,
    notes: `${scope === "expiring" ? "Expiring-offer" : "Full"} official-source monitoring scan. Changes require review before re-clearing an offer.`,
  }).select("id").single();
  if (runError || !run) throw runError || new Error("Could not create research run.");
  const runId = run.id as string;

  try {
    let opportunityQuery = supabase.from("opportunities").select(
      "id,institution,product_name,category,official_url,safety_gate,bonus_amount,apy,direct_deposit_required,monthly_fee,annual_fee,purchase_required_spend,qualification_days,payout_days,min_account_age_days,required_balance,purchase_count,purchase_min_amount,reward_rate,benefit_duration_days,expires_at,last_verified_at",
    ).eq("offer_status", "live").order("institution");

    if (scope === "expiring") {
      const now = new Date();
      const cutoff = new Date(now.getTime() + 14 * 86_400_000);
      opportunityQuery = opportunityQuery.gte("expires_at", now.toISOString()).lte("expires_at", cutoff.toISOString());
    }

    const [{ data: opportunities, error: opportunitiesError }, { data: monitorRows, error: monitorError }] = await Promise.all([
      opportunityQuery,
      supabase.from("research_monitor_state").select("*"),
    ]);
    if (opportunitiesError) throw opportunitiesError;
    if (monitorError) throw monitorError;

    const liveOpportunities = (opportunities || []) as LiveOpportunity[];
    const monitorMap = new Map(((monitorRows || []) as MonitorState[]).map((row) => [row.opportunity_id, row]));

    const scans = await mapWithConcurrency(liveOpportunities, CONCURRENCY, async (opportunity) => {
      const previous = monitorMap.get(opportunity.id);
      const scan = await fetchOfficialPage(opportunity.official_url);
      const changeStatus = changeStatusFor(scan, previous?.last_content_hash);
      const mismatchFlags = scan.normalizedText ? buildMismatchFlags(opportunity, scan.normalizedText) : [];
      const termDiffs = buildTermDiffs(opportunity, previous?.last_extracted_terms, scan.extractedTerms);
      const materialChange = termDiffs.length > 0;
      const failures = changeStatus === "unreachable" ? (previous?.consecutive_failures || 0) + 1 : 0;
      const monitorStatus = monitorStatusFor(changeStatus, scan, previous, failures, mismatchFlags, materialChange);
      return { opportunity, previous, scan, changeStatus, mismatchFlags, termDiffs, materialChange, failures, monitorStatus };
    });

    const now = new Date().toISOString();
    const findings = scans.map(({ opportunity, previous, scan, changeStatus, mismatchFlags, termDiffs, materialChange }) => ({
      run_id: runId,
      opportunity_id: opportunity.id,
      institution: opportunity.institution,
      product_name: opportunity.product_name,
      official_url: opportunity.official_url,
      final_url: scan.finalUrl,
      fetch_status: scan.fetchStatus,
      http_status: scan.httpStatus,
      change_status: changeStatus,
      content_hash: scan.contentHash,
      previous_hash: previous?.last_content_hash || null,
      page_title: scan.pageTitle,
      content_length: scan.contentLength,
      detected_signals: scan.detectedSignals,
      extracted_terms: scan.extractedTerms,
      term_diffs: termDiffs,
      material_change: materialChange,
      mismatch_flags: mismatchFlags,
      excerpt: scan.excerpt,
      error_message: scan.errorMessage,
    }));
    if (findings.length) {
      const { error } = await supabase.from("research_findings").insert(findings);
      if (error) throw error;
    }

    const monitorUpserts = scans.map(({ opportunity, previous, scan, changeStatus, failures, monitorStatus }) => ({
      opportunity_id: opportunity.id,
      last_run_id: runId,
      monitor_status: monitorStatus,
      last_checked_at: now,
      last_fetch_status: scan.fetchStatus,
      last_http_status: scan.httpStatus,
      last_content_hash: scan.contentHash || previous?.last_content_hash || null,
      last_extracted_terms: scan.fetchStatus === "ok" ? scan.extractedTerms : previous?.last_extracted_terms || {},
      approved_content_hash: previous?.approved_content_hash || null,
      approved_at: previous?.approved_at || null,
      approved_by: previous?.approved_by || null,
      last_changed_at: changeStatus === "changed" ? now : previous?.last_changed_at || null,
      last_final_url: scan.finalUrl || previous?.last_final_url || null,
      last_page_title: scan.pageTitle || previous?.last_page_title || null,
      last_content_length: scan.contentLength || previous?.last_content_length || 0,
      consecutive_failures: failures,
      updated_at: now,
    }));
    if (monitorUpserts.length) {
      const { error } = await supabase.from("research_monitor_state").upsert(monitorUpserts, { onConflict: "opportunity_id" });
      if (error) throw error;
    }

    const holdIds = Array.from(new Set(scans.filter(({ changeStatus, failures, mismatchFlags, materialChange }) =>
      changeStatus === "baseline" || changeStatus === "changed" || materialChange || mismatchFlags.length > 0 || (changeStatus === "unreachable" && failures >= 2),
    ).map(({ opportunity }) => opportunity.id)));
    if (holdIds.length) {
      const { error } = await supabase.from("opportunities").update({ safety_gate: "hold", updated_at: now }).in("id", holdIds);
      if (error) throw error;
    }

    const autoVerifiedIds = scans.filter(({ previous, scan, changeStatus, mismatchFlags, materialChange }) =>
      changeStatus === "unchanged" && mismatchFlags.length === 0 && !materialChange && Boolean(previous?.approved_content_hash) && previous?.approved_content_hash === scan.contentHash,
    ).map(({ opportunity }) => opportunity.id);
    if (autoVerifiedIds.length) {
      const { error } = await supabase.from("opportunities").update({ last_verified_at: now, updated_at: now }).in("id", autoVerifiedIds);
      if (error) throw error;
    }

    const counts = scans.reduce((acc, row) => {
      if (row.changeStatus === "baseline") acc.baseline += 1;
      else if (row.changeStatus === "unchanged") acc.unchanged += 1;
      else if (row.changeStatus === "changed") acc.changed += 1;
      else acc.unreachable += 1;
      return acc;
    }, { baseline: 0, unchanged: 0, changed: 0, unreachable: 0 });

    const { error: updateError } = await supabase.from("research_runs").update({
      status: "completed",
      completed_at: now,
      total_offers: liveOpportunities.length,
      checked_offers: scans.length,
      baseline_offers: counts.baseline,
      unchanged_offers: counts.unchanged,
      changed_offers: counts.changed,
      unreachable_offers: counts.unreachable,
    }).eq("id", runId);
    if (updateError) throw updateError;

    return { runId, status: "completed", totalOffers: liveOpportunities.length, checkedOffers: scans.length, baselineOffers: counts.baseline, unchangedOffers: counts.unchanged, changedOffers: counts.changed, unreachableOffers: counts.unreachable };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    await supabase.from("research_runs").update({ status: "failed", completed_at: new Date().toISOString(), error_message: message.slice(0, 2_000) }).eq("id", runId);
    return { runId, status: "failed", totalOffers: 0, checkedOffers: 0, baselineOffers: 0, unchangedOffers: 0, changedOffers: 0, unreachableOffers: 0, message };
  }
}
