"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { CheckCircle2, ChevronDown, CircleDollarSign, Clock3, ShieldCheck, TimerReset } from "lucide-react";
import type { Mission } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";

const money = new Intl.NumberFormat("en-US", { style: "currency", currency: "USD", maximumFractionDigits: 0 });

function daysBetween(start?: string | null, end?: string | null) {
  if (!start || !end) return null;
  const a = new Date(start + "T00:00:00");
  const b = new Date(end + "T00:00:00");
  return Math.max(0, Math.ceil((b.getTime() - a.getTime()) / 86400000));
}

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function progressFor(mission: Mission) {
  if (mission.status === "completed" || mission.status === "closed") return { percent: 100, total: 0, elapsed: 0, remaining: 0 };
  const start = mission.opened_at;
  const end = mission.qualification_deadline || mission.payout_due_date || mission.safe_close_review_date;
  const total = daysBetween(start, end);
  const elapsed = daysBetween(start, todayIso());
  if (!total || elapsed === null) return { percent: 12, total: total || 0, elapsed: elapsed || 0, remaining: total || null };
  const bounded = Math.min(total, Math.max(0, elapsed));
  return { percent: Math.min(100, Math.round((bounded / total) * 100)), total, elapsed: bounded, remaining: Math.max(0, total - bounded) };
}

function readableDate(value?: string | null) {
  if (!value) return "Not set";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(value + "T00:00:00"));
}

function safetyLabel(mission: Mission) {
  const confidence = Number(mission.opportunity?.evidence_confidence || 0);
  const gate = mission.opportunity?.safety_gate;
  if (gate === "pass" && confidence >= 80) return "High";
  if (confidence >= 70) return "Moderate";
  return "Review";
}

function MissionCard({ mission }: { mission: Mission }) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [steps, setSteps] = useState(mission.mission_steps || []);
  const progress = progressFor(mission);
  const opportunity = mission.opportunity;
  const completedSteps = steps.filter((step) => step.is_complete).length;
  const reward = Number(mission.expected_bonus || 0) + Number(mission.expected_interest || 0);
  const monthlyFee = Number(opportunity?.monthly_fee || 0);
  const safeClose = mission.safe_close_review_date;

  async function toggleStep(stepId: string, complete: boolean) {
    const supabase = createClient();
    const nextSteps = steps.map((step) => step.id === stepId ? { ...step, is_complete: complete, completed_at: complete ? new Date().toISOString() : null } : step);
    const { error } = await supabase.from("mission_steps").update({ is_complete: complete, completed_at: complete ? new Date().toISOString() : null, updated_at: new Date().toISOString() }).eq("id", stepId);
    if (error) return;

    setSteps(nextSteps);
    const allComplete = nextSteps.length > 0 && nextSteps.every((step) => step.is_complete);
    if (allComplete && mission.status !== "completed") {
      const completedDate = todayIso();
      await supabase.from("missions").update({ status: "completed", next_action: safeClose ? `Reward complete. Review whether to keep or close the account on ${readableDate(safeClose)}.` : "Reward complete. Review whether this account is still worth keeping.", updated_at: new Date().toISOString() }).eq("id", mission.id);
      const { data: existingHistory } = await supabase.from("account_history").select("id").eq("user_id", mission.user_id).eq("institution", mission.institution).eq("product_name", mission.title).eq("bonus_received_at", completedDate).maybeSingle();
      if (!existingHistory) {
        await supabase.from("account_history").insert({ user_id: mission.user_id, institution: mission.institution, product_name: mission.title, opened_at: mission.opened_at, bonus_received_at: completedDate, bonus_amount: reward, outcome: "completed", eligible_again_at: null, notes: "Completed through Churning reward tracker" });
      }
      router.refresh();
    } else if (!allComplete && mission.status === "completed") {
      await supabase.from("missions").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", mission.id);
      router.refresh();
    }
  }

  return (
    <article className="reward-card">
      <div className="reward-card-top">
        <div><span className="reward-bank">{mission.institution}</span><h3>{mission.title}</h3></div>
        <div className="reward-value"><small>{mission.status === "completed" ? "Reward earned" : "Expected reward"}</small><strong>{money.format(reward)}</strong></div>
      </div>
      <div className="reward-progress-row">
        <div className="reward-progress-copy"><strong>{progress.percent}% complete</strong><span>{mission.status === "completed" ? "Reward completed" : progress.total ? `${progress.elapsed} of ${progress.total} days · ${progress.remaining} days left` : "Tracking requirements"}</span></div>
        <span className="reward-status">{mission.status.replaceAll("_", " ")}</span>
      </div>
      <div className="reward-progress-track" aria-label={`${progress.percent}% complete`}><span style={{ width: `${progress.percent}%` }} /></div>
      <div className="reward-quick-grid">
        <div><Clock3 size={16} /><span><small>Qualify by</small><b>{readableDate(mission.qualification_deadline)}</b></span></div>
        <div><CircleDollarSign size={16} /><span><small>Reward timing</small><b>{readableDate(mission.payout_due_date)}</b></span></div>
        <div><TimerReset size={16} /><span><small>Safe close review</small><b>{readableDate(safeClose)}</b></span></div>
        <div><ShieldCheck size={16} /><span><small>Safety</small><b>{safetyLabel(mission)}</b></span></div>
      </div>
      <div className="reward-next-action"><span>Next action</span><strong>{mission.next_action || "Review the offer requirements."}</strong></div>
      {monthlyFee > 0 && <div className="reward-fee-warning"><strong>{money.format(monthlyFee)}/mo fee after opening.</strong> {opportunity?.fee_waiver_summary || "Review how to waive this fee before deciding whether to keep the account."}</div>}
      <button type="button" className="reward-expand" onClick={() => setExpanded((value) => !value)}>{expanded ? "Hide details" : "Requirements & closing plan"}<ChevronDown size={17} className={expanded ? "rotated" : ""} /></button>
      {expanded && <div className="reward-details">
        <div className="reward-step-list"><div className="reward-section-title"><span>Requirements</span><b>{completedSteps}/{steps.length} complete</b></div>{steps.map((step) => <label key={step.id} className="reward-step"><input type="checkbox" checked={step.is_complete} onChange={(event) => toggleStep(step.id, event.target.checked)} /><span>{step.is_complete ? <CheckCircle2 size={17} /> : <span className="step-circle" />}{step.label}</span></label>)}</div>
        <div className="reward-close-plan"><div className="reward-section-title"><span>After the reward</span></div><p>{monthlyFee > 0 ? `This account may cost ${money.format(monthlyFee)} per month unless the fee is waived. Review the fee-waiver rule before keeping it long term.` : "There is no stored monthly fee for this offer. You can consider keeping the account if it remains useful."}</p><p><strong>Do not close before:</strong> {readableDate(safeClose)}. This is a review date based on the stored qualification, payout, and minimum-account-age windows—not a guarantee that closing is allowed.</p>{opportunity?.eligibility_notes && <p><strong>Eligibility:</strong> {opportunity.eligibility_notes}</p>}{opportunity?.terms_summary && <p><strong>Stored terms:</strong> {opportunity.terms_summary}</p>}</div>
      </div>}
    </article>
  );
}

export function RewardTracker({ missions }: { missions: Mission[] }) {
  const [tab, setTab] = useState<"active" | "completed">("active");
  const active = useMemo(() => missions.filter((mission) => mission.status !== "completed" && mission.status !== "closed"), [missions]);
  const completed = useMemo(() => missions.filter((mission) => mission.status === "completed" || mission.status === "closed"), [missions]);
  const lifetime = completed.reduce((sum, mission) => sum + Number(mission.expected_bonus || 0) + Number(mission.expected_interest || 0), 0);
  const shown = tab === "active" ? active : completed;
  return <section className="reward-tracker-shell">
    <div className="reward-tracker-head"><div><span className="kicker">REWARD TRACKER</span><h2>Track every dollar from open to safe close.</h2><p>This is your control center for qualification windows, payouts, requirements, fees, and account exit dates.</p></div><div className="reward-lifetime"><small>Completed earnings</small><strong>{money.format(lifetime)}</strong><span>{completed.length} completed · {active.length} active</span></div></div>
    <div className="reward-tabs"><button className={tab === "active" ? "active" : ""} onClick={() => setTab("active")}>Active rewards <span>{active.length}</span></button><button className={tab === "completed" ? "active" : ""} onClick={() => setTab("completed")}>Completed <span>{completed.length}</span></button></div>
    <div className="reward-grid">{shown.length ? shown.map((mission) => <MissionCard mission={mission} key={mission.id} />) : <div className="reward-empty"><CircleDollarSign size={26} /><h3>{tab === "active" ? "No active rewards yet" : "No completed rewards yet"}</h3><p>{tab === "active" ? "Add one of your recommended opportunities and it will appear here as a live tracker." : "Finished bonuses and interest will build your lifetime earnings history here."}</p></div>}</div>
  </section>;
}
