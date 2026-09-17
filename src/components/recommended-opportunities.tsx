"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, ChevronDown, ChevronUp, CircleAlert, ShieldCheck } from "lucide-react";
import { AddToPlanButton } from "@/components/add-to-plan-button";
import { benefitDurationLabel, categoryLabel, money, numberValue, rankMatches, selectFeasibleRecommendations } from "@/lib/plan-math";
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
  if (reward > 0) return money.format(reward);
  if (item.category === "savings_bonus") return `${numberValue(item.apy).toFixed(2)}% promo rate`;
  return `${numberValue(item.apy).toFixed(2)}% APY`;
}

function valueLabel(item: Opportunity) {
  if (numberValue(item.bonus_amount) > 0) return "Potential value";
  if (item.benefit_duration_days || item.category === "savings_bonus") return "Promotional APY";
  return "Current APY";
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

function fitNote(result: RankedMatch) {
  const notes: string[] = [];
  if (result.cashFit < 95) notes.push("the stored cash requirement is above the amount your profile can currently deploy");
  if (result.ddFit < 90) notes.push("the direct-deposit requirement may be too high for the paycheck amount and deadline you entered");
  if (result.spendFit < 75) notes.push("the spending requirement is above the normal spending you entered");
  if (result.historyMatch) notes.push(`you reported prior ${result.item.institution} history, so bonus eligibility needs an extra check`);
  return notes;
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
  const notes = fitNote(result);
  const benefitLabel = benefitDurationLabel(item);
  return (
    <article className={`top-match-card ${verified ? "cleared" : "pending"}`}>
      <div className="top-match-card-head">
        <span className="match-bank">{item.institution}</span>
        <span className={verified ? "match-status cleared" : "match-status pending"}>
          {verified ? <ShieldCheck size={13} /> : <CircleAlert size={13} />}{researchLabel(result)}
        </span>
      </div>
      <h3>{item.product_name}</h3>
      {benefitLabel ? <div className="match-promo-note">{benefitLabel}</div> : null}
      <p className="match-fit-copy">{shortDescription(item)}</p>
      {item.category === "hysa" ? <HysaComparison item={item} profile={profile} /> : null}
      {notes.length ? <p className="match-fit-copy"><b>Fit note:</b> {notes.join("; ")}.</p> : null}
      <div className="match-value-row">
        <div><small>{valueLabel(item)}</small><strong>{opportunityValue(item)}</strong></div>
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
  const [open, setOpen] = useState(false);
  if (!items.length) return null;

  return (
    <section className={`more-matches-section category-dropdown ${open ? "open" : ""}`}>
      <button className="category-dropdown-head" type="button" onClick={() => setOpen((value) => !value)} aria-expanded={open}>
        <div><span>{title.toUpperCase()}</span><h3>{title}</h3><p>{subtitle}</p></div>
        <div className="category-dropdown-meta"><b>{items.length} match{items.length === 1 ? "" : "es"}</b>{open ? <ChevronUp size={17} /> : <ChevronDown size={17} />}</div>
      </button>
      {open ? (
        <div className="top-match-grid category-match-grid">
          {items.map((result) => (
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

  const planPicks = selectFeasibleRecommendations(opportunities, profile, usedBanks, stateCode, 3);

  return (
    <section className={`recommendations-shell ${prominent ? "recommendations-prominent" : ""} ${resultsPage ? "recommendations-results-layout" : ""}`}>
      <div className="recommendations-head compact-recommendations-head">
        <div>
          <span className="kicker">RECOMMENDED FOR YOU</span>
          <h2>{resultsPage ? "Your strongest matches right now." : "Three strong options that can work together."}</h2>
          <p>Built around your available cash, paycheck capacity, normal spending, and current research checks.</p>
        </div>
      </div>

      {planPicks.length ? (
        <>
          <div className="top-match-label"><span>TOP {planPicks.length}</span><p>The group is checked together so overlapping cash and direct-deposit requirements stay realistic.</p></div>
          <div className="top-match-grid">
            {planPicks.map((result, index) => (
              <div className="recommendation-slot" key={`plan-${result.item.id}`}>
                <div className="recommendation-slot-label"><span>#{index + 1}</span>{categoryLabel(result.item)}</div>
                <RecommendationCard
                  result={result}
                  profile={profile}
                  guestMode={guestMode}
                  onGuestAdd={onGuestAdd}
                  addedOpportunityIds={addedOpportunityIds}
                />
              </div>
            ))}
          </div>
        </>
      ) : null}

      <div className="top-match-label category-explore-label"><span>EXPLORE BY CATEGORY</span><p>Open a category to compare every current match.</p></div>

      <CategorySection
        title="High-yield savings"
        subtitle="Savings rates and promotional boosts."
        items={hysa}
        profile={profile}
        guestMode={guestMode}
        onGuestAdd={onGuestAdd}
        addedOpportunityIds={addedOpportunityIds}
      />
      <CategorySection
        title="Savings bonuses"
        subtitle="Cash bonuses and limited savings promotions."
        items={savings}
        profile={profile}
        guestMode={guestMode}
        onGuestAdd={onGuestAdd}
        addedOpportunityIds={addedOpportunityIds}
      />
      <CategorySection
        title="Checking & direct-deposit bonuses"
        subtitle={Number(profile.strategy_mode || 2) === 3 && profile.employer_multiple_dd === true ? "Checking and DD offers that fit your paycheck capacity." : "Checking and DD offers; the Top 3 avoids stacking DD requirements your paycheck cannot support."}
        items={checking}
        profile={profile}
        guestMode={guestMode}
        onGuestAdd={onGuestAdd}
        addedOpportunityIds={addedOpportunityIds}
      />
      {profile.card_helper_opt_in ? (
        <CategorySection
          title="Debit rewards"
          subtitle="Optional rewards for spending you already make."
          items={debit}
          profile={profile}
          guestMode={guestMode}
          onGuestAdd={onGuestAdd}
          addedOpportunityIds={addedOpportunityIds}
        />
      ) : null}

      {!ranked.length ? (
        <div className="recommendation-empty"><ShieldCheck size={30} /><div><h3>No current matches are available for your state.</h3><p>Update the questionnaire or check again after the opportunity library refreshes.</p></div></div>
      ) : null}
    </section>
  );
}
