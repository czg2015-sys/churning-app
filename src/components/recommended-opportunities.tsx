"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronUp, CircleAlert, ShieldCheck, Sparkles } from "lucide-react";
import { AddToPlanButton } from "@/components/add-to-plan-button";
import { money, numberValue, rankMatches } from "@/lib/plan-math";
import type { FinancialProfile, Opportunity, PlanStartDetails } from "@/lib/types";

type RankedMatch = ReturnType<typeof rankMatches>[number];

function requirementLabel(item: Opportunity) {
  if (numberValue(item.direct_deposit_required)) return `${money.format(numberValue(item.direct_deposit_required))} qualifying direct deposit`;
  if (numberValue(item.required_balance)) return `${money.format(numberValue(item.required_balance))} balance`;
  if (numberValue(item.purchase_required_spend)) return `${money.format(numberValue(item.purchase_required_spend))} normal spend`;
  if (Number(item.purchase_count || 0) > 0) return `${Number(item.purchase_count)} qualifying purchases`;
  if (numberValue(item.min_opening_deposit)) return `${money.format(numberValue(item.min_opening_deposit))} opening deposit`;
  return "No fixed cash requirement";
}

function opportunityValue(item: Opportunity) {
  const reward = numberValue(item.bonus_amount);
  return reward > 0 ? money.format(reward) : `${numberValue(item.apy).toFixed(2)}% APY`;
}

function researchLabel(result: RankedMatch) {
  if (result.safetyPassed) return "Research Verified";
  if (result.researchReady) return "Final review";
  return "Needs review";
}

function shortDescription(item: Opportunity) {
  const text = item.terms_summary || item.eligibility_notes || "Review the current official terms before opening.";
  return text.length > 165 ? `${text.slice(0, 162).trim()}…` : text;
}

function HysaComparison({ item, profile }: { item: Opportunity; profile: FinancialProfile }) {
  const current = numberValue(profile.current_hysa_apy);
  const offered = numberValue(item.apy);
  if (current <= 0) return null;
  const diff = Math.abs(offered - current);
  if (offered > current) return <p className="match-fit-copy"><b>Rate note:</b> This stored APY is {diff.toFixed(2)} percentage points above your current {current.toFixed(2)}% APY.</p>;
  if (offered < current) return <p className="match-fit-copy"><b>Rate note:</b> Your current {current.toFixed(2)}% APY is better by {diff.toFixed(2)} percentage points, so switching for rate alone may not help.</p>;
  return <p className="match-fit-copy"><b>Rate note:</b> This matches your current {current.toFixed(2)}% APY, so compare convenience and account terms before switching.</p>;
}

function RecommendationCard({
  result,
  profile,
  guestMode,
  onGuestAdd,
  addedOpportunityIds,
}: {
  result: RankedMatch;
  profile: FinancialProfile;
  guestMode: boolean;
  onGuestAdd?: (opportunity: Opportunity, details: PlanStartDetails) => void;
  addedOpportunityIds: string[];
}) {
  const item = result.item;
  const advantage = profile.tax_rate_known ? result.estimatedAfterTaxAdvantage : result.grossAdvantage;
  const verified = result.safetyPassed;
  return (
    <article className={`top-match-card ${verified ? "cleared" : "pending"}`}>
      <div className="top-match-card-head">
        <span className="match-bank">{item.institution}</span>
        <span className={verified ? "match-status cleared" : "match-status pending"}>
          {verified ? <ShieldCheck size={13} /> : <CircleAlert size={13} />}{researchLabel(result)}
        </span>
      </div>
      <h3>{item.product_name}</h3>
      <p className="match-fit-copy">{shortDescription(item)}</p>
      {item.category === "hysa" ? <HysaComparison item={item} profile={profile} /> : null}
      <div className="match-value-row">
        <div><small>{numberValue(item.bonus_amount) > 0 ? "Potential value" : "Current APY"}</small><strong>{opportunityValue(item)}</strong></div>
        <div><small>Est. advantage vs your baseline</small><strong className={advantage >= 0 ? "positive" : "negative"}>{advantage >= 0 ? "+" : ""}{money.format(advantage)}</strong></div>
      </div>
      <div className="match-core-metrics">
        <span><small>Key requirement</small><b>{requirementLabel(item)}</b></span>
        <span><small>Effort</small><b>{Math.round(result.effort)}/3</b></span>
      </div>
      <div className="match-actions">
        <AddToPlanButton
          opportunity={item}
          guestMode={guestMode}
          onGuestAdd={onGuestAdd}
          alreadyAdded={addedOpportunityIds.includes(item.id)}
          allowGuestSimulationOnHold={guestMode}
          allowPlanningOnHold={!guestMode}
        />
        <a href={item.official_url} target="_blank" rel="noreferrer">Official terms <ArrowUpRight size={13} /></a>
      </div>
    </article>
  );
}

function CategorySection({
  title,
  subtitle,
  items,
  profile,
  guestMode,
  onGuestAdd,
  addedOpportunityIds,
}: {
  title: string;
  subtitle: string;
  items: RankedMatch[];
  profile: FinancialProfile;
  guestMode: boolean;
  onGuestAdd?: (opportunity: Opportunity, details: PlanStartDetails) => void;
  addedOpportunityIds: string[];
}) {
  const [expanded, setExpanded] = useState(false);
  const visible = expanded ? items : items.slice(0, 3);
  if (!items.length) return null;

  return (
    <section className="more-matches-section">
      <div className="more-matches-head">
        <div><span>{title.toUpperCase()}</span><h3>{title}</h3></div>
        <p>{subtitle}</p>
      </div>
      <div className="top-match-grid">
        {visible.map((result) => (
          <RecommendationCard
            key={result.item.id}
            result={result}
            profile={profile}
            guestMode={guestMode}
            onGuestAdd={onGuestAdd}
            addedOpportunityIds={addedOpportunityIds}
          />
        ))}
      </div>
      {items.length > 3 ? (
        <button className="button ghost compact" type="button" onClick={() => setExpanded((value) => !value)}>
          {expanded ? <><ChevronUp size={15} /> Show top 3</> : <><ChevronDown size={15} /> See more ({items.length - 3})</>}
        </button>
      ) : null}
    </section>
  );
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
  const ranked = useMemo(() => rankMatches(opportunities, profile, usedBanks, stateCode), [opportunities, profile, usedBanks, stateCode]);

  const hysa = ranked.filter((result) => result.item.category === "hysa");
  const savings = ranked.filter((result) => result.item.category === "savings_bonus");
  const checking = ranked.filter((result) => result.item.category === "checking_bonus");
  const debit = profile.card_helper_opt_in ? ranked.filter((result) => result.item.category === "debit_spend") : [];

  const planPicks = [hysa[0], savings[0], checking[0]].filter((value): value is RankedMatch => Boolean(value));

  return (
    <section className={`recommendations-shell ${prominent ? "recommendations-prominent" : ""} ${resultsPage ? "recommendations-results-layout" : ""}`}>
      <div className="recommendations-head">
        <div>
          <span className="kicker">YOUR SUGGESTED PLAN</span>
          <h2>{resultsPage ? "A practical starting sequence from your profile." : "Start with a cash home base, then layer bonuses that fit."}</h2>
          <p>This is an educational planning path based on the information you entered. You choose whether to open anything, and current bank terms control eligibility and payout.</p>
        </div>
      </div>

      {planPicks.length ? (
        <div className="recommendation-intro-strip">
          {planPicks.map((result, index) => (
            <div key={result.item.id}>
              <Sparkles size={17} />
              <span>
                <b>{index + 1}. {index === 0 ? "Savings home base" : index === 1 ? "Savings bonus layer" : "Direct-deposit lane"}</b>
                <small>{result.item.institution} · {result.item.product_name}</small>
              </span>
            </div>
          ))}
        </div>
      ) : null}

      <div className="top-match-label"><span>BEST MATCHES FOR YOU</span><p>Top 3 are shown in each category. Use “See more” when additional matches are available.</p></div>

      <CategorySection
        title="High-yield savings"
        subtitle="Your cash home base comes first. We still show alternatives even when your current HYSA is stronger, with a clear rate note before you switch."
        items={hysa}
        profile={profile}
        guestMode={guestMode}
        onGuestAdd={onGuestAdd}
        addedOpportunityIds={addedOpportunityIds}
      />
      <CategorySection
        title="Savings bonuses"
        subtitle="Cash bonuses that require a deposit or balance hold. We compare the bonus with the interest you could have earned by leaving the money in your current HYSA."
        items={savings}
        profile={profile}
        guestMode={guestMode}
        onGuestAdd={onGuestAdd}
        addedOpportunityIds={addedOpportunityIds}
      />
      <CategorySection
        title="Checking & direct-deposit bonuses"
        subtitle={Number(profile.strategy_mode || 2) === 3 && profile.employer_multiple_dd === true ? "Your profile supports comparing multiple DD lanes, but confirm payroll can actually split deposits before activating more than one." : "Compare all matching offers here, but plan around one primary DD lane unless your payroll actually supports splitting deposits."}
        items={checking}
        profile={profile}
        guestMode={guestMode}
        onGuestAdd={onGuestAdd}
        addedOpportunityIds={addedOpportunityIds}
      />
      {profile.card_helper_opt_in ? (
        <CategorySection
          title="Debit rewards"
          subtitle="Optional spending rewards that fit the normal spending you entered. Credit-card welcome offers stay separate in Cards & Spending."
          items={debit}
          profile={profile}
          guestMode={guestMode}
          onGuestAdd={onGuestAdd}
          addedOpportunityIds={addedOpportunityIds}
        />
      ) : null}

      {!ranked.length ? (
        <div className="recommendation-empty"><ShieldCheck size={30} /><div><h3>No current matches fit the profile yet.</h3><p>Update the questionnaire or check again after the opportunity library refreshes.</p></div></div>
      ) : null}
    </section>
  );
}
