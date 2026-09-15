import "server-only";

import { createResearchAdminClient } from "@/lib/research/server";

export type ResearchDashboardOffer = {
  id: string;
  institution: string;
  productName: string;
  category: string;
  officialUrl: string;
  safetyGate: string;
  lastVerifiedAt: string | null;
  monitorStatus: string;
  lastCheckedAt: string | null;
  lastFetchStatus: string | null;
  lastHttpStatus: number | null;
  lastChangedAt: string | null;
  approvedAt: string | null;
  consecutiveFailures: number;
  latestFindingId: string | null;
  latestChangeStatus: string | null;
  latestMismatchFlags: string[];
  latestTermDiffs: Array<{ field: string; previous?: number | null; current?: number | null; stored?: number | null; kind: string }>;
  latestMaterialChange: boolean;
  latestExtractedTerms: Record<string, unknown>;
  latestError: string | null;
};

export type ResearchDashboardData = {
  metrics: { totalOffers: number; checkedThisWeek: number; verified: number; changed: number; needsReview: number; unreachable: number };
  offers: ResearchDashboardOffer[];
  runs: Array<{ id: string; trigger_type: string; status: string; started_at: string; completed_at: string | null; total_offers: number; checked_offers: number; baseline_offers: number; unchanged_offers: number; changed_offers: number; unreachable_offers: number; error_message: string | null }>;
};

export async function getResearchDashboardData(): Promise<ResearchDashboardData> {
  const supabase = createResearchAdminClient();
  const [{ data: opportunities, error: oppError }, { data: monitors, error: monitorError }, { data: findings, error: findingError }, { data: runs, error: runError }] = await Promise.all([
    supabase.from("opportunities").select("id,institution,product_name,category,official_url,safety_gate,last_verified_at").eq("offer_status", "live").order("institution"),
    supabase.from("research_monitor_state").select("*").order("updated_at", { ascending: false }),
    supabase.from("research_findings").select("id,opportunity_id,change_status,mismatch_flags,term_diffs,material_change,extracted_terms,error_message,created_at").order("created_at", { ascending: false }).limit(300),
    supabase.from("research_runs").select("*").order("started_at", { ascending: false }).limit(12),
  ]);
  if (oppError) throw oppError;
  if (monitorError) throw monitorError;
  if (findingError) throw findingError;
  if (runError) throw runError;

  type FindingRow = {
    id: string; opportunity_id: string; change_status: string; mismatch_flags: string[] | null;
    term_diffs: ResearchDashboardOffer["latestTermDiffs"] | null; material_change: boolean | null;
    extracted_terms: Record<string, unknown> | null; error_message: string | null; created_at: string;
  };

  const monitorMap = new Map((monitors || []).map((row) => [row.opportunity_id, row]));
  const latestFindingMap = new Map<string, FindingRow>();
  for (const row of (findings || []) as FindingRow[]) if (!latestFindingMap.has(row.opportunity_id)) latestFindingMap.set(row.opportunity_id, row);

  const offers: ResearchDashboardOffer[] = (opportunities || []).map((opportunity) => {
    const monitor = monitorMap.get(opportunity.id);
    const finding = latestFindingMap.get(opportunity.id);
    return {
      id: opportunity.id,
      institution: opportunity.institution,
      productName: opportunity.product_name,
      category: opportunity.category,
      officialUrl: opportunity.official_url,
      safetyGate: opportunity.safety_gate,
      lastVerifiedAt: opportunity.last_verified_at,
      monitorStatus: monitor?.monitor_status || "unmonitored",
      lastCheckedAt: monitor?.last_checked_at || null,
      lastFetchStatus: monitor?.last_fetch_status || null,
      lastHttpStatus: monitor?.last_http_status || null,
      lastChangedAt: monitor?.last_changed_at || null,
      approvedAt: monitor?.approved_at || null,
      consecutiveFailures: monitor?.consecutive_failures || 0,
      latestFindingId: finding?.id || null,
      latestChangeStatus: finding?.change_status || null,
      latestMismatchFlags: finding?.mismatch_flags || [],
      latestTermDiffs: finding?.term_diffs || [],
      latestMaterialChange: Boolean(finding?.material_change),
      latestExtractedTerms: finding?.extracted_terms || {},
      latestError: finding?.error_message || null,
    };
  });

  const sevenDaysAgo = Date.now() - 7 * 24 * 60 * 60 * 1000;
  const checkedThisWeek = offers.filter((offer) => offer.lastCheckedAt && new Date(offer.lastCheckedAt).getTime() >= sevenDaysAgo).length;
  const verified = offers.filter((offer) => offer.monitorStatus === "verified").length;
  const changed = offers.filter((offer) => offer.monitorStatus === "changed").length;
  const unreachable = offers.filter((offer) => ["unreachable", "stale"].includes(offer.monitorStatus)).length;
  const needsReview = offers.filter((offer) => ["needs_review", "changed", "hold", "stale", "unreachable", "unmonitored"].includes(offer.monitorStatus)).length;

  return { metrics: { totalOffers: offers.length, checkedThisWeek, verified, changed, needsReview, unreachable }, offers, runs: (runs || []) as ResearchDashboardData["runs"] };
}
