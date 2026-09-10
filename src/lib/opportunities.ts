import type { Opportunity } from "@/lib/types";
import { createClient } from "@/lib/supabase/server";
import { unstable_rethrow } from "next/navigation";

export async function getLiveOpportunities() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseKey = process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY;

  if (!supabaseUrl || !supabaseKey) {
    console.error("[opportunities] Supabase environment variables are unavailable");
    return { opportunities: [] as Opportunity[], dataAvailable: false };
  }

  try {
    const supabase = await createClient();
    const { data, error } = await supabase.from("opportunities").select("*").eq("offer_status", "live");
    if (error) throw error;
    return { opportunities: (data || []) as Opportunity[], dataAvailable: true };
  } catch (error) {
    unstable_rethrow(error);
    console.error("[opportunities] Live offer lookup failed", error instanceof Error ? error.message : String(error));
    return { opportunities: [] as Opportunity[], dataAvailable: false };
  }
}
