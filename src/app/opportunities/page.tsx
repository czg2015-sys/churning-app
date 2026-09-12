import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";
import { OpportunitiesList } from "@/components/opportunities-list";
import { getLiveOpportunities } from "@/lib/opportunities";

export const metadata: Metadata = { title: "Opportunities" };

export default async function OpportunitiesPage() {
  const { opportunities, dataAvailable } = await getLiveOpportunities();

  return (
    <main className="page-shell opportunity-library-page">
      <div className="shell">
        <div className="page-heading opportunity-library-heading">
          <div><span className="kicker">OPPORTUNITY RESEARCH LIBRARY</span><h1>See the offer—and the evidence state behind it.</h1><p>This library separates “live in the database” from “cleared to recommend.” Churning only enables Add to My Plan when the stored safety gate passes and research confidence is at least 80/100.</p></div>
          <div className="research-principle"><ShieldCheck size={18} /><span><b>No safety shortcut</b><small>A high advertised bonus does not override weak or stale research.</small></span></div>
        </div>
        {!dataAvailable && <div className="disclaimer"><strong>Live offers are temporarily unavailable.</strong> The rest of Churning remains available while the data connection recovers.</div>}
        <OpportunitiesList opportunities={opportunities} />
        <div className="disclaimer"><strong>Review immediately before acting.</strong> Rates, eligibility windows, inquiry behavior, screening systems, fees, and closure rules can change. Research confidence is a completeness signal—not a guarantee of approval or payout.</div>
      </div>
    </main>
  );
}
