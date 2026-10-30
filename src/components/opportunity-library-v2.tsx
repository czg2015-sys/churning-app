"use client";

import { useMemo } from "react";
import { ArrowUpRight, ChevronDown, GitMerge, ShieldAlert, ShieldCheck } from "lucide-react";
import { findConcurrentDepositPair, preliminarilyFits } from "@/lib/offer-matching";
import { AddToPlanButton } from "@/components/add-to-plan-button";
import { money, numberValue, rankMatches } from "@/lib/plan-math";
import type { AccountHistory, FinancialProfile, Mission, Opportunity } from "@/lib/types";

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
  accountHistory = [],
  missions = [],
}: {
  opportunities: Opportunity[];
  profile?: FinancialProfile | null;
  usedBanks?: string[];
  stateCode?: string | null;
  accountHistory?: AccountHistory[];
  missions?: Mission[];
}) {
  const ranked = useMemo(() => profile ? rankMatches(opportunities, profile, usedBanks, stateCode) : [], [opportunities, profile, usedBanks, stateCode]);
  const rankedById = useMemo(() => new Map(ranked.map((result) => [result.item.id, result])), [ranked]);
  const activeMissions = useMemo(() => missions.filter((mission) => !["complete", "cancelled"].includes(mission.status)), [missions]);
  const activeIds = useMemo(() => new Set(activeMissions.map((mission) => mission.opportunity_id).filter((id): id is string => Boolean(id))), [activeMissions]);
  const visibleOpportunities = useMemo(() => profile
    ? opportunities.filter((item) => preliminarilyFits(rankedById.get(item.id), accountHistory, activeIds))
    : opportunities, [opportunities, profile, rankedById, accountHistory, activeIds]);
  const visibleIds = useMemo(() => new Set(visibleOpportunities.map((item) => item.id)), [visibleOpportunities]);
  const combination = useMemo(() => profile
    ? findConcurrentDepositPair(ranked.filter((result) => visibleIds.has(result.item.id)), profile, accountHistory, missions)
    : null, [ranked, profile, accountHistory, missions, visibleIds]);
  const completed = useMemo(() => {
    const entries: { key: string; label: string; date: string | null }[] = [];
    const seen = new Set<string>();
    for (const entry of accountHistory) {
      if (!(entry.bonus_received || entry.bonus_received_at)) continue;
      const key = entry.opportunity_id || `${entry.institution.toLowerCase()}:${(entry.product_name || "").toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({ key, label: [entry.institution, entry.product_name].filter(Boolean).join(" · "), date: entry.bonus_received_at || null });
    }
    for (const mission of missions.filter((item) => item.status === "complete")) {
      const key = mission.opportunity_id || `${mission.institution.toLowerCase()}:${mission.title.toLowerCase()}`;
      if (seen.has(key)) continue;
      seen.add(key);
      entries.push({ key, label: [mission.institution, mission.title].filter(Boolean).join(" · "), date: null });
    }
    return entries;
  }, [accountHistory, missions]);

  const lanes: Lane[] = [
    { id: "dd", eyebrow: "DIRECT DEPOSIT", title: "Paycheck bonuses", subtitle: "Offers that ask you to route legitimate payroll or another qualifying deposit.", items: visibleOpportunities.filter((item) => item.category === "checking_bonus" && numberValue(item.direct_deposit_required) > 0) },
    { id: "hysa", eyebrow: "SAVINGS / HYSA", title: "High-yield savings", subtitle: "Rate options compared against the APY you already earn—not against zero.", items: opportunities.filter((item) => item.category === "hysa") },
    { id: "bonus", eyebrow: "CASH BONUS", title: "Cash-funded bonuses", subtitle: "Offers where money is parked to earn a bonus; opportunity cost matters here.", items: opportunities.filter((item) => item.category === "savings_bonus") },
    { id: "spending", eyebrow: "OPTIONAL SPENDING", title: "Debit & spending rewards", subtitle: "Only for normal purchases you already planned. No manufactured spending.", items: opportunities.filter((item) => item.category === "debit_spend") },
  ].filter((lane) => lane.items.length > 0);

  return (
    <div className="opportunity-library-v2">
      {profile ? (
        <p className="library-eligibility-copy">
          Showing offers that fit your saved cash, paycheck, spending, geography and bank history. These are preliminary matches, not eligibility guarantees. Offers you already track or may be restricted from repeating are omitted.
        </p>
      ) : null}
      {combination ? (
        <div className="library-combine-notice">
          <div className="library-combine-summary">
            <GitMerge size={18} aria-hidden="true" />
            <div>
              <strong>Two offers may work together</strong>
              <p>{combination.first.item.institution} + {combination.second.item.institution} could run at the same time with <b>separate qualifying payroll deposits</b>.</p>
            </div>
          </div>
          <details>
            <summary>See how to combine <ChevronDown size={14} aria-hidden="true" /></summary>
            <div className="library-combine-details">
              <p><b>{combination.first.item.institution}:</b> {requirementText(combination.first.item)}.</p>
              <p><b>{combination.second.item.institution}:</b> {requirementText(combination.second.item)}.</p>
              <p>Your saved pay information suggests roughly {money.format(combination.availableMonthlyDeposits)} per ordinary two-paycheck month is available after your existing tracked deposit commitments. The two requirements average at least {money.format(combination.totalMonthlyDeposits)} per month across their qualification windows.</p>
              <p><b>Important:</b> Your employer must be able to split payroll. Each bank needs its own qualifying deposit; the same money transfer does not count twice. Check official eligible-deposit definitions, dates, repeat-customer restrictions, fees and closing rules before opening anything.</p>
              <div><a href={combination.first.item.official_url} target="_blank" rel="noreferrer">First bank terms <ArrowUpRight size={12} /></a><a href={combination.second.item.official_url} target="_blank" rel="noreferrer">Second bank terms <ArrowUpRight size={12} /></a></div>
            </div>
          </details>
        </div>
      ) : null}
      {completed.length ? (
        <details className="library-completed-offers">
          <summary>Completed offers ({completed.length}) <span>View history <ChevronDown size={13} aria-hidden="true" /></span></summary>
          <ul>{completed.map((entry) => <li key={entry.key}><span>{entry.label}</span><small>{entry.date ? `Reward recorded ${entry.date.slice(0, 10)}` : "Marked complete"}</small></li>)}</ul>
          <p>Completed bonuses stay in your history and affect which new bonuses appear here. Check each bank's repeat-offer waiting period before trying again.</p>
        </details>
      ) : null}
      {profile && visibleOpportunities.length === 0 ? (
        <div className="disclaimer">There are no preliminary eligible matches in the current research feed. Review your answers in Start Here, and check back after the next official-source verification. We won't invent a replacement.</div>
      ) : null}
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
                      <div>{profile ? <AddToPlanButton opportunity={item} compact /> : null}</div>
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
