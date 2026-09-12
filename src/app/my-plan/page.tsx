import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, Settings2 } from "lucide-react";
import { PlanCommandSummary } from "@/components/plan-command-summary";
import { PlanDashboard } from "@/components/plan-dashboard";
import { RecommendedOpportunities } from "@/components/recommended-opportunities";
import { RewardTracker } from "@/components/reward-tracker";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import type { FinancialProfile, Mission, Opportunity } from "@/lib/types";

export const metadata: Metadata = { title: "My Plan" };

export default async function MyPlanPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/auth?next=/my-plan");

  const [{ data: profile }, { data: opportunities }, { data: missions }, { data: bankHistory }, { data: userProfile }] = await Promise.all([
    supabase.from("financial_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("opportunities").select("*, opportunity_reviews(*)").eq("offer_status", "live"),
    supabase.from("missions").select("*, mission_steps(*), opportunity:opportunities(*, opportunity_reviews(*))").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("account_history").select("institution").eq("user_id", userId),
    supabase.from("profiles").select("state_code").eq("user_id", userId).maybeSingle(),
  ]);

  const typedProfile = profile as FinancialProfile | null;
  const typedOpportunities = (opportunities || []) as Opportunity[];
  const typedMissions = (missions || []) as Mission[];
  const usedBanks: string[] = Array.from(new Set(((bankHistory || []) as Array<{ institution?: string | null }>).map((row) => row.institution).filter((bank): bank is string => Boolean(bank))));
  const addedOpportunityIds = typedMissions.filter((mission) => !["completed", "closed"].includes(mission.status)).map((mission) => mission.opportunity_id).filter((id): id is string => Boolean(id));
  const hasTrackedRewards = typedMissions.length > 0;
  const stateCode = userProfile?.state_code || "CA";

  return (
    <main className="page-shell my-plan-page">
      <div className="shell">
        <div className="plan-topbar">
          <div><span className="workspace-dot" /> Workspace synced to your saved profile</div>
          <div className="plan-topbar-actions"><Link href="/opportunities">Opportunity library <ArrowUpRight size={13} /></Link><Link href="/questionnaire"><Settings2 size={14} /> Update profile</Link><SignOutButton /></div>
        </div>

        {typedProfile ? (
          <>
            <PlanCommandSummary profile={typedProfile} missions={typedMissions} usedBanks={usedBanks} />

            {!hasTrackedRewards ? (
              <>
                <RecommendedOpportunities profile={typedProfile} opportunities={typedOpportunities} usedBanks={usedBanks} addedOpportunityIds={addedOpportunityIds} stateCode={stateCode} prominent />
                <RewardTracker missions={typedMissions} />
              </>
            ) : (
              <>
                <RewardTracker missions={typedMissions} />
                <RecommendedOpportunities profile={typedProfile} opportunities={typedOpportunities} usedBanks={usedBanks} addedOpportunityIds={addedOpportunityIds} stateCode={stateCode} />
              </>
            )}

            <div className="dashboard-section-label"><div><span className="kicker">CASH ALLOCATION LAB</span><h2>Compare where uncommitted cash can work next.</h2></div><p>This section is a planning view. It never moves money and it does not override an active reward commitment.</p></div>
            <PlanDashboard profile={typedProfile} opportunities={typedOpportunities} stateCode={stateCode} />
          </>
        ) : (
          <section className="empty-plan"><h2>Build your first plan</h2><p>Answer a few questions so Churning can calculate your cash baseline, rank opportunities, and build accurate reward trackers.</p><Link className="button primary" href="/questionnaire">Start questionnaire</Link></section>
        )}
      </div>
    </main>
  );
}
