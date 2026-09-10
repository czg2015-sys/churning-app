"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CreditCard, Landmark, ShieldCheck, Sparkles } from "lucide-react";
import type { FinancialProfile, Opportunity } from "@/lib/types";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = (value: number | string | null | undefined) => Number(value || 0);

function rank(options: Opportunity[], preference: string) {
  return [...options].sort((a, b) => {
    if (preference === "ease") return number(a.effort) - number(b.effort) || number(b.bonus_amount) - number(a.bonus_amount);
    if (preference === "liquidity") return number(b.liquidity_score) - number(a.liquidity_score) || number(b.bonus_amount) - number(a.bonus_amount);
    if (preference === "profit") return number(b.bonus_amount) + number(b.apy) * 25 - (number(a.bonus_amount) + number(a.apy) * 25);
    const scoreA = number(a.bonus_amount) + number(a.apy) * 20 - number(a.effort) * 25 + number(a.liquidity_score);
    const scoreB = number(b.bonus_amount) + number(b.apy) * 20 - number(b.effort) * 25 + number(b.liquidity_score);
    return scoreB - scoreA;
  });
}

function PlanChoice({ title, subtitle, icon, options, selected, onChange }: {
  title: string; subtitle: string; icon: React.ReactNode; options: Opportunity[]; selected?: Opportunity; onChange: (id: string) => void;
}) {
  return (
    <article className="plan-card">
      <div className="plan-card-head"><span className="plan-card-icon">{icon}</span><div><h3>{title}</h3><p>{subtitle}</p></div><span className="rank-badge">Top match</span></div>
      <div className="plan-card-body">
        <select className="plan-select" aria-label={"Choose " + title} value={selected?.id || ""} onChange={(event) => onChange(event.target.value)}>
          {options.map((option, index) => <option key={option.id} value={option.id}>#{index + 1} · {option.institution} · {number(option.bonus_amount) ? money.format(number(option.bonus_amount)) : number(option.apy).toFixed(2) + "% APY"}</option>)}
        </select>
        {selected ? (
          <div className="opportunity-detail">
            <h4>{selected.institution}</h4>
            <p>{selected.product_name}</p>
            <span className="review-pill">Review required before opening</span>
            <div className="detail-list">
              <div><span>Estimated value</span><b>{number(selected.bonus_amount) ? money.format(number(selected.bonus_amount)) + " bonus" : number(selected.apy).toFixed(2) + "% APY"}</b></div>
              <div><span>Requirement</span><b>{number(selected.direct_deposit_required) ? money.format(number(selected.direct_deposit_required)) + " DD" : number(selected.required_balance) ? money.format(number(selected.required_balance)) + " balance" : "No set balance"}</b></div>
              <div><span>Time window</span><b>{selected.qualification_days ? selected.qualification_days + " days" : "Ongoing"}</b></div>
              <div><span>Confidence</span><b>{number(selected.evidence_confidence)}%</b></div>
            </div>
            <a className="card-link" href={selected.official_url} target="_blank" rel="noreferrer">Official offer <ArrowUpRight size={14} /></a>
          </div>
        ) : <div className="opportunity-detail"><p>No matching opportunity is available yet.</p></div>}
      </div>
    </article>
  );
}

export function PlanDashboard({ profile, opportunities, guestMode = false }: { profile: FinancialProfile; opportunities: Opportunity[]; guestMode?: boolean }) {
  const preference = profile.ranking_preference || "balanced";
  const directDeposit = useMemo(() => rank(opportunities.filter((item) => item.category === "checking_bonus"), preference), [opportunities, preference]);
  const savings = useMemo(() => rank(opportunities.filter((item) => item.category === "hysa" || item.category === "savings_bonus"), preference), [opportunities, preference]);
  const spending = useMemo(() => rank(opportunities.filter((item) => item.category === "debit_spend"), preference), [opportunities, preference]);
  const [ddId, setDdId] = useState(directDeposit[0]?.id || "");
  const [hysaId, setHysaId] = useState(savings[0]?.id || "");
  const [spendId, setSpendId] = useState(spending[0]?.id || "");
  const dd = directDeposit.find((item) => item.id === ddId) || directDeposit[0];
  const hysa = savings.find((item) => item.id === hysaId) || savings[0];
  const spend = spending.find((item) => item.id === spendId) || spending[0];

  const totalCash = number(profile.total_cash);
  const reserve = Math.min(totalCash, number(profile.emergency_reserve));
  const deployable = Math.max(0, totalCash - reserve);
  const bonusBucket = Math.min(deployable, number(dd?.required_balance));
  const hysaBucket = Math.max(0, deployable - bonusBucket);
  const projected = number(dd?.bonus_amount) + number(spend?.bonus_amount) + hysaBucket * number(hysa?.apy) / 100;
  const baseline = totalCash * number(profile.current_hysa_apy) / 100;
  const extra = Math.max(0, projected - baseline);

  return (
    <>
      <section className="plan-summary">
        <div className="summary-main">
          <div className="summary-label-row"><span className="kicker">{guestMode ? "YOUR PRACTICE PLAN" : "YOUR BEST CURRENT SPLIT"}</span><span className="optimized-pill"><Sparkles size={13} /> Optimized</span></div>
          <h2>Keep your reserve liquid, earn on the rest, and route your paycheck toward one bonus at a time.</h2>
          <p>This plan favors {preference === "balanced" ? "a balance of profit and effort" : preference}. It never moves money for you, and every offer should be rechecked before you apply.</p>
          <div className="summary-stats">
            <div><small>Emergency reserve</small><strong>{money.format(reserve)}</strong></div>
            <div><small>High-yield bucket</small><strong>{money.format(hysaBucket)}</strong></div>
            <div><small>Bonus balance bucket</small><strong>{money.format(bonusBucket)}</strong></div>
          </div>
        </div>
        <div className="summary-side">
          <div className="stat-card positive"><small>Projected annual value</small><strong>{money.format(projected)}</strong></div>
          <div className="stat-card"><small>Extra vs. current APY</small><strong>+{money.format(extra)}</strong></div>
        </div>
      </section>
      <section className="plan-grid">
        <PlanChoice title="Direct Deposit" subtitle="Route income, not savings" icon={<Landmark size={20} />} options={directDeposit} selected={dd} onChange={setDdId} />
        <PlanChoice title="HYSA" subtitle="Keep idle cash earning" icon={<ShieldCheck size={20} />} options={savings} selected={hysa} onChange={setHysaId} />
        <PlanChoice title="Spending" subtitle="Use only normal purchases" icon={<CreditCard size={20} />} options={spending} selected={spend} onChange={setSpendId} />
      </section>
    </>
  );
}
