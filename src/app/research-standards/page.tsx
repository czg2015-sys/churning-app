import type { Metadata } from "next";
import { ShieldCheck } from "lucide-react";

export const metadata: Metadata = { title: "Research & Risk" };

const checks = [
  ["Official offer terms", "We start with the bank or issuer’s current public offer page whenever one is available."],
  ["Credit impact", "For credit cards, we separate application/credit-review risk from deposit-account screening. Unknowns stay labeled as unknown."],
  ["Deposit screening", "For checking and savings accounts, we track ChexSystems and Early Warning information when it can be verified."],
  ["Taxes", "We track whether bonus or interest reporting is stated in official terms and avoid guessing when treatment is unclear."],
  ["Deposit protection", "Deposit products are checked for FDIC, NCUA, or other relevant protection structure. Credit cards are not deposit products."],
  ["Fees and waivers", "Monthly fees, annual fees, minimum balances, and known waiver paths are included in the comparison."],
  ["Closing and clawbacks", "We track minimum-open periods, payout timing, restrictions, and known clawback language before suggesting a closure review date."],
  ["Freshness", "Offer terms can change. Each opportunity keeps a checked date and can be moved back to review when terms change or research gets stale."],
];

export default function ResearchStandardsPage() {
  return (
    <main className="page-shell">
      <div className="shell">
        <section className="recommendations-shell recommendations-prominent">
          <div className="recommendations-head">
            <div>
              <span className="kicker">RESEARCH & RISK</span>
              <h1>See what Churning checks before an offer is treated as ready.</h1>
              <p>Big advertised numbers are not enough. We separate offer value from research confidence so you can see when something still needs review.</p>
            </div>
          </div>

          <div className="research-standard">
            <div className="research-standard-head">
              <div><span>OUR CHECKLIST</span><h3>What gets reviewed.</h3></div>
              <p>Research status is not a guarantee of approval, eligibility, or future terms.</p>
            </div>
            <div className="research-standard-grid">
              {checks.map(([title, copy]) => <div key={title}><strong>{title}</strong><span>{copy}</span></div>)}
            </div>
            <div className="recommendation-intro-strip">
              <div><ShieldCheck size={17} /><span><b>Research Verified</b><small>Required checks are current enough for the product to be shown as cleared.</small></span></div>
              <div><ShieldCheck size={17} /><span><b>Needs review</b><small>The offer may still be visible for comparison, but unresolved research is called out before you add or act on it.</small></span></div>
              <div><ShieldCheck size={17} /><span><b>You stay in control</b><small>Churning never opens, closes, or moves money between accounts for you.</small></span></div>
            </div>
            <p className="research-disclaimer">Churning is an educational comparison and tracking tool, not financial, tax, legal, or credit advice. Institutions control approval, eligibility, rates, fees, and reward terms.</p>
          </div>
        </section>
      </div>
    </main>
  );
}
