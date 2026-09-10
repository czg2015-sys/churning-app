import type { Metadata } from "next";
import { OpportunitiesList } from "@/components/opportunities-list";
import { getLiveOpportunities } from "@/lib/opportunities";

export const metadata: Metadata = { title: "Opportunities" };

export default async function OpportunitiesPage() {
  const { opportunities, dataAvailable } = await getLiveOpportunities();

  return (
    <main className="page-shell">
      <div className="shell">
        <div className="page-heading">
          <div><span className="kicker">OPPORTUNITIES</span><h1>Compare the real tradeoffs.</h1><p>Profit matters, but so do the deposit requirement, time window, effort, liquidity, and confidence in the offer details.</p></div>
        </div>
        {!dataAvailable && <div className="disclaimer"><strong>Live offers are temporarily unavailable.</strong> The rest of Churning remains available while the data connection recovers.</div>}
        <OpportunitiesList opportunities={opportunities} />
        <div className="disclaimer"><strong>Review before acting.</strong> Rates and promotions change. “Confidence” describes how complete the stored research is—not a guarantee of approval, payout, or safety.</div>
      </div>
    </main>
  );
}
