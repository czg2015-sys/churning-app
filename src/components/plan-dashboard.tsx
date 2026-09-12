"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, BadgeDollarSign, CreditCard, Landmark, ShieldCheck, Sparkles, WalletCards } from "lucide-react";
import { money, numberValue, opportunityEconomics, stateEligible, verificationAgeDays } from "@/lib/plan-math";
import type { FinancialProfile, Opportunity } from "@/lib/types";

function isCleared(item: Opportunity) {
  const age = verificationAgeDays(item.last_verified_at);
  return item.offer_status === "live" && (item.safety_gate || "").toLowerCase() === "pass" && numberValue(item.evidence_confidence) >= 80 && age !== null && age <= 14;
}

function rank(options: Opportunity[], preference: string, profile: FinancialProfile) {
  return [...options].sort((a, b) => {
    const ecoA = opportunityEconomics(a, profile);
    const ecoB = opportunityEconomics(b, profile);
    if (preference === "ease") return numberValue(a.effort) - numberValue(b.effort) || ecoB.grossAdvantage - ecoA.grossAdvantage;
    if (preference === "liquidity") return numberValue(b.liquidity_score) - numberValue(a.liquidity_score) || ecoB.grossAdvantage - ecoA.grossAdvantage;
    if (preference === "profit") return ecoB.estimatedAfterTaxAdvantage - ecoA.estimatedAfterTaxAdvantage;
    const scoreA = ecoA.estimatedAfterTaxAdvantage * .1 - numberValue(a.effort) * 14 + numberValue(a.liquidity_score) + numberValue(a.evidence_confidence);
    const scoreB = ecoB.estimatedAfterTaxAdvantage * .1 - numberValue(b.effort) * 14 + numberValue(b.liquidity_score) + numberValue(b.evidence_confidence);
    return scoreB - scoreA;
  });
}

function PlanChoice({ title, subtitle, icon, options, selected, onChange, profile }: {
  title: string;
  subtitle: string;
  icon: React.ReactNode;
  options: Opportunity[];
  selected?: Opportunity;
  onChange: (id: string) => void;
  profile: FinancialProfile;
}) {
  const economics = selected ? opportunityEconomics(selected, profile) : null;
  return (
    <article className="plan-card">
      <div className="plan-card-head"><span className="plan-card-icon">{icon}</span><div><h3>{title}</h3><p>{subtitle}</p></div><span className="rank-badge">Safety cleared</span></div>
      <div className="plan-card-body">
        {options.length > 0 ? <select className="plan-select" aria-label={`Choose ${title}`} value={selected?.id || ""} onChange={(event: React.ChangeEvent<HTMLSelectElement>) => onChange(event.target.value)}>
          {options.map((option, index) => <option key={option.id} value={option.id}>#{index + 1} · {option.institution} · {numberValue(option.bonus_amount) ? money.format(numberValue(option.bonus_amount)) : `${numberValue(option.apy).toFixed(2)}% APY`}</option>)}
        </select> : <div className="plan-no-option">No live option in this category currently clears the 80/100 safety floor.</div>}

        {selected && economics ? (
          <div className="opportunity-detail">
            <div className="opportunity-detail-title"><div><span>{selected.institution}</span><h4>{selected.product_name}</h4></div><b>{numberValue(selected.bonus_amount) ? money.format(numberValue(selected.bonus_amount)) : `${numberValue(selected.apy).toFixed(2)}%`}</b></div>
            <div className="detail-list">
              <div><span>Est. advantage</span><b className={economics.estimatedAfterTaxAdvantage >= 0 ? "positive-text" : "negative-text"}>{economics.estimatedAfterTaxAdvantage >= 0 ? "+" : ""}{money.format(economics.estimatedAfterTaxAdvantage)}</b></div>
              <div><span>Cash requirement</span><b>{economics.requiredCash ? money.format(economics.requiredCash) : "No fixed balance"}</b></div>
              <div><span>Time window</span><b>{selected.qualification_days ? `${selected.qualification_days} days` : "Ongoing"}</b></div>
              <div><span>Research confidence</span><b>{Math.round(numberValue(selected.evidence_confidence))}%</b></div>
            </div>
            <a className="card-link" href={selected.official_url} target="_blank" rel="noreferrer">Review official terms <ArrowUpRight size={14} /></a>
          </div>
        ) : <div className="opportunity-detail empty"><ShieldCheck size={20} /><p>Churning is intentionally showing nothing here rather than substituting an offer that has not cleared the safety floor.</p></div>}
      </div>
    </article>
  );
}

export function PlanDashboard({ profile, opportunities, guestMode = false, stateCode }: { profile: FinancialProfile; opportunities: Opportunity[]; guestMode?: boolean; stateCode?: string | null }) {
  const preference = profile.ranking_preference || "balanced";
  const cleared = useMemo(() => opportunities.filter((item) => isCleared(item) && stateEligible(item, stateCode)), [opportunities, stateCode]);
  const directDeposit = useMemo(() => rank(cleared.filter((item) => item.category === "checking_bonus"), preference, profile), [cleared, preference, profile]);
  const savings = useMemo(() => rank(cleared.filter((item) => item.category === "hysa" || item.category === "savings_bonus"), preference, profile), [cleared, preference, profile]);
  const spending = useMemo(() => rank(cleared.filter((item) => item.category === "debit_spend"), preference, profile), [cleared, preference, profile]);
  const [ddId, setDdId] = useState(directDeposit[0]?.id || "");
  const [hysaId, setHysaId] = useState(savings[0]?.id || "");
  const [spendId, setSpendId] = useState(spending[0]?.id || "");
  const dd = directDeposit.find((item) => item.id === ddId) || directDeposit[0];
  const hysa = savings.find((item) => item.id === hysaId) || savings[0];
  const spend = spending.find((item) => item.id === spendId) || spending[0];

  const totalCash = numberValue(profile.total_cash);
  const reserve = Math.min(totalCash, numberValue(profile.emergency_reserve));
  const deployable = Math.max(0, totalCash - reserve);
  const bonusBucket = Math.min(deployable, Math.max(numberValue(dd?.required_balance), numberValue(dd?.min_opening_deposit)));
  const hysaBucket = Math.max(0, deployable - bonusBucket);
  const currentApy = numberValue(profile.current_hysa_apy) / 100;
  const currentBaseline = deployable * currentApy;
  const selectedHysaApy = hysa ? numberValue(hysa.apy) / 100 : currentApy;
  const selectedHysaInterest = hysaBucket * selectedHysaApy;
  const bonusBucketInterest = bonusBucket * numberValue(dd?.apy) / 100;
  const bonusValue = numberValue(dd?.bonus_amount) + numberValue(spend?.bonus_amount) - numberValue(dd?.estimated_unavoidable_fees) - numberValue(spend?.estimated_unavoidable_fees);
  const grossPlanValue = Math.max(0, bonusValue + selectedHysaInterest + bonusBucketInterest);
  const extra = grossPlanValue - currentBaseline;

  return (
    <>
      <section className="plan-summary">
        <div className="summary-main">
          <div className="summary-label-row"><span className="kicker">{guestMode ? "PRACTICE CASH MAP" : "UNCOMMITTED CASH MAP"}</span><span className="optimized-pill"><Sparkles size={13} /> Scenario model</span></div>
          <h2>Protect the reserve first. Then compare yield, bonuses, and normal spending.</h2>
          <p>This planning model favors {preference === "balanced" ? "a balance of return, effort, and liquidity" : preference}. It only uses currently safety-cleared options and does not assume you will qualify for any offer.</p>
          <div className="summary-stats">
            <div><span><ShieldCheck size={15} /></span><small>Emergency reserve</small><strong>{money.format(reserve)}</strong></div>
            <div><span><WalletCards size={15} /></span><small>High-yield bucket</small><strong>{money.format(hysaBucket)}</strong></div>
            <div><span><BadgeDollarSign size={15} /></span><small>Bonus cash bucket</small><strong>{money.format(bonusBucket)}</strong></div>
          </div>
        </div>
        <div className="summary-side">
          <div className="stat-card positive"><small>Modeled annual value</small><strong>{money.format(grossPlanValue)}</strong><span>before exact taxes/offer changes</span></div>
          <div className="stat-card"><small>Difference vs current APY</small><strong className={extra >= 0 ? "positive-text" : "negative-text"}>{extra >= 0 ? "+" : ""}{money.format(extra)}</strong><span>planning estimate</span></div>
        </div>
      </section>
      <section className="plan-grid">
        <PlanChoice title="Direct Deposit" subtitle="Use paycheck capacity, not emergency savings" icon={<Landmark size={20} />} options={directDeposit} selected={dd} onChange={setDdId} profile={profile} />
        <PlanChoice title="HYSA / Savings" subtitle="Keep idle cash liquid and earning" icon={<ShieldCheck size={20} />} options={savings} selected={hysa} onChange={setHysaId} profile={profile} />
        <PlanChoice title="Spending" subtitle="Only normal purchases you already make" icon={<CreditCard size={20} />} options={spending} selected={spend} onChange={setSpendId} profile={profile} />
      </section>
    </>
  );
}
