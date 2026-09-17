"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, CalendarClock, ShieldCheck, TriangleAlert } from "lucide-react";
import { AddToPlanButton } from "@/components/add-to-plan-button";
import { latestReview, money, numberValue, reviewStatusLabel, verificationAgeDays } from "@/lib/plan-math";
import type { Opportunity } from "@/lib/types";

const filters = [
  { id: "all", label: "All" },
  { id: "cleared", label: "Safety cleared" },
  { id: "checking_bonus", label: "Direct deposit" },
  { id: "hysa", label: "High-yield savings" },
  { id: "savings_bonus", label: "Savings bonuses" },
  { id: "debit_spend", label: "Debit & spending" },
];

function isCleared(item: Opportunity) {
  const days = verificationAgeDays(item.last_verified_at);
  const gate = (item.safety_gate || "").toLowerCase();
  return ["pass", "green"].includes(gate) && numberValue(item.evidence_confidence) >= 80 && days !== null && days <= 7;
}

function freshness(item: Opportunity) {
  const days = verificationAgeDays(item.last_verified_at);
  if (days === null) return { text: "No verified date", stale: true };
  if (days <= 7) return { text: days === 0 ? "Today" : `${days}d ago`, stale: false };
  return { text: `${days}d old`, stale: true };
}

function promoDuration(item: Opportunity) {
  const days = Math.max(0, Number(item.qualification_days || 0));
  if (item.category !== "hysa" || !days) return null;
  const months = Math.round(days / 30.44);
  if (months >= 1 && Math.abs(days - months * 30.44) <= 18) return `${months}-month promo`;
  return `${days}-day promo`;
}

function valueCaption(item: Opportunity) {
  if (numberValue(item.bonus_amount)) return "Potential reward";
  const promo = promoDuration(item);
  return promo ? `Promotional APY · ${promo.replace(" promo", "")}` : "Current APY";
}

function requirementWindow(item: Opportunity) {
  const promo = promoDuration(item);
  if (promo) return `${promo} period`;
  return item.qualification_days ? `${item.qualification_days}-day window` : "Ongoing";
}

export function OpportunitiesList({ opportunities }: { opportunities: Opportunity[] }) {
  const [filter, setFilter] = useState("all");
  const visible = useMemo(() => opportunities
    .filter((item) => filter === "all" || (filter === "cleared" ? isCleared(item) : item.category === filter))
    .sort((a, b) => {
      const safeDelta = Number(isCleared(b)) - Number(isCleared(a));
      if (safeDelta) return safeDelta;
      return numberValue(b.bonus_amount) + numberValue(b.apy) * 100 - (numberValue(a.bonus_amount) + numberValue(a.apy) * 100);
    }), [filter, opportunities]);

  const clearedCount = opportunities.filter(isCleared).length;
  const holdCount = opportunities.length - clearedCount;
  const staleCount = opportunities.filter((item) => {
    const days = verificationAgeDays(item.last_verified_at);
    return days === null || days > 7;
  }).length;

  return (
    <>
      <div className="opportunity-library-stats">
        <div><small>LIVE RECORDS</small><strong>{opportunities.length}</strong><span>currently stored as live</span></div>
        <div className="positive"><small>SAFETY CLEARED</small><strong>{clearedCount}</strong><span>eligible to enter My Plan</span></div>
        <div className={holdCount ? "warning" : ""}><small>RESEARCH HOLD</small><strong>{holdCount}</strong><span>visible, but not actionable yet</span></div>
        <div className={staleCount ? "warning" : ""}><small>NEEDS RE-VERIFY</small><strong>{staleCount}</strong><span>older than 7 days or missing date</span></div>
      </div>

      <div className="opportunity-toolbar" role="group" aria-label="Filter opportunities">
        {filters.map((item) => <button key={item.id} type="button" className={`filter-pill ${filter === item.id ? "active" : ""}`} onClick={() => setFilter(item.id)}>{item.label}</button>)}
      </div>

      <div className="opportunity-table advanced-opportunity-table">
        <div className="opportunity-row opportunity-row-expanded header"><span>OPPORTUNITY</span><span>VALUE</span><span>REQUIREMENT</span><span>RESEARCH</span><span>ACTION</span></div>
        {visible.map((item) => {
          const fresh = freshness(item);
          const cleared = isCleared(item);
          const review = latestReview(item);
          return (
            <article className={`opportunity-row opportunity-row-expanded ${!cleared ? "research-hold" : ""}`} key={item.id}>
              <div className="institution"><span className={`institution-mark ${cleared ? "cleared" : ""}`}>{item.institution.slice(0, 1)}</span><p><strong>{item.institution}</strong><small>{item.product_name}</small></p></div>
              <div className="metric"><strong>{numberValue(item.bonus_amount) ? money.format(numberValue(item.bonus_amount)) : `${numberValue(item.apy).toFixed(2)}%`}</strong><small>{valueCaption(item)}</small></div>
              <div className="metric"><strong>{numberValue(item.direct_deposit_required) ? `${money.format(numberValue(item.direct_deposit_required))} DD${item.dd_deposit_count ? ` · ${item.dd_deposit_count} deposits` : ""}` : item.purchase_count ? `${item.purchase_count} qualifying purchases${numberValue(item.purchase_min_amount) > 0 ? ` · ${money.format(numberValue(item.purchase_min_amount))}+ each` : ""}` : numberValue(item.required_balance) ? money.format(numberValue(item.required_balance)) : numberValue(item.min_opening_deposit) ? `${money.format(numberValue(item.min_opening_deposit))} opening deposit` : "None listed"}</strong><small>{requirementWindow(item)}{numberValue(item.monthly_fee) > 0 ? ` · ${money.format(numberValue(item.monthly_fee))}/mo fee` : ""}</small></div>
              <div className="metric research-cell"><div className={`confidence ${cleared ? "cleared" : "hold"}`}>{cleared ? <ShieldCheck size={14} /> : <TriangleAlert size={14} />} {cleared ? "Cleared" : "Hold"} · {Math.round(numberValue(item.evidence_confidence))}%</div><small className={fresh.stale ? "stale" : ""}><CalendarClock size={12} /> {fresh.text}</small><small className="screening-line">Pull {reviewStatusLabel(review?.hard_pull_status)} · Chex {reviewStatusLabel(review?.chexsystems_status)}</small></div>
              <div className="opportunity-actions">
                <AddToPlanButton opportunity={item} compact />
                <a className="external-link" href={item.official_url} target="_blank" rel="noreferrer" aria-label={`View official ${item.institution} offer`}>Terms <ArrowUpRight size={14} /></a>
              </div>
            </article>
          );
        })}
      </div>
    </>
  );
}
