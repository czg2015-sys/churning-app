import type { Metadata } from "next";
import { OpportunitiesList } from "@/components/opportunities-list";
import { createClient } from "@/lib/supabase/server";
import type { Opportunity } from "@/lib/types";

export const metadata: Metadata = { title: "Opportunities" };

export default async function OpportunitiesPage() {
  const supabase = await createClient();
  const { data } = await supabase.from("opportunities").select("*").eq("offer_status", "live");

  return (
    <main className="page-shell">
      <div className="shell">
        <div className="page-heading">
          <div><span className="kicker">OPPORTUNITIES</span><h1>Compare the real tradeoffs.</h1><p>Profit matters, but so do the deposit requirement, time window, effort, liquidity, and confidence in the offer details.</p></div>
        </div>
        <OpportunitiesList opportunities={(data || []) as Opportunity[]} />
        <div className="disclaimer"><strong>Review before acting.</strong> Rates and promotions change. “Confidence” describes how complete the stored research is—not a guarantee of approval, payout, or safety.</div>
      </div>
    </main>
  );
}
