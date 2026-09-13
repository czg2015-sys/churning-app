import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowLeft, ArrowRight, ShieldCheck } from "lucide-react";
import { RecommendedOpportunities } from "@/components/recommended-opportunities";
import { getLiveOpportunities } from "@/lib/opportunities";
import { createClient } from "@/lib/supabase/server";
import type { FinancialProfile } from "@/lib/types";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Your Recommendations" };

export default async function RecommendationsPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/auth?next=/recommendations");

  const [{ data: profile }, { data: bankHistory }, { data: userProfile }, { data: missions }, opportunityFeed] = await Promise.all([
    supabase.from("financial_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("account_history").select("institution").eq("user_id", userId),
    supabase.from("profiles").select("state_code").eq("user_id", userId).maybeSingle(),
    supabase.from("missions").select("opportunity_id,status").eq("user_id", userId),
    getLiveOpportunities(),
  ]);

  if (!profile) redirect("/questionnaire");

  const usedBanks = Array.from(new Set(((bankHistory || []) as Array<{ institution?: string | null }>).map((row) => row.institution).filter((bank): bank is string => Boolean(bank))));
  const addedOpportunityIds = ((missions || []) as Array<{ opportunity_id?: string | null; status: string }>).filter((mission) => !["completed", "closed"].includes(mission.status)).map((mission) => mission.opportunity_id).filter((id): id is string => Boolean(id));

  return (
    <main className="page-shell recommendation-results-page">
      <div className="shell">
        <div className="results-topbar">
          <Link href="/questionnaire"><ArrowLeft size={15} /> Edit answers</Link>
          <span><ShieldCheck size={14} /> Matches are educational comparisons, not financial advice.</span>
        </div>
        <header className="results-hero">
          <span className="kicker">YOUR PERSONALIZED MATCHES</span>
          <h1>Here’s where your cash could work harder.</h1>
          <p>We ranked current opportunities against your cash, reserve, paycheck capacity, normal spending, liquidity preference, bank history, and current savings baseline.</p>
          <div className="results-hero-actions"><Link className="button ghost" href="/my-plan">Go to My Plan</Link><a className="text-link" href="#matches">See matches <ArrowRight size={15} /></a></div>
        </header>
        <div id="matches">
          {!opportunityFeed.dataAvailable ? (
            <section className="recommendation-data-error"><ShieldCheck size={24} /><div><h2>We couldn’t load the verified offer feed right now.</h2><p>Your saved profile is safe. Refresh to retry the live feed; Churning will not substitute stale or invented recommendations.</p></div></section>
          ) : (
            <RecommendedOpportunities
              profile={profile as FinancialProfile}
              opportunities={opportunityFeed.opportunities}
              usedBanks={usedBanks}
              addedOpportunityIds={addedOpportunityIds}
              stateCode={userProfile?.state_code || "CA"}
              prominent
              resultsPage
            />
          )}
        </div>
      </div>
    </main>
  );
}
