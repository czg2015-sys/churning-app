import { Activity, BadgeDollarSign, Landmark, ShieldCheck, WalletCards } from "lucide-react";
import { money, numberValue } from "@/lib/plan-math";
import type { FinancialProfile, Mission } from "@/lib/types";

function actualEarned(mission: Mission) {
  if (!['completed', 'closed'].includes(mission.status)) return 0;
  const payoutStep = (mission.mission_steps || []).find((step) => step.step_type === "reward_received");
  return numberValue(payoutStep?.current_amount);
}

export function PlanCommandSummary({ profile, missions, usedBanks }: { profile: FinancialProfile; missions: Mission[]; usedBanks: string[] }) {
  const active = missions.filter((mission) => !["completed", "closed"].includes(mission.status));
  const completed = missions.filter((mission) => ["completed", "closed"].includes(mission.status));
  const committed = active.reduce((sum, mission) => sum + numberValue(mission.amount_committed), 0);
  const expected = active.reduce((sum, mission) => sum + numberValue(mission.expected_bonus) + numberValue(mission.expected_interest), 0);
  const earned = completed.reduce((sum, mission) => sum + actualEarned(mission), 0);
  const available = Math.max(0, numberValue(profile.total_cash) - numberValue(profile.emergency_reserve) - committed);
  const trackedRecentOpenings = missions.filter((mission) => {
    if (!mission.opened_at) return false;
    const opened = new Date(`${mission.opened_at.slice(0, 10)}T12:00:00`).getTime();
    return Date.now() - opened <= 365 * 86_400_000;
  }).length;
  const reportedRecentOpenings = Math.max(0, numberValue(profile.recent_bank_openings));
  const recentOpenings = Math.max(reportedRecentOpenings, trackedRecentOpenings);

  const healthTone = recentOpenings >= 6 ? "watch" : recentOpenings >= 3 ? "moderate" : "good";
  const healthText = recentOpenings >= 6
    ? "Higher account velocity — slow down and review bank-specific screening and eligibility rules before adding more."
    : recentOpenings >= 3
      ? "Moderate account velocity — keep eligibility, prior-bank history, and screening behavior in mind."
      : "Account velocity looks light based on the history you reported and rewards tracked here.";

  return (
    <section className="command-summary">
      <div className="command-summary-copy">
        <span className="kicker">MY PLAN · LIVE CONTROL CENTER</span>
        <h1>{active.length ? "Know exactly what your cash is doing." : "Build your first high-confidence cash move."}</h1>
        <p>{active.length ? "Active rewards, committed cash, deadlines, and the next best opportunities are organized around what you actually entered—not a generic checklist." : "Your profile is ready. Start with the recommendation queue, add the real opening details, and the tracker will take over from there."}</p>
        <div className="command-summary-badges"><span><ShieldCheck size={14} /> You move the money</span><span><Activity size={14} /> No automatic account actions</span><span><Landmark size={14} /> {usedBanks.length} banks in history</span></div>
      </div>
      <div className="command-metric-grid">
        <article><span><WalletCards size={16} /> Deployable now</span><strong>{money.format(available)}</strong><small>after reserve + tracked commitments</small></article>
        <article><span><BadgeDollarSign size={16} /> Active expected</span><strong>{money.format(expected)}</strong><small>not counted as earned until confirmed</small></article>
        <article className="positive"><span><BadgeDollarSign size={16} /> Lifetime earned</span><strong>{money.format(earned)}</strong><small>{completed.length} completed rewards</small></article>
        <article><span><Landmark size={16} /> Cash committed</span><strong>{money.format(committed)}</strong><small>{active.length} active / planned rewards</small></article>
      </div>
      <div className={`banking-health ${healthTone}`}><span><ShieldCheck size={17} /></span><div><small>BANKING HEALTH SIGNAL</small><b>{recentOpenings} reported or tracked openings in the last 12 months</b><p>{healthText} This is a planning signal, not a universal bank approval rule.</p></div></div>
    </section>
  );
}
