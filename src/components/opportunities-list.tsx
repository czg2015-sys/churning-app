"use client";

import { useMemo, useState } from "react";
import { ArrowUpRight, ShieldCheck } from "lucide-react";
import { AddToPlanButton } from "@/components/add-to-plan-button";
import type { Opportunity } from "@/lib/types";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const value = (input: number | string | null | undefined) => Number(input || 0);
const filters = [
  { id: "all", label: "All" },
  { id: "checking_bonus", label: "Direct deposit" },
  { id: "hysa", label: "High-yield savings" },
  { id: "savings_bonus", label: "Savings bonuses" },
  { id: "debit_spend", label: "Spending" },
];

function safetyText(item: Opportunity) {
  const confidence = value(item.evidence_confidence);
  if (item.safety_gate === "pass" && confidence >= 80) return "High";
  if (confidence >= 70) return "Moderate";
  return "Review";
}

export function OpportunitiesList({ opportunities }: { opportunities: Opportunity[] }) {
  const [filter, setFilter] = useState("all");
  const visible = useMemo(() => opportunities
    .filter((item) => filter === "all" || item.category === filter)
    .sort((a, b) => value(b.bonus_amount) + value(b.apy) * 100 - (value(a.bonus_amount) + value(a.apy) * 100)), [filter, opportunities]);

  return (
    <>
      <div className="opportunity-toolbar" role="group" aria-label="Filter opportunities">
        {filters.map((item) => <button key={item.id} type="button" className={"filter-pill " + (filter === item.id ? "active" : "")} onClick={() => setFilter(item.id)}>{item.label}</button>)}
      </div>
      <div className="opportunity-table">
        <div className="opportunity-row opportunity-row-expanded header"><span>OPPORTUNITY</span><span>VALUE</span><span>REQUIREMENT</span><span>SAFETY</span><span>ACTION</span></div>
        {visible.map((item) => (
          <article className="opportunity-row opportunity-row-expanded" key={item.id}>
            <div className="institution"><span className="institution-mark">{item.institution.slice(0, 1)}</span><p><strong>{item.institution}</strong><small>{item.product_name}</small></p></div>
            <div className="metric"><strong>{value(item.bonus_amount) ? money.format(value(item.bonus_amount)) : value(item.apy).toFixed(2) + "%"}</strong><small>{value(item.bonus_amount) ? "Potential bonus" : "Current APY"}</small></div>
            <div className="metric"><strong>{value(item.direct_deposit_required) ? money.format(value(item.direct_deposit_required)) + " DD" : value(item.required_balance) ? money.format(value(item.required_balance)) : "None listed"}</strong><small>{item.qualification_days ? item.qualification_days + "-day window" : "Ongoing"}</small></div>
            <div className="metric"><div className="confidence"><ShieldCheck size={14} /> {safetyText(item)}</div><small>{value(item.evidence_confidence)}% research confidence</small></div>
            <div className="opportunity-actions">
              <AddToPlanButton opportunity={item} compact />
              <a className="external-link" href={item.official_url} target="_blank" rel="noreferrer" aria-label={`View official ${item.institution} offer`}>Terms <ArrowUpRight size={14} /></a>
            </div>
          </article>
        ))}
      </div>
    </>
  );
}
