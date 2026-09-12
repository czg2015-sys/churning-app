"use client";

import { ArrowUpRight, BadgeDollarSign, CalendarClock, Droplets, ShieldCheck, Sparkles, TriangleAlert } from "lucide-react";
import { AddToPlanButton } from "@/components/add-to-plan-button";
import { latestReview, money, numberValue, rankOpportunities, rankResearchQueue, reviewStatusLabel, verificationAgeDays } from "@/lib/plan-math";
import type { FinancialProfile, Opportunity, PlanStartDetails } from "@/lib/types";

function freshnessLabel(lastVerifiedAt?: string | null) {
  const days = verificationAgeDays(lastVerifiedAt);
  if (days === null) return { text: "Verification date missing", stale: true };
  if (days === 0) return { text: "Verified today", stale: false };
  if (days <= 7) return { text: `Verified ${days}d ago`, stale: false };
  return { text: `Re-check · ${days}d old`, stale: true };
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
}: {
  profile: FinancialProfile;
  opportunities: Opportunity[];
  usedBanks?: string[];
  guestMode?: boolean;
  onGuestAdd?: (opportunity: Opportunity, details: PlanStartDetails) => void;
  addedOpportunityIds?: string[];
  prominent?: boolean;
  stateCode?: string | null;
}) {
  const ranked = rankOpportunities(opportunities, profile, usedBanks, stateCode).slice(0, 5);
  const researchQueue = rankResearchQueue(opportunities, profile, usedBanks, stateCode).slice(0, 5);

  return (
    <section className={`recommendations-shell ${prominent ? "recommendations-prominent" : ""}`}>
      <div className="recommendations-head">
        <div>
          <span className="kicker">PERSONALIZED OPPORTUNITY QUEUE</span>
          <h2>{prominent ? "Start with the best-fitting moves." : "Your next best opportunities."}</h2>
          <p>Only offers that clear the current 80/100 research-confidence safety floor and stored safety gate are ranked here. An actionable recommendation must also be recently verified and fit your cash, paycheck/spending capacity, liquidity, effort, current APY, bank history, and state availability.</p>
        </div>
        <span className="recommendation-refresh"><span /> {guestMode ? "Practice ranking" : "Personalized ranking"}</span>
      </div>

      {prominent && (
        <div className="recommendation-intro-strip">
          <div><Sparkles size={17} /><span><b>1. Pick an opportunity</b><small>Compare net advantage and requirements.</small></span></div>
          <div><BadgeDollarSign size={17} /><span><b>2. Add real starting details</b><small>Opening date, committed cash, and DD plan.</small></span></div>
          <div><CalendarClock size={17} /><span><b>3. Track it to payout</b><small>The reward tracker takes over from there.</small></span></div>
        </div>
      )}

      <div className="recommendation-list">
        {ranked.length ? ranked.map((result, index) => {
          const item = result.item;
          const reward = numberValue(item.bonus_amount);
          const requirement = numberValue(item.direct_deposit_required)
            ? `${money.format(numberValue(item.direct_deposit_required))} DD`
            : numberValue(item.required_balance)
              ? `${money.format(numberValue(item.required_balance))} balance`
              : numberValue(item.min_opening_deposit)
                ? `${money.format(numberValue(item.min_opening_deposit))} opening deposit`
                : "No fixed balance";
          const freshness = freshnessLabel(item.last_verified_at);
          const review = latestReview(item);
          const advantage = profile.tax_rate_known ? result.estimatedAfterTaxAdvantage : result.grossAdvantage;
          const reasons = result.reasons.slice(0, 2);

          return (
            <article className="recommendation-card" key={item.id}>
              <div className="recommendation-rank"><span>#{index + 1}</span><small>FIT</small></div>
              <div className="recommendation-main">
                <div className="recommendation-title-row">
                  <div><span>{item.institution}</span><h3>{item.product_name}</h3></div>
                  <div className="recommendation-value"><small>{reward ? "Potential reward" : "Current APY"}</small><strong>{reward ? money.format(reward) : `${numberValue(item.apy).toFixed(2)}%`}</strong></div>
                </div>

                <div className="recommendation-net-row">
                  <div><small>{profile.tax_rate_known ? "Est. advantage after tax" : "Est. advantage vs current cash baseline"}</small><strong className={advantage >= 0 ? "positive" : "negative"}>{advantage >= 0 ? "+" : ""}{money.format(advantage)}</strong></div>
                  <div><small>Cash required</small><strong>{result.requiredCash > 0 ? money.format(result.requiredCash) : "No lockup"}</strong></div>
                  <div><small>Liquidity</small><strong>{Math.round(result.liquidity)}/100</strong></div>
                </div>

                <div className="recommendation-metrics">
                  <span className="safe"><ShieldCheck size={14} /> Safety cleared · {Math.round(result.confidence)}%</span>
                  <span><BadgeDollarSign size={14} /> {requirement}</span>
                  <span><CalendarClock size={14} /> {item.qualification_days ? `${item.qualification_days} day qualification` : "Ongoing"}</span>
                  <span><Droplets size={14} /> Effort {Math.round(result.effort)}/3</span>
                  <span className={freshness.stale ? "stale" : ""}>{freshness.stale ? <TriangleAlert size={14} /> : <ShieldCheck size={14} />} {freshness.text}</span>
                </div>

                <div className="recommendation-safety-grid" aria-label="Safety research details">
                  <span><small>Hard pull</small><b>{reviewStatusLabel(review?.hard_pull_status)}</b></span>
                  <span><small>ChexSystems</small><b>{reviewStatusLabel(review?.chexsystems_status)}</b></span>
                  <span><small>EWS</small><b>{reviewStatusLabel(review?.ews_status)}</b></span>
                  <span><small>Tax</small><b>{reviewStatusLabel(review?.tax_status)}</b></span>
                  <span><small>Deposit insurance</small><b>{reviewStatusLabel(review?.insurance_status)}</b></span>
                  <span><small>Close rules</small><b>{reviewStatusLabel(review?.close_rule_status)}</b></span>
                </div>

                <p className="recommendation-why"><b>Why it fits:</b> {reasons.length ? reasons.join(" · ") : "fits the current ranking settings"}. {result.historyMatch ? `You reported prior ${item.institution} history, so new-customer eligibility needs an extra check. ` : ""}{item.terms_summary || "Official terms still need to be rechecked immediately before applying."}</p>
              </div>

              <div className="recommendation-cta">
                <AddToPlanButton
                  opportunity={item}
                  guestMode={guestMode}
                  onGuestAdd={onGuestAdd}
                  alreadyAdded={addedOpportunityIds.includes(item.id)}
                />
                <a href={item.official_url} target="_blank" rel="noreferrer">Official terms <ArrowUpRight size={13} /></a>
              </div>
            </article>
          );
        }) : (
          <div className="recommendation-empty">
            <ShieldCheck size={30} />
            <div><h3>No opportunity clears the current safety floor yet.</h3><p>Churning will not pretend a research-hold offer is ready just to fill the screen. The candidates below stay visible for review, but they cannot be added until the safety gate, confidence floor, and verification freshness all clear.</p></div>
          </div>
        )}
      </div>

      {ranked.length === 0 && researchQueue.length > 0 && (
        <div className="research-queue">
          <div className="research-queue-head"><div><span>RESEARCH QUEUE</span><h3>High-interest candidates waiting for clearance.</h3></div><small>Visible ≠ recommended</small></div>
          <div className="research-queue-grid">
            {researchQueue.map((result) => {
              const item = result.item;
              const age = verificationAgeDays(item.last_verified_at);
              const gatePassed = (item.safety_gate || "").toLowerCase() === "pass";
              const reasons = [
                !gatePassed ? "safety review still on hold" : null,
                result.confidence < 80 ? `confidence ${Math.round(result.confidence)}%` : null,
                age === null ? "verification date missing" : age > 14 ? `verification ${age} days old` : null,
              ].filter(Boolean);
              return (
                <article key={item.id}>
                  <div className="research-queue-top"><span>{item.institution}</span><b>{numberValue(item.bonus_amount) > 0 ? money.format(numberValue(item.bonus_amount)) : `${numberValue(item.apy).toFixed(2)}% APY`}</b></div>
                  <h4>{item.product_name}</h4>
                  <p>{reasons.length ? reasons.join(" · ") : "Additional verification is still required before this can become actionable."}</p>
                  <div className="research-queue-actions"><AddToPlanButton opportunity={item} guestMode={guestMode} onGuestAdd={onGuestAdd} alreadyAdded={addedOpportunityIds.includes(item.id)} allowGuestSimulationOnHold compact /><a href={item.official_url} target="_blank" rel="noreferrer">Review terms <ArrowUpRight size={12} /></a></div>
                </article>
              );
            })}
          </div>
        </div>
      )}
    </section>
  );
}
