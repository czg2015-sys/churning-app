"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowUpRight, Search } from "lucide-react";
import { offerResearchStatus } from "@/lib/offer-research";
import { preliminarilyFits } from "@/lib/offer-matching";
import { AddToPlanButton } from "@/components/add-to-plan-button";
import { money, numberValue, rankMatches } from "@/lib/plan-math";
import type { AccountHistory, FinancialProfile, Mission, Opportunity } from "@/lib/types";

function dateLabel(value?: string | null) {
  if (!value) return "Not confirmed";
  const date = new Date(value.slice(0, 10) + "T12:00:00Z");
  return Number.isFinite(date.getTime()) ? new Intl.DateTimeFormat("en-US", {month:"short",day:"numeric",year:"numeric",timeZone:"UTC"}).format(date) : "Not confirmed";
}
function requirement(item: Opportunity) {
  const monthly = numberValue(item.reward_monthly_dd_threshold);
  if (monthly > 0) return `${money.format(monthly)} in qualifying deposits each month`;
  const dd = numberValue(item.direct_deposit_required);
  if (dd > 0) return `${money.format(dd)} in qualifying direct deposits${item.dd_deposit_count ? ` across at least ${item.dd_deposit_count} deposits` : ""}${item.dd_min_each ? `, at least ${money.format(numberValue(item.dd_min_each))} each` : ""}`;
  const cash = Math.max(numberValue(item.required_balance), numberValue(item.min_opening_deposit));
  if (cash > 0) return `${money.format(cash)} deposit / balance requirement`;
  if (item.purchase_count) return `${item.purchase_count} qualifying purchases${item.purchase_min_amount ? ` of at least ${money.format(numberValue(item.purchase_min_amount))} each` : ""}`;
  if (item.purchase_required_spend) return `${money.format(numberValue(item.purchase_required_spend))} qualifying spending`;
  return "Check the bank’s minimum deposit and requirements";
}
const categories = [
  ["all", "All offers"], ["checking_bonus", "Paycheck & checking"], ["savings_bonus", "Savings bonuses"],
  ["hysa", "High-yield savings"], ["debit_spend", "Debit rewards"], ["other", "Other offers"],
] as const;
const mainCategories = new Set(["checking_bonus", "savings_bonus", "hysa", "debit_spend"]);
export function OpportunityLibraryV2({ opportunities, profile, usedBanks = [], stateCode, accountHistory = [], missions = [] }: {
  opportunities: Opportunity[]; profile?: FinancialProfile | null; usedBanks?: string[]; stateCode?: string | null;
  accountHistory?: AccountHistory[]; missions?: Mission[];
}) {
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [fitOnly, setFitOnly] = useState(false);
  const [sort, setSort] = useState("bank");
  const ranked = useMemo(() => profile ? rankMatches(opportunities, profile, usedBanks, stateCode) : [], [opportunities, profile, usedBanks, stateCode]);
  const rankedById = useMemo(() => new Map(ranked.map(row => [row.item.id, row])), [ranked]);
  const activeIds = useMemo(() => new Set(missions.filter(m => !["complete", "cancelled"].includes(m.status)).map(m => m.opportunity_id).filter((id): id is string => Boolean(id))), [missions]);
  const visible = opportunities.filter(item => {
    const term = search.trim().toLowerCase();
    return (!term || `${item.institution} ${item.product_name}`.toLowerCase().includes(term))
      && (category === "all" || (category === "other" ? !mainCategories.has(item.category) : item.category === category))
      && (!fitOnly || preliminarilyFits(rankedById.get(item.id), accountHistory, activeIds));
  }).sort((a,b) => sort === "bonus" ? numberValue(b.bonus_amount)-numberValue(a.bonus_amount)
    : sort === "apy" ? numberValue(b.apy)-numberValue(a.apy)
    : sort === "verified" ? (b.last_verified_at || "").localeCompare(a.last_verified_at || "")
    : a.institution.localeCompare(b.institution));
  return <div className="opportunity-library-v2">
    <div className="offer-toolbar">
      <label className="offer-search"><Search size={18}/><span className="sr-only">Search banks and offers</span><input type="search" placeholder="Search banks or offers" value={search} onChange={e => setSearch(e.target.value)}/></label>
      <label>Sort by<select value={sort} onChange={e => setSort(e.target.value)}><option value="bank">Bank name</option><option value="bonus">Bonus amount</option><option value="apy">Savings APY</option><option value="verified">Recently verified</option></select></label>
      {profile ? <label className="fit-toggle"><input type="checkbox" checked={fitOnly} onChange={e => setFitOnly(e.target.checked)}/> Fits my profile</label> : null}
    </div>
    <div className="offer-category-tabs" aria-label="Offer categories">{categories.map(([id,label]) => <button type="button" key={id} aria-pressed={category===id} onClick={() => setCategory(id)}>{label}</button>)}</div>
    <p className="offer-results" role="status">{visible.length} offer{visible.length === 1 ? "" : "s"} · {fitOnly ? "Preliminary matches, not guaranteed eligibility. Already tracked offers stay in My Plan." : "All offers shown, including banks you already track. Open details to check eligibility."}</p>
    {!visible.length ? <div className="disclaimer">No offers match these filters. <button type="button" onClick={() => {setSearch("");setCategory("all");setFitOnly(false);}}>Clear filters</button></div> : null}
    <div className="library-card-grid">{visible.map(item => {
      const result = rankedById.get(item.id);
      const {cleared, expired, label} = offerResearchStatus(item);
      const tracked = activeIds.has(item.id);
      return <article className="library-offer-card" key={item.id}>
        <div className="library-offer-top"><div><small>{item.institution}</small><strong>{item.product_name}</strong></div><span className={`library-safety ${cleared ? "clear" : "hold"}`}>{label}</span></div>
        <div className="offer-headline">{numberValue(item.bonus_amount)>0 ? money.format(numberValue(item.bonus_amount)) + " bonus" : `${numberValue(item.apy).toFixed(2)}% APY`}</div>
        <dl className="offer-facts">
          <div><dt>What you need</dt><dd>{requirement(item)}</dd></div>
          <div><dt>Time to qualify</dt><dd>{item.direct_deposit_window_days || item.qualification_days ? `${item.direct_deposit_window_days || item.qualification_days} days · check when the clock starts` : "Check official terms"}</dd></div>
          <div><dt>Monthly fee</dt><dd>{item.monthly_fee == null ? "Not confirmed" : `${money.format(numberValue(item.monthly_fee))}${item.fee_waiver_summary ? " · waiver available" : ""}`}</dd></div>
          <div><dt>Apply by</dt><dd>{dateLabel(item.expires_at)}</dd></div>
          <div><dt>Last verified</dt><dd>{dateLabel(item.last_verified_at)}</dd></div>
        </dl>
        <details className="offer-details"><summary>Requirements, eligibility & details</summary>
          <p>{item.terms_summary || "Full requirements have not been recorded. Read the official bank terms."}</p>
          <p><strong>Who can qualify:</strong> {item.eligibility_notes || "Eligibility is not fully confirmed."} {item.state_scope ? `Availability: ${item.state_scope}.` : ""}</p>
          <p><strong>Fee waiver:</strong> {item.fee_waiver_summary || "Not confirmed."}</p>
          <p><strong>Payout:</strong> {item.payout_days ? `Stored payout window: ${item.payout_days} days after the bank’s qualifying event. Confirm the trigger in the terms.` : "Payout timing not confirmed."}</p>
          <p><strong>Before closing:</strong> {item.keep_guidance || "Check minimum account age and bonus repayment rules."}</p>
          {result ? <p><strong>Your estimated extra value:</strong> {money.format(profile?.tax_rate_known ? result.estimatedAfterTaxAdvantage : result.grossAdvantage)} {profile?.tax_rate_known ? "after estimated tax" : "before tax"}. An estimate, not a promised reward.</p> : null}
          {!cleared ? <p>Some terms need review or a fresh check. Saving an offer does not confirm that you qualify.</p> : null}
        </details>
        <div className="library-offer-footer"><div>{tracked ? <Link href="/my-plan#my-accounts">In My Plan · update progress</Link> : profile ? <AddToPlanButton opportunity={item} compact allowPlanningOnHold disabledReason={expired ? "Application deadline passed. Check for a renewed offer." : undefined}/> : <Link href="/auth?next=/my-plan">Sign in to save</Link>}</div><a href={item.official_url} target="_blank" rel="noreferrer">Bank terms <ArrowUpRight size={12}/></a></div>
      </article>;
    })}</div>
  </div>;
}
