import "server-only";

import { createResearchAdminClient } from "@/lib/research/server";
import { hasDiscoverySearchConfig } from "@/lib/research/discovery";

export type DiscoveryDashboardData = {
  configured: boolean;
  metrics: {
    totalCandidates: number;
    newCandidates: number;
    possibleOfficial: number;
    needsOfficialSource: number;
    duplicates: number;
  };
  candidates: Array<{
    id: string;
    institutionGuess: string | null;
    productNameGuess: string | null;
    categoryGuess: string;
    sourceTitle: string | null;
    sourceUrl: string;
    sourceDomain: string | null;
    sourceSnippet: string | null;
    officialSourceStatus: string;
    officialUrl: string | null;
    candidateStatus: string;
    matchedOpportunityId: string | null;
    firstDiscoveredAt: string;
    lastSeenAt: string;
  }>;
  runs: Array<{
    id: string;
    trigger_type: string;
    status: string;
    provider: string;
    started_at: string;
    completed_at: string | null;
    queries_count: number;
    results_count: number;
    new_candidates: number;
    duplicate_candidates: number;
    error_message: string | null;
  }>;
};

export async function getDiscoveryDashboardData(): Promise<DiscoveryDashboardData> {
  const supabase = createResearchAdminClient();
  const [{ data: candidates, error: candidateError }, { data: runs, error: runError }] = await Promise.all([
    supabase
      .from("discovery_candidates")
      .select("id,institution_guess,product_name_guess,category_guess,source_title,source_url,source_domain,source_snippet,official_source_status,official_url,candidate_status,matched_opportunity_id,first_discovered_at,last_seen_at")
      .order("last_seen_at", { ascending: false })
      .limit(40),
    supabase
      .from("discovery_runs")
      .select("id,trigger_type,status,provider,started_at,completed_at,queries_count,results_count,new_candidates,duplicate_candidates,error_message")
      .order("started_at", { ascending: false })
      .limit(8),
  ]);
  if (candidateError) throw candidateError;
  if (runError) throw runError;

  type CandidateRow = {
    id: string;
    institution_guess: string | null;
    product_name_guess: string | null;
    category_guess: string;
    source_title: string | null;
    source_url: string;
    source_domain: string | null;
    source_snippet: string | null;
    official_source_status: string;
    official_url: string | null;
    candidate_status: string;
    matched_opportunity_id: string | null;
    first_discovered_at: string;
    last_seen_at: string;
  };

  const rows = (candidates || []) as CandidateRow[];
  const newCandidates = rows.filter((row) => row.candidate_status === "discovered").length;
  const possibleOfficial = rows.filter((row) => row.official_source_status === "possible_official").length;
  const needsOfficialSource = rows.filter((row) => row.official_source_status === "needs_official_source").length;
  const duplicates = rows.filter((row) => row.candidate_status === "duplicate" || Boolean(row.matched_opportunity_id)).length;

  return {
    configured: hasDiscoverySearchConfig(),
    metrics: {
      totalCandidates: rows.length,
      newCandidates,
      possibleOfficial,
      needsOfficialSource,
      duplicates,
    },
    candidates: rows.map((row) => ({
      id: row.id,
      institutionGuess: row.institution_guess,
      productNameGuess: row.product_name_guess,
      categoryGuess: row.category_guess,
      sourceTitle: row.source_title,
      sourceUrl: row.source_url,
      sourceDomain: row.source_domain,
      sourceSnippet: row.source_snippet,
      officialSourceStatus: row.official_source_status,
      officialUrl: row.official_url,
      candidateStatus: row.candidate_status,
      matchedOpportunityId: row.matched_opportunity_id,
      firstDiscoveredAt: row.first_discovered_at,
      lastSeenAt: row.last_seen_at,
    })),
    runs: (runs || []) as DiscoveryDashboardData["runs"],
  };
}
