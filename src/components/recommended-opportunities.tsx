"use client";

import { ArrowUpRight, BadgeDollarSign, CalendarClock, CircleAlert, Droplets, Gauge, ShieldCheck, Sparkles } from "lucide-react";
import { AddToPlanButton } from "@/components/add-to-plan-button";
import { latestReview, money, numberValue, rankMatches, reviewStatusLabel, verificationAgeDays } from "@/lib/plan-math";
import type { FinancialProfile, Opportunity, PlanStartDetails } from "@/lib/types";

function freshnessLabel(lastVerifiedAt?: string | null) {
  const days = verificationAgeDays(lastVerifiedAt);
  if (days === null) return { text: "Verification date missing", stale: true };
  if (days === 0) return { text: "Verified today", stale: false };
  if (days <= 7) return { text: `Verified ${days}d ago`, stale: false };
  return { text: `Review due · ${days}d old`, stale: true };
}

function requirementLabel(item: Opportunity) {
  if (numberValue(item.direct_deposit_required)) return `${money.format(numberValue(item.direct_deposit_required))} qualifying DD`;
  if (numberValue(item.required_balance)) return `${money.format(numberValue(item.required_balance))} balance`;
  if (Number(item.purchase_count || 0) > 0) return `${Number(item.purchase_count)} qualifying purchases`;
  if (numberValue(item.min_opening_deposit)) return `${money.format(numberValue(item.min_opening_deposit))} opening deposit`;
  return "No fixed cash requirement";
}

function opportunityValue(item: Opportunity) {
  const reward = numberValue(item.bonus_amount);
  return reward ? money.format(reward) : `${numberValue(item.apy).toFixed(2)}% APY`;
}

function paceText(mode: number) {
  if (mode === 1) return { title: "Simple pace", count: "1 primary move", copy: "Keep tracking light and prioritize the clearest fit." };
  if (mode === 3) return { title: "Active pace", count: "Compare up to 3 lanes", copy: "Built for users willing to track more at once; confirm the combined DD and cash requirements before activating multiple offers." };
  return { title: "Balanced pace", count: "Usually 1–2 moves", copy: "Our recommended starting point for a practical mix of return, flexibility, and upkeep." };
}

export function RecommendedOpportunities({
  profile,
  opportunities,
  usedBanks = [],
  guestMode = false,
  onGuestAdd,
  addedOpportunityIds = [],
  prominent = false,
  stateCode,
  resultsPage = false,
}: {
  profile: FinancialProfile;
  opportunities: Opportunity[];
  usedBanks?: string[];
  guestMode?: boolean;
  onGuestAdd?: (opportunity: Opportunity, details: PlanStartDetails) => void;
  addedOpportunityIds?: string[];
  prominent?: boolean;
  stateCode?: string | null;
  resultsPage?: boolean;
}) {
  const matches = rankMatches(opportunities, profile, usedBanks, stateCode).slice(0, 10);
  const topMatches = matches.slice(0, 3);
  const moreMatches = matches.slice(3);
  const pace = paceText(Number(profile.strategy_mode || 2));

  return (
    <section className={`recommendations-shell ${prominent ? "recommendations-prominent" : ""} ${resultsPage ? "recommendations-results-layout" : ""}`}>
      <div className="recommendations-head">
        <div>
          <span className="kicker">BEST MATCHES FOR YOUR PROFILE</span>
          <h2>{resultsPage ? "Your strongest opportunities, ranked." : prominent ? "Start with the best-fitting moves." : "Your next best opportunities."}</h2>
          <p>We compare each offer with your current savings baseline, available cash, paycheck capacity, normal spending, liquidity preference, bank history, state availability, and the freshness of our stored research.</p>
        </div>
        <div className="recommendation-head-meta">
          <span className="recommendation-refresh"><span /> 7-day research freshness standard</span>
          <div className="pace-summary"><Gauge size={16} /><span><b>{pace.title}</b><small>{pace.count} · {pace.copy}</small></span></div>
        </div>
      </div>

      {prominent && (
        <div className="recommendation-intro-strip">
          <div><Sparkles size={17} /><span><b>1. Compare your top matches</b><small>See estimated advantage, requirements, and research status.</small></span></div>
          <div><BadgeDollarSign size={17} /><span><b>2. Add the ones you want to track</b><small>Planning does not open an account or move money.</small></span></div>
          <div><CalendarClock size={17} /><span><b>3. Start the clock only when opened</b><small>Real opening dates drive qualification and payout tracking.</small></span></div>
        </div>
      )}

      {topMatches.length ? (
        <>
          <div className="top-match-label"><span>TOP 3</span><p>Best overall fit based on the answers you gave us.</p></div>
          <div className="top-match-grid">
            {topMatches.map((result, index) => {
              const item = result.item;
              const freshness = freshnessLabel(item.last_verified_at);
              const review = latestReview(item);
              const advantage = profile.tax_rate_known ? result.estimatedAfterTaxAdvantage : result.grossAdvantage;
              const reasons = result.reasons.slice(0, 3);
              const safetyText = result.safetyPassed ? "Safety cleared" : result.researchReady ? "Final safety review pending" : "Research refresh required";

              return (
                <article className={`top-match-card ${result.safetyPassed ? "cleared" : "pending"}`} key={item.id}>
                  <div className="top-match-card-head">
                    <span className="match-rank">#{index + 1}</span>
                    <span className={result.safetyPassed ? "match-status cleared" : "match-status pending"}>{result.safetyPassed ? <ShieldCheck size={13} /> : <CircleAlert size={13} />}{safetyText}</span>
                  </div>
                  <span className="match-bank">{item.institution}</span>
                  <h3>{item.product_name}</h3>
                  <div className="match-value-row"><div><small>{numberValue(item.bonus_amount) ? "Potential reward" : "Current APY"}</small><strong>{opportunityValue(item)}</strong></div><div><small>{profile.tax_rate_known ? "Est. advantage after tax" : "Est. advantage vs current baseline"}</small><strong className={advantage >= 0 ? "positive" : "negative"}>{advantage >= 0 ? "+" : ""}{money.format(advantage)}</strong></div></div>
                  <div className="match-core-metrics">
                    <span><small>Requirement</small><b>{requirementLabel(item)}</b></span>
                    <span><small>Liquidity</small><b>{Math.round(result.liquidity)}/100</b></span>
                    <span><small>Effort</small><b>{Math.round(result.effort)}/3</b></span>
                  </div>
                  <p className="match-fit-copy"><b>Why it fits:</b> {reasons.length ? reasons.join(" · ") : "strong overall fit for your current preferences"}.{result.historyMatch ? ` You reported prior ${item.institution} history, so eligibility needs an extra re-check.` : ""}</p>
                  <div className="match-research-row"><span className={freshness.stale ? "stale" : ""}>{freshness.text}</span><span>Research confidence {Math.round(result.confidence)}%</span></div>
                  <div className="match-actions">
                    <AddToPlanButton opportunity={item} guestMode={guestMode} onGuestAdd={onGuestAdd} alreadyAdded={addedOpportunityIds.includes(item.id)} allowPlanningOnHold />
                    <a href={item.official_url} target="_blank" rel="noreferrer">Official terms <ArrowUpRight size={13} /></a>
                  </div>
                </article>
              );
            })}
          </div>

          {moreMatches.length > 0 && (
            <div className="more-matches-section">
              <div className="more-matches-head"><div><span>MORE OPTIONS</span><h3>Other opportunities that fit your profile.</h3></div><p>Useful if you want another savings home, a second direct-deposit lane, or a different effort/liquidity tradeoff.</p></div>
              <div className="more-match-list">
                {moreMatches.map((result, index) => {
                  const item = result.item;
                  const advantage = profile.tax_rate_known ? result.estimatedAfterTaxAdvantage : result.grossAdvantage;
                  return (
                    <article key={item.id}>
                      <span className="more-rank">#{index + 4}</span>
                      <div className="more-name"><small>{item.institution}</small><strong>{item.product_name}</strong></div>
                      <div><small>Value</small><b>{opportunityValue(item)}</b></div>
                      <div><small>Est. advantage</small><b className={advantage >= 0 ? "positive" : "negative"}>{advantage >= 0 ? "+" : ""}{money.format(advantage)}</b></div>
                      <div><small>Research</small><b>{result.safetyPassed ? "Cleared" : result.researchReady ? "Final review" : "Refresh due"}</b></div>
                      <AddToPlanButton opportunity={item} guestMode={guestMode} onGuestAdd={onGuestAdd} alreadyAdded={addedOpportunityIds.includes(item.id)} allowPlanningOnHold compact />
                    </article>
                  );
                })}
              </div>
            </div>
          )}
        </>
      ) : (
        <div className="recommendation-empty">
          <ShieldCheck size={30} />
          <div><h3>No current opportunity fits the profile closely enough.</h3><p>Instead of forcing a weak match, adjust your questionnaire or check again after the opportunity library refreshes.</p></div>
        </div>
      )}

      <div className="research-standard">
        <div className="research-standard-head"><div><span>RESEARCH & RISK</span><h3>What we check before you act.</h3></div><p>These fields are published because a large advertised bonus is not enough by itself.</p></div>
        <div className="research-standard-grid">
          {[{ k: "Hard inquiry", v: "Whether account opening is known to use a hard credit pull." }, { k: "ChexSystems", v: "Known deposit-account screening behavior when verified." }, { k: "Early Warning", v: "EWS screening notes when verified." }, { k: "Taxes", v: "Known bonus/interest reporting treatment." }, { k: "Deposit insurance", v: "FDIC/NCUA or program-bank structure." }, { k: "Close & clawback rules", v: "Minimum age, payout, fee, and early-closing restrictions." }].map((item) => <div key={item.k}><strong>{item.k}</strong><span>{item.v}</span></div>)}
        </div>
        {topMatches[0] && (() => {
          const review = latestReview(topMatches[0].item);
          return <div className="research-example-line"><span>Top match research snapshot</span><b>Hard pull: {reviewStatusLabel(review?.hard_pull_status)} · Chex: {reviewStatusLabel(review?.chexsystems_status)} · EWS: {reviewStatusLabel(review?.ews_status)} · Tax: {reviewStatusLabel(review?.tax_status)} · Insurance: {reviewStatusLabel(review?.insurance_status)} · Close rules: {reviewStatusLabel(review?.close_rule_status)}</b></div>;
        })()}
        <p className="research-disclaimer">Churning is an educational comparison and tracking tool, not financial, tax, legal, or credit advice. Bank approval and bonus eligibility are controlled by each institution’s current official terms.</p>
      </div>
    </section>
  );
}
