"use client";

import { useMemo } from "react";
import { ArrowUpRight, ShieldAlert, ShieldCheck } from "lucide-react";
import { AddToPlanButton } from "@/components/add-to-plan-button";
import { money, numberValue, rankMatches } from "@/lib/plan-math";
import type { FinancialProfile, Opportunity } from "@/lib/types";

type RankedMatch = ReturnType<typeof rankMatches>[number];
type SortMode = "overall" | "profit" | "ease" | "liquidity";

type Lane = {
  id: string;
  eyebrow: string;
  title: string;
  subtitle: string;
  items: Opportunity[];
};

function profitValue(result: RankedMatch, profile: FinancialProfile) {
  return profile.tax_rate_known ? result.estimatedAfterTaxAdvantage : result.grossAdvantage;
}

function easeValue(result: RankedMatch) {
  return (6 - Math.min(5, Math.max(1, result.effort))) * 18
    + result.liquidity * 0.35
    + result.cashFit * 0.12
    + result.ddFit * 0.12
    + result.spendFit * 0.08
    + (result.safetyPassed ? 12 : 0);
}

function sortRanked(items: RankedMatch[], mode: SortMode, profile: FinancialProfile) {
  return [...items].sort((a, b) => {
    if (mode === "profit") return profitValue(b, profile) - profitValue(a, profile) || b.score - a.score;
    if (mode === "ease") return easeValue(b) - easeValue(a) || b.score - a.score;
    if (mode === "liquidity") return b.liquidity - a.liquidity || easeValue(b) - easeValue(a);
    return b.score - a.score;
  });
}

function requirementText(item: Opportunity) {
  const dd = numberValue(item.direct_deposit_required);
  const cash = Math.max(numberValue(item.required_balance), numberValue(item.min_opening_deposit));
  const spend = Math.max(numberValue(item.purchase_required_spend), Number(item.purchase_count || 0) * numberValue(item.purchase_min_amount));
  if (dd > 0) return `${money.format(dd)} qualifying direct deposit${item.dd_deposit_count ? ` · ${item.dd_deposit_count} deposit${item.dd_deposit_count === 1 ? "" : "s"}` : ""}${item.direct_deposit_window_days ? ` · ${item.direct_deposit_window_days} days` : ""}`;
  if (cash > 0) return `${money.format(cash)} cash requirement${item.qualification_days ? ` · ${item.qualification_days} days` : ""}`;
  if (spend > 0) return `${money.format(spend)} normal spend${item.spend_window_days || item.qualification_days ? ` · ${item.spend_window_days || item.qualification_days} days` : ""}`;
  if (Number(item.purchase_count || 0) > 0) return `${item.purchase_count} qualifying purchases`;
  return "No large cash requirement stored";
}

function opportunityValue(item: Opportunity) {
  const bonus = numberValue(item.bonus_amount);
  return bonus > 0 ? money.format(bonus) : `${numberValue(item.apy).toFixed(2)}% APY`;
}

function genericCleared(item: Opportunity) {
  return ["green", "pass"].includes(String(item.safety_gate || "").toLowerCase()) && numberValue(item.evidence_confidence) >= 80;
}

function rankMap(items: RankedMatch[], mode: SortMode, profile: FinancialProfile) {
  return new Map(sortRanked(items, mode, profile).map((result, index) => [result.item.id, index + 1]));
}

export function OpportunityLibraryV2({
  opportunities,
  profile,
  usedBanks = [],
  stateCode,
}: {
  opportunities: Opportunity[];
  profile?: FinancialProfile | null;
  usedBanks?: string[];
  stateCode?: string | null;
}) {
  const ranked = useMemo(() => profile ? rankMatches(opportunities, profile, usedBanks, stateCode) : [], [opportunities, profile, usedBanks, stateCode]);
  const rankedById = useMemo(() => new Map(ranked.map((result) => [result.item.id, result])), [ranked]);

  const lanes: Lane[] = [
    { id: "dd", eyebrow: "DIRECT DEPOSIT", title: "Paycheck bonuses", subtitle: "Offers that ask you to route legitimate payroll or another qualifying deposit.", items: opportunities.filter((item) => item.category === "checking_bonus" && numberValue(item.direct_deposit_required) > 0) },
    { id: "hysa", eyebrow: "SAVINGS / HYSA", title: "High-yield savings", subtitle: "Rate options compared against the APY you already earn—not against zero.", items: opportunities.filter((item) => item.category === "hysa") },
    { id: "bonus", eyebrow: "CASH BONUS", title: "Cash-funded bonuses", subtitle: "Offers where money is parked to earn a bonus; opportunity cost matters here.", items: opportunities.filter((item) => item.category === "savings_bonus") },
    { id: "spending", eyebrow: "OPTIONAL SPENDING", title: "Debit & spending rewards", subtitle: "Only for normal purchases you already planned. No manufactured spending.", items: opportunities.filter((item) => item.category === "debit_spend") },
  ].filter((lane) => lane.items.length > 0);

  return (
    <div className="opportunity-library-v2">
      {lanes.map((lane) => {
        const laneRanked = lane.items.map((item) => rankedById.get(item.id)).filter((item): item is RankedMatch => Boolean(item));
        const overallRanks = profile ? rankMap(laneRanked, "overall", profile) : new Map<string, number>();
        const profitRanks = profile ? rankMap(laneRanked, "profit", profile) : new Map<string, number>();
        const easeRanks = profile ? rankMap(laneRanked, "ease", profile) : new Map<string, number>();
        const ordered = profile
          ? sortRanked(laneRanked, profile.ranking_preference === "profit" ? "profit" : profile.ranking_preference === "ease" ? "ease" : profile.ranking_preference === "liquidity" ? "liquidity" : "overall", profile).map((result) => result.item)
          : [...lane.items].sort((a, b) => Number(genericCleared(b)) - Number(genericCleared(a)) || numberValue(b.evidence_confidence) - numberValue(a.evidence_confidence) || numberValue(b.bonus_amount) - numberValue(a.bonus_amount));

        return (
          <section className="library-lane" key={lane.id}>
            <div className="library-lane-head">
              <div><small>{lane.eyebrow}</small><h2>{lane.title}</h2><p>{lane.subtitle}</p></div>
              <span>{ordered.length} live option{ordered.length === 1 ? "" : "s"}</span>
            </div>
            <div className="library-card-grid">
              {ordered.map((item) => {
                const result = rankedById.get(item.id);
                const cleared = result ? result.safetyPassed : genericCleared(item);
                const profit = result && profile ? profitValue(result, profile) : null;
                return (
                  <article className="library-offer-card" key={item.id}>
                    <div className="library-offer-top">
                      <div><small>{item.institution}</small><strong>{item.product_name}</strong></div>
                      <span className={`library-safety ${cleared ? "clear" : "hold"}`}>{cleared ? <ShieldCheck size={12} /> : <ShieldAlert size={12} />}{cleared ? "Cleared" : "Hold"}</span>
                    </div>
                    {result && profile ? (
                      <div className="library-rank-tags">
                        <span>#{overallRanks.get(item.id)} overall</span>
                        <span>#{profitRanks.get(item.id)} profit</span>
                        <span>#{easeRanks.get(item.id)} easiest</span>
                      </div>
                    ) : null}
                    <div className="library-offer-value">
                      <div><small>Headline value</small><b>{opportunityValue(item)}</b></div>
                      <div><small>{profile?.tax_rate_known ? "Est. after-tax extra" : "Est. extra vs baseline"}</small><b className={profit !== null && profit >= 0 ? "positive" : profit !== null ? "negative" : ""}>{profit === null ? "Build plan" : `${profit >= 0 ? "+" : ""}${money.format(profit)}`}</b></div>
                    </div>
                    <p className="library-offer-requirement"><b>Requirement:</b> {requirementText(item)}. <b>Evidence:</b> {Math.round(numberValue(item.evidence_confidence))}%.</p>
                    {result && !result.safetyPassed ? <p className="library-offer-requirement"><b>Why it is not green:</b> stored research is incomplete, stale, or the safety gate has not passed yet.</p> : null}
                    <div className="library-offer-footer">
                      <div>{profile ? <AddToPlanButton opportunity={item} compact allowPlanningOnHold /> : null}</div>
                      <a href={item.official_url} target="_blank" rel="noreferrer">Official terms <ArrowUpRight size={12} /></a>
                    </div>
                  </article>
                );
              })}
            </div>
          </section>
        );
      })}
    </div>
  );
}
