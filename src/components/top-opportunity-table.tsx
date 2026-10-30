"use client";

import Link from "next/link";
import { ArrowUpRight, ChevronDown, ListFilter, AlertTriangle } from "lucide-react";
import { AddToPlanButton } from "@/components/add-to-plan-button";
import { availabilityWarnings, hasReceivedBankBonus, isTracking } from "@/lib/plan-availability";
import { money, numberValue, rankMatches } from "@/lib/plan-math";
import type { AccountHistory, FinancialProfile, Mission, Opportunity } from "@/lib/types";

const categories = [
  { id: "hysa", label: "High-yield savings", subtitle: "Rates vs your current HYSA" },
  { id: "dd", label: "Direct deposit", subtitle: "Paycheck requirements" },
  { id: "checking", label: "Checking bonuses", subtitle: "Account-opening rewards" },
  { id: "savings", label: "Savings bonuses", subtitle: "Balance + hold requirements" },
  { id: "spending", label: "Debit spending", subtitle: "Your normal purchases" },
] as const;

function belongs(item: Opportunity, category: typeof categories[number]["id"]) {
  if (category === "hysa") return item.category === "hysa";
  if (category === "dd") return item.category === "checking_bonus" && numberValue(item.direct_deposit_required) > 0;
  if (category === "checking") return item.category === "checking_bonus";
  if (category === "savings") return item.category === "savings_bonus";
  return item.category === "debit_spend";
}

export function TopOpportunityTable({
  opportunities,
  profile,
  usedBanks = [],
  history = [],
  missions = [],
  stateCode,
  heading = "See the top opportunities.",
}: {
  opportunities: Opportunity[];
  profile?: FinancialProfile | null;
  usedBanks?: string[];
  history?: AccountHistory[];
  missions?: Mission[];
  stateCode?: string | null;
  heading?: string;
}) {
  const ranked = profile ? rankMatches(opportunities, profile, usedBanks, stateCode) : [];
  const matchingById = new Map(ranked.map((candidate) => [candidate.item.id, candidate]));
  return (
    <section className="top-opportunities-table" id="benefit-rankings">
      <div className="top-opportunities-heading">
        <div><span className="kicker">OPPORTUNITY RANKINGS</span><h2>{heading}</h2><p>Open a category to see up to ten options. These are comparisons, not instructions to open accounts.</p></div>
        <Link href="/opportunities">View all benefits <ArrowUpRight size={14} /></Link>
      </div>
      <div className="top-opportunity-rows">
        {categories.map((category) => {
          const options = opportunities.filter((item) => item.offer_status === "live" && belongs(item, category.id) && !hasReceivedBankBonus(item, history, missions));
          const ordered = [...options].sort((a, b) => {
            const am = matchingById.get(a.id);
            const bm = matchingById.get(b.id);
            if (am && bm) return Number(bm.safetyPassed) - Number(am.safetyPassed) || bm.score - am.score;
            return Number(b.safety_gate === "green") - Number(a.safety_gate === "green")
              || numberValue(b.evidence_confidence) - numberValue(a.evidence_confidence)
              || (category.id === "hysa" ? numberValue(b.apy) - numberValue(a.apy) : numberValue(b.bonus_amount) - numberValue(a.bonus_amount));
          }).slice(0, 10);
          return (
            <details className="top-opportunity-category" key={category.id}>
              <summary><span className="top-category-icon"><ListFilter size={14}/></span><span><strong>{category.label}</strong><small>{category.subtitle}</small></span><em>{ordered.length} options</em><ChevronDown size={15}/></summary>
              {ordered.length ? (
                <div className="top-opportunity-scroll">
                  <table><thead><tr><th>Rank</th><th>Institution</th><th>Offer</th><th>Value</th><th>Research</th><th>My Plan</th><th>Terms</th></tr></thead>
                  <tbody>{ordered.map((item, index) => {
                    const fit = matchingById.get(item.id);
                    const bonus = numberValue(item.bonus_amount);
                    const warnings = profile ? availabilityWarnings(item, profile, missions, history) : [];
                    const tracked = isTracking(item, missions);
                    const blocker = warnings.length > 0 ? warnings.join(" ") : undefined;
                    const value = category.id === "hysa" ? numberValue(item.apy).toFixed(2) + "% APY" : bonus > 0 ? money.format(bonus) : numberValue(item.apy) > 0 ? numberValue(item.apy).toFixed(2) + "% APY" : "Details";
                    return <tr key={item.id}>
                      <td>#{index + 1}</td>
                      <td>{item.institution}</td>
                      <td>{item.product_name}{warnings.length ? <div className="top-fit-warning"><AlertTriangle size={13} /><span>{warnings.join(" ")}</span></div> : null}</td>
                      <td>{value}</td>
                      <td><span className={`top-research-tag ${fit?.safetyPassed || item.safety_gate === "green" ? "green" : "hold"}`}>{fit?.safetyPassed ? "Cleared" : "Check terms"}</span></td>
                      <td>{profile ? <AddToPlanButton opportunity={item} compact alreadyAdded={tracked} allowPlanningOnHold disabledReason={blocker} /> : <Link href="/auth?next=/my-plan">Sign in to add</Link>}</td>
                      <td><a href={item.official_url} target="_blank" rel="noreferrer" aria-label={"Official terms for " + item.institution}><ArrowUpRight size={13}/></a></td>
                    </tr>;
                  })}</tbody></table>
                </div>
              ) : <div className="top-opportunity-empty">No current verified listings in this category.</div>}
            </details>
          );
        })}
      </div>
      <p className="top-ranking-note">Rankings use the available research data. Rates, deadlines, and eligibility can change. HOLD candidates remain on HOLD even when they rank highly.</p>
    </section>
  );
}
