import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
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

  const [{ data: profile }, { data: opportunities }, { data: missions }, { data: bankHistory }] = await Promise.all([
    supabase.from("financial_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("opportunities").select("*").eq("offer_status", "live"),
    supabase.from("missions").select("*, mission_steps(*), opportunity:opportunities(*)").eq("user_id", userId).order("created_at", { ascending: false }),
    supabase.from("account_history").select("institution").eq("user_id", userId),
  ]);

  return (
    <main className="page-shell">
      <div className="shell">
        <div className="page-heading">
          <div><span className="kicker">MY PLAN</span><h1>Your reward command center.</h1><p>Track qualification windows, requirements, payouts, account fees, and the earliest date to review whether an account should stay open.</p></div>
          <div style={{ display: "flex", gap: 10 }}><Link className="button ghost" href="/opportunities">Find rewards</Link><Link className="button ghost" href="/questionnaire">Update numbers</Link><SignOutButton /></div>
        </div>
        {profile ? (
          <>
            <RewardTracker missions={(missions || []) as Mission[]} />
            <RecommendedOpportunities profile={profile as FinancialProfile} opportunities={(opportunities || []) as Opportunity[]} usedBanks={(bankHistory || []).map((row) => row.institution)} />
            <div className="dashboard-section-label"><span className="kicker">RECOMMENDED CASH SPLIT</span><p>Compare what to do with the cash that is not already committed to an active reward.</p></div>
            <PlanDashboard profile={profile as FinancialProfile} opportunities={(opportunities || []) as Opportunity[]} />
          </>
        ) : (
          <section className="empty-plan"><h2>Build your first plan</h2><p>Answer a few questions so we can calculate your cash split, rank opportunities, and start tracking rewards.</p><Link className="button primary" href="/questionnaire">Start questionnaire</Link></section>
        )}
      </div>
    </main>
  );
}
