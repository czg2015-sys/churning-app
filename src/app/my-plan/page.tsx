import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowUpRight, CreditCard, Settings2 } from "lucide-react";
import { PlanStrategyHub } from "@/components/plan-strategy-hub";
import { RewardTracker } from "@/components/reward-tracker";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import type { AccountHistory, FinancialProfile, Mission, Opportunity } from "@/lib/types";

export const metadata: Metadata = { title: "My Plan" };
export const dynamic = "force-dynamic";

export default async function MyPlanPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/auth");

  const [{ data: profile }, { data: opportunities }, { data: missions }, { data: bankHistory }, { data: userProfile }] = await Promise.all([
    supabase.from("financial_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("opportunities").select("*, opportunity_reviews(*)").eq("offer_status", "live"),
    supabase.from("missions").select("*, mission_steps(*), opportunity:opportunities(*, opportunity_reviews(*))").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("account_history").select("*").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("profiles").select("state_code").eq("user_id", userId).maybeSingle(),
  ]);

  if (!profile) redirect("/questionnaire");

  const typedProfile = profile as FinancialProfile;
  const typedOpportunities = (opportunities || []) as Opportunity[];
  const typedMissions = (missions || []) as Mission[];
  const typedHistory = (bankHistory || []) as AccountHistory[];
  const usedBanks = Array.from(new Set(typedHistory.map((row) => row.institution).filter((bank): bank is string => Boolean(bank))));
  const addedOpportunityIds = typedMissions
    .filter((mission) => !["complete", "cancelled"].includes(mission.status))
    .map((mission) => mission.opportunity_id)
    .filter((id): id is string => Boolean(id));
  const stateCode = userProfile?.state_code || "CA";

  return (
    <main className="page-shell my-plan-page">
      <div className="shell">
        <div className="plan-topbar">
          <div><span className="workspace-dot" /> My Plan · saved to your account</div>
          <div className="plan-topbar-actions">
            <Link href="/opportunities">Compare all options <ArrowUpRight size={13} /></Link>
            {typedProfile.card_helper_opt_in ? <Link href="/cards"><CreditCard size={14} /> Cards & Spending</Link> : null}
            <Link href="/questionnaire"><Settings2 size={14} /> Update answers</Link>
            <SignOutButton />
          </div>
        </div>

        <PlanStrategyHub
          profile={typedProfile}
          opportunities={typedOpportunities}
          missions={typedMissions}
          usedBanks={usedBanks}
          stateCode={stateCode}
          addedOpportunityIds={addedOpportunityIds}
        />

        <div className="my-plan-tracker-heading">
          <span className="kicker">ACTIVE ACCOUNT CHECKLISTS</span>
          <h2>Once you actually start an offer, track every requirement here.</h2>
          <p>Your plan above decides what fits. The tracker below handles the real account, progress, payout timing, quick-access link, and safe-close review.</p>
        </div>
        <RewardTracker missions={typedMissions} />
      </div>
    </main>
  );
}
