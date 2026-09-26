import type { Metadata } from "next";
import { LibraryBig, ShieldCheck } from "lucide-react";
import { OpportunityLibraryV2 } from "@/components/opportunity-library-v2";
import { getLiveOpportunities } from "@/lib/opportunities";
import { createClient } from "@/lib/supabase/server";
import type { FinancialProfile } from "@/lib/types";

export const metadata: Metadata = { title: "Opportunities" };
export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const { opportunities, dataAvailable } = await getLiveOpportunities();
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let profile: FinancialProfile | null = null;
  let usedBanks: string[] = [];
  let stateCode: string | null = null;

  if (userId) {
    const [{ data: financial }, { data: history }, { data: userProfile }] = await Promise.all([
      supabase.from("financial_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("account_history").select("institution").eq("user_id", userId),
      supabase.from("profiles").select("state_code").eq("user_id", userId).maybeSingle(),
    ]);
    profile = (financial as FinancialProfile | null) || null;
    usedBanks = Array.from(new Set(((history || []) as Array<{ institution: string }>).map((row) => row.institution).filter(Boolean)));
    stateCode = userProfile?.state_code || null;
  }

  return (
    <main className="page-shell opportunity-library-page">
      <div className="shell">
        <div className="opportunity-library-v2-head">
          <div>
            <span className="kicker">OPPORTUNITY LIBRARY</span>
            <h1>Browse the building blocks. My Plan does the choosing.</h1>
            <p>{profile ? "These options are ranked against your cash, APY, paycheck, spending, bank history, and strategy preference." : "Sign in and complete Start Here to turn this research library into a personalized ranking."} An attractive headline does not become actionable until the research gate passes.</p>
          </div>
          <div className="library-purpose"><LibraryBig size={18} /><span><strong>What this page is for</strong><small>Compare alternatives and understand the requirements. Your personalized allocation lives in My Plan.</small></span></div>
        </div>

        <div className="opportunity-lane-guide">
          <div><span>01 · DD</span><strong>Paycheck bonuses</strong><small>Match the offer to what your real payroll can satisfy.</small></div>
          <div><span>02 · HYSA</span><strong>Liquid savings</strong><small>Compare incremental interest against your current APY.</small></div>
          <div><span>03 · BONUS</span><strong>Cash-funded offers</strong><small>Subtract the interest you give up while cash is tied up.</small></div>
          <div><span>04 · SPENDING</span><strong>Optional debit rewards</strong><small>Only use purchases you already planned to make.</small></div>
        </div>

        {!dataAvailable ? <div className="disclaimer"><strong>The live offer feed could not be loaded.</strong> Churning will not silently replace it with stale data.</div> : null}
        <OpportunityLibraryV2 opportunities={opportunities} profile={profile} usedBanks={usedBanks} stateCode={stateCode} />
        <div className="disclaimer"><ShieldCheck size={14} /> <strong>Research gate stays separate from ranking.</strong> A #1 profit or #1 ease label is not permission to open the account. Re-check current official terms, screening, tax, insurance, and close rules immediately before acting.</div>
      </div>
    </main>
  );
}
