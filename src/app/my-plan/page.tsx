import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { PlanDashboard } from "@/components/plan-dashboard";
import { SignOutButton } from "@/components/sign-out-button";
import { createClient } from "@/lib/supabase/server";
import type { FinancialProfile, Opportunity } from "@/lib/types";

export const metadata: Metadata = { title: "My Plan" };

export default async function MyPlanPage() {
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;
  if (!userId) redirect("/auth?next=/my-plan");
  const [{ data: profile }, { data: opportunities }] = await Promise.all([
    supabase.from("financial_profiles").select("*").eq("user_id", userId).maybeSingle(),
    supabase.from("opportunities").select("*").eq("offer_status", "live"),
  ]);

  return (
    <main className="page-shell">
      <div className="shell">
        <div className="page-heading">
          <div><span className="kicker">MY PLAN</span><h1>Your money map.</h1><p>Change any dropdown to compare your best-fitting options without rebuilding the whole plan.</p></div>
          <div style={{ display: "flex", gap: 10 }}><Link className="button ghost" href="/questionnaire">Update numbers</Link><SignOutButton /></div>
        </div>
        {profile ? <PlanDashboard profile={profile as FinancialProfile} opportunities={(opportunities || []) as Opportunity[]} /> : (
          <section className="empty-plan"><h2>Build your first plan</h2><p>Answer a few questions so we can calculate your cash split and rank the right opportunities.</p><Link className="button primary" href="/questionnaire">Start questionnaire</Link></section>
        )}
      </div>
    </main>
  );
}
