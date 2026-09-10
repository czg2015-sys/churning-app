import { BadgeDollarSign, Clock3, Droplets, ShieldCheck } from "lucide-react";
import { AddToPlanButton } from "@/components/add-to-plan-button";
import type { FinancialProfile, Opportunity } from "@/lib/types";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });
const number = (value: number | string | null | undefined) => Number(value || 0);

function fitScore(item: Opportunity, profile: FinancialProfile, usedBanks: string[]) {
  const totalCash = number(profile.total_cash);
  const reserve = number(profile.emergency_reserve);
  const deployable = Math.max(0, totalCash - reserve);
  const availablePay = Math.max(0, number(profile.biweekly_pay) - number(profile.biweekly_essential_spend));
  const requiredCash = Math.max(number(item.required_balance), number(item.min_opening_deposit));
  const requiredDD = number(item.direct_deposit_required);
  const profit = number(item.bonus_amount) + (number(item.apy) / 100) * Math.max(0, deployable);
  const cashFit = requiredCash <= deployable ? 100 : Math.max(0, 100 - ((requiredCash - deployable) / Math.max(requiredCash, 1)) * 100);
  const ddFit = !requiredDD ? 100 : availablePay > 0 ? Math.min(100, (availablePay * Math.max(1, number(item.direct_deposit_window_days) / 14)) / requiredDD * 100) : 15;
  const safety = item.safety_gate === "pass" ? number(item.evidence_confidence) : Math.min(60, number(item.evidence_confidence));
  const liquidity = number(item.liquidity_score);
  const effort = Math.max(1, number(item.effort));
  const historyPenalty = usedBanks.some((bank) => bank.toLowerCase() === item.institution.toLowerCase()) ? 18 : 0;
  const modePenalty = Number(profile.strategy_mode) === 1 ? (effort - 1) * 12 : Number(profile.strategy_mode) === 2 ? (effort - 1) * 6 : 0;
  const score = profit * .09 + cashFit * .23 + ddFit * .18 + safety * .25 + liquidity * .16 - historyPenalty - modePenalty;
  return { score, cashFit, ddFit, safety, historyMatch: historyPenalty > 0 };
}

export function RecommendedOpportunities({ profile, opportunities, usedBanks = [] }: { profile: FinancialProfile; opportunities: Opportunity[]; usedBanks?: string[] }) {
  const ranked = opportunities
    .filter((item) => item.offer_status === "live")
    .map((item) => ({ item, ...fitScore(item, profile, usedBanks) }))
    .filter((result) => result.safety >= 70)
    .sort((a, b) => b.score - a.score)
    .slice(0, 5);

  return (
    <section className="recommendations-shell">
      <div className="recommendations-head">
        <div><span className="kicker">TOP 5 FOR YOU</span><h2>Your next best reward opportunities.</h2><p>Ranked from your cash, paycheck, liquidity preference, effort level, research confidence, and bank history.</p></div>
        <span className="recommendation-refresh"><span /> Personalized ranking</span>
      </div>
      <div className="recommendation-list">
        {ranked.length ? ranked.map((result, index) => {
          const item = result.item;
          const reward = number(item.bonus_amount);
          const requirement = number(item.direct_deposit_required) ? `${money.format(number(item.direct_deposit_required))} DD` : number(item.required_balance) ? `${money.format(number(item.required_balance))} balance` : "No fixed balance";
          return (
            <article className="recommendation-card" key={item.id}>
              <div className="recommendation-rank">#{index + 1}</div>
              <div className="recommendation-main">
                <div className="recommendation-title-row"><div><span>{item.institution}</span><h3>{item.product_name}</h3></div><strong>{reward ? money.format(reward) : `${number(item.apy).toFixed(2)}% APY`}</strong></div>
                <div className="recommendation-metrics">
                  <span><ShieldCheck size={14} /> Safety {result.safety >= 80 ? "High" : "Moderate"}</span>
                  <span><BadgeDollarSign size={14} /> {requirement}</span>
                  <span><Clock3 size={14} /> {item.qualification_days ? `${item.qualification_days} days` : "Ongoing"}</span>
                  <span><Droplets size={14} /> Liquidity {number(item.liquidity_score)}/100</span>
                </div>
                <p>{result.historyMatch ? `You reported prior ${item.institution} history, so re-check new-customer eligibility before applying. ` : ""}{item.terms_summary || "Review the official terms before applying; stored offer details can change."}</p>
              </div>
              <div className="recommendation-cta"><AddToPlanButton opportunity={item} /><a href={item.official_url} target="_blank" rel="noreferrer">Official terms</a></div>
            </article>
          );
        }) : <div className="reward-empty"><ShieldCheck size={26} /><h3>No recommendations cleared the current filter</h3><p>We would rather show fewer options than push an offer with weak research or a poor fit.</p></div>}
      </div>
    </section>
  );
}
