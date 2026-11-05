import { getPublicResearchStatus } from "@/lib/research/public-status";
import type { Metadata } from "next";
import { LibraryBig, ShieldCheck } from "lucide-react";
import { OpportunityLibraryV2 } from "@/components/opportunity-library-v2";
import { getLiveOpportunities } from "@/lib/opportunities";
import { createClient } from "@/lib/supabase/server";
import type { AccountHistory, FinancialProfile, Mission } from "@/lib/types";

export const metadata: Metadata = { title: "Opportunities" };
export const dynamic = "force-dynamic";

export default async function OpportunitiesPage() {
  const [{ opportunities, dataAvailable }, research] = await Promise.all([getLiveOpportunities(), getPublicResearchStatus()]);
  const supabase = await createClient();
  const { data: claimsData } = await supabase.auth.getClaims();
  const userId = claimsData?.claims?.sub;

  let profile: FinancialProfile | null = null;
  let usedBanks: string[] = [];
  let accountHistory: AccountHistory[] = [];
  let missions: Mission[] = [];
  let stateCode: string | null = null;

  if (userId) {
    const [{ data: financial }, { data: history }, { data: userProfile }, { data: missionRows }] = await Promise.all([
      supabase.from("financial_profiles").select("*").eq("user_id", userId).maybeSingle(),
      supabase.from("account_history").select("*").eq("user_id", userId),
      supabase.from("profiles").select("state_code").eq("user_id", userId).maybeSingle(),
      supabase.from("missions").select("*, mission_steps(*), opportunity:opportunities(*)").eq("user_id", userId),
    ]);
    profile = (financial as FinancialProfile | null) || null;
    accountHistory = (history || []) as AccountHistory[];
    missions = (missionRows || []) as Mission[];
    usedBanks = Array.from(new Set(accountHistory.map((row) => row.institution).filter(Boolean)));
    stateCode = userProfile?.state_code || null;
  }

  return (
    <main className="page-shell opportunity-library-page">
      <div className="shell">
        <div className="opportunity-library-v2-head">
          <div>
            <span className="kicker">OPPORTUNITY LIBRARY</span>
            <h1>Find your next bank bonus.</h1>
            <p>{profile ? "Browse all offers, or filter using your saved profile." : "Browse without an account. Sign in to save an offer and track your progress."} Check the requirements and research date before opening an account.</p>
          </div>
          <div className="library-purpose"><LibraryBig size={18} /><span><strong>What this page is for</strong><small>Explore here. Track your accounts and update deposits in My Plan.</small></span></div>
        </div>

        <div className="research-status-strip">
          <strong>Research activity</strong>
          <p>{research?.checkedAt ? `Latest monitoring run: ${new Date(research.checkedAt).toLocaleString("en-US", {timeZone:"America/Los_Angeles",dateStyle:"medium",timeStyle:"short"})} Pacific · ${research.checked} offers checked · ${research.blocked} pages blocked or unavailable · ${research.monitorStatus}.` : "Research run status is unavailable. Check each offer’s verification date."}</p>
          {research?.discoveredAt ? <p>Latest discovery: {new Date(research.discoveredAt).toLocaleDateString("en-US", {timeZone:"America/Los_Angeles"})} · {research.candidates} new candidates{research.discoveryPartial ? " · some sources unavailable" : ""}.</p> : null}
          <p>A scan is not a full verification. New candidates are reviewed before being published here; existing offers keep their own verification dates.</p>
        </div>
        {!dataAvailable ? <div className="disclaimer"><strong>The live offer feed could not be loaded.</strong> Churning will not silently replace it with stale data.</div> : null}
        <OpportunityLibraryV2 opportunities={opportunities} profile={profile} usedBanks={usedBanks} stateCode={stateCode} accountHistory={accountHistory} missions={missions} />
        <div className="disclaimer"><ShieldCheck size={14} /> <strong>Check the official bank terms.</strong> An estimated match is not a guarantee of eligibility or payment. Research dates and missing terms are shown for each offer.</div>
      </div>
    </main>
  );
}
