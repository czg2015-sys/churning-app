import { createClient as createPublicClient } from "@supabase/supabase-js";
import type { Opportunity } from "@/lib/types";
import { getSupabasePublicConfig } from "@/lib/supabase/env";

export type OpportunityFeed = {
  opportunities: Opportunity[];
  dataAvailable: boolean;
  errorCode?: "missing_config" | "query_failed";
};

export async function getLiveOpportunities(): Promise<OpportunityFeed> {
  const { url, key } = getSupabasePublicConfig();

  if (!url || !key) {
    console.error("[opportunities] Supabase public environment variables are unavailable");
    return { opportunities: [], dataAvailable: false, errorCode: "missing_config" };
  }

  try {
    const supabase = createPublicClient(url, key, {
      auth: {
        persistSession: false,
        autoRefreshToken: false,
        detectSessionInUrl: false,
      },
      global: {
        fetch: (input, init = {}) => fetch(input, { ...init, cache: "no-store" }),
      },
    });

    const { data, error } = await supabase
      .from("opportunities")
      .select("*, opportunity_reviews(*)")
      .eq("offer_status", "live");

    if (error) throw error;

    return {
      opportunities: (data || []) as Opportunity[],
      dataAvailable: true,
    };
  } catch (error) {
    console.error("[opportunities] Live offer lookup failed", error instanceof Error ? error.message : String(error));
    return { opportunities: [], dataAvailable: false, errorCode: "query_failed" };
  }
}
