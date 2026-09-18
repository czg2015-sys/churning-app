"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import {
  BadgeCheck,
  CalendarDays,
  CheckCircle2,
  ChevronDown,
  CircleDollarSign,
  Clock3,
  Landmark,
  ShieldCheck,
  TimerReset,
  TriangleAlert,
} from "lucide-react";
import type { Mission, MissionStep } from "@/lib/types";
import { createClient } from "@/lib/supabase/client";
import { FormattedNumberInput } from "@/components/formatted-number-input";
import { accountLifecycleGuidance, latestReview, money, numberValue, reviewStatusLabel, timelineFromOpenedDate } from "@/lib/plan-math";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function dateValue(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function daysBetween(start?: string | null, end?: string | null) {
  const a = dateValue(start);
  const b = dateValue(end);
  if (!a || !b) return null;
  return Math.ceil((b.getTime() - a.getTime()) / 86_400_000);
}

function timeProgress(mission: Mission) {
  if (mission.status === "complete" || mission.status === "cancelled") return { percent: 100, total: 0, elapsed: 0, remaining: 0 };
  if (!mission.opened_at) return { percent: 0, total: 0, elapsed: 0, remaining: null as number | null };
  const end = mission.benefit_end_date || mission.qualification_deadline || mission.payout_due_date || mission.safe_close_review_date;
  const total = daysBetween(mission.opened_at, end);
  const elapsedRaw = daysBetween(mission.opened_at, todayIso());
  if (!total || elapsedRaw === null) return { percent: 0, total: total || 0, elapsed: Math.max(0, elapsedRaw || 0), remaining: total || null };
  const elapsed = Math.min(total, Math.max(0, elapsedRaw));
  return { percent: Math.min(100, Math.round((elapsed / total) * 100)), total, elapsed, remaining: Math.max(0, total - elapsed) };
}

function readableDate(value?: string | null) {
  if (!value) return "Not started";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric", year: "numeric" }).format(new Date(`${value.slice(0, 10)}T12:00:00`));
}

function safetyLabel(mission: Mission) {
  const confidence = numberValue(mission.opportunity?.evidence_confidence);
  const gate = mission.opportunity?.safety_gate;
  if ((gate || "").toLowerCase() === "pass" && confidence >= 80) return { label: "Verified", tone: "safe" };
  if (confidence >= 70) return { label: "Needs review", tone: "review" };
  return { label: "Research due", tone: "warning" };
}

function safeCloseState(mission: Mission) {
  if (!mission.safe_close_review_date) return { ready: false, text: "No close-review date stored" };
  const remaining = daysBetween(todayIso(), mission.safe_close_review_date);
  if (remaining === null) return { ready: false, text: "Review date unavailable" };
  if (remaining <= 0) return { ready: true, text: "Close review is due now" };
  return { ready: false, text: `${remaining} days until close review` };
}

function addDaysIso(value: string | null | undefined, days: number | null | undefined) {
  if (!value || !days || days <= 0) return null;
  const date = dateValue(value);
  if (!date) return null;
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function doNotDoWarning(mission: Mission, steps: MissionStep[]) {
  const opportunity = mission.opportunity;
  if (!opportunity || mission.status === "complete" || mission.status === "cancelled") return null;
  const requiredBalance = numberValue(opportunity.required_balance);
  const ddRequired = numberValue(opportunity.direct_deposit_required);
  const safeClose = mission.safe_close_review_date;
  const incomplete = steps.filter((step) => !step.is_complete);
  if (requiredBalance > 0 && mission.qualification_deadline) {
    return `Do not let the tracked balance fall below ${money.format(requiredBalance)} before ${readableDate(mission.qualification_deadline)} unless the current official terms say otherwise.`;
  }
  if (ddRequired > 0 && incomplete.some((step) => step.step_type.toLowerCase().includes("deposit") || step.label.toLowerCase().includes("deposit"))) {
    return `Do not stop or redirect the qualifying direct deposit until the required amount is confirmed in the tracker.`;
  }
  if (safeClose) return `Do not close this account yet. The earliest Churning review date is ${readableDate(safeClose)}; current official terms still control.`;
  return null;
}


function earnedValue(mission: Mission) {
  const rewardStep = (mission.mission_steps || []).find((step) => step.step_type === "bonus_received");
  const actual = numberValue(rewardStep?.current_amount);
  return mission.status === "complete" ? actual : numberValue(mission.expected_bonus) + numberValue(mission.expected_interest);
}

function inferredTrackingDays(mission: Mission) {
  const opportunity = mission.opportunity;
  if (!opportunity || opportunity.category !== "hysa") return null;
  const storedDays = numberValue(opportunity.benefit_duration_days || opportunity.qualification_days || opportunity.direct_deposit_window_days);
  if (storedDays > 0) return storedDays;
  const committed = numberValue(mission.amount_committed);
  const apy = numberValue(opportunity.apy) / 100;
  const expectedInterest = numberValue(mission.expected_interest);
  if (committed <= 0 || apy <= 0 || expectedInterest <= 0) return null;
  return Math.max(30, Math.round((expectedInterest / (committed * apy)) * 365));
}

function requirementPercent(steps: MissionStep[]) {
  if (!steps.length) return 0;
  return Math.round((steps.filter((step) => step.is_complete).length / steps.length) * 100);
}

function StepEditor({ step, onToggle, onAmount }: {
  step: MissionStep;
  onToggle: (step: MissionStep, complete: boolean) => void;
  onAmount: (step: MissionStep, amount: number) => void;
}) {
  const target = numberValue(step.target_amount);
  const current = numberValue(step.current_amount);
  const [amount, setAmount] = useState(current);
  const rewardNeedsAmount = step.step_type === "bonus_received" && target > 0 && current <= 0;

  useEffect(() => setAmount(current), [current]);

  return (
    <div className="reward-step">
      <label className="reward-step-check">
        <input type="checkbox" checked={step.is_complete} disabled={rewardNeedsAmount} onChange={(event: React.ChangeEvent<HTMLInputElement>) => onToggle(step, event.target.checked)} />
        <span>{step.is_complete ? <CheckCircle2 size={18} /> : <span className="step-circle" />}</span>
        <span className="reward-step-copy"><b>{step.label}</b>{target > 0 && <small>{step.step_type === "bonus_received" ? (current > 0 ? `${money.format(current)} actual payout recorded` : `Record the actual payout before confirming`) : `${money.format(current)} recorded of ${money.format(target)} target`}</small>}</span>
      </label>
      {target > 0 && !step.is_complete && (
        <div className="step-amount-editor">
          <span>$</span>
          <FormattedNumberInput name={`step-${step.id}`} value={amount} onValueChange={setAmount} ariaLabel="Recorded amount" />
          <button type="button" onClick={() => onAmount(step, amount)}>Update</button>
        </div>
      )}
    </div>
  );
}

function MissionCard({
  mission,
  guestMode,
  onGuestUpdate,
}: {
  mission: Mission;
  guestMode: boolean;
  onGuestUpdate?: (mission: Mission) => void;
}) {
  const router = useRouter();
  const [expanded, setExpanded] = useState(false);
  const [steps, setSteps] = useState(mission.mission_steps || []);
  const [starting, setStarting] = useState(false);
  const [startDate, setStartDate] = useState(todayIso());
  const [fundedDate, setFundedDate] = useState("");
  const [firstDdDate, setFirstDdDate] = useState("");
  const timeline = timeProgress(mission);
  const requirements = requirementPercent(steps);
  const opportunity = mission.opportunity;
  const review = opportunity ? latestReview(opportunity) : null;
  const completedSteps = steps.filter((step) => step.is_complete).length;
  const reward = earnedValue({ ...mission, mission_steps: steps });
  const monthlyFee = numberValue(opportunity?.monthly_fee);
  const safety = safetyLabel(mission);
  const closeState = safeCloseState(mission);
  const lifecycle = opportunity ? accountLifecycleGuidance(opportunity) : null;
  const doNotDo = doNotDoWarning(mission, steps);
  const feeStartDate = addDaysIso(mission.opened_at, opportunity?.fee_starts_after_days);

  useEffect(() => setSteps(mission.mission_steps || []), [mission.mission_steps]);

  function emitGuest(nextMission: Mission) {
    onGuestUpdate?.(nextMission);
  }

  async function updateStep(step: MissionStep, patch: Partial<MissionStep>) {
    const nextSteps = steps.map((item) => item.id === step.id ? { ...item, ...patch } : item);
    setSteps(nextSteps);

    if (guestMode) {
      const allComplete = nextSteps.length > 0 && nextSteps.every((item) => item.is_complete);
      emitGuest({ ...mission, status: allComplete ? "complete" : mission.status === "complete" ? "active" : mission.status, mission_steps: nextSteps });
      return;
    }

    const supabase = createClient();
    const { error } = await supabase.from("mission_steps").update({ ...patch, updated_at: new Date().toISOString() }).eq("id", step.id);
    if (error) return;

    const allComplete = nextSteps.length > 0 && nextSteps.every((item) => item.is_complete);
    if (allComplete && mission.status !== "complete") {
      const completedDate = todayIso();
      await supabase.from("missions").update({
        status: "complete",
        next_action: mission.safe_close_review_date
          ? `Reward received. Review whether to keep or close the account on ${readableDate(mission.safe_close_review_date)}.`
          : "Reward received. Review whether this account is still worth keeping.",
        updated_at: new Date().toISOString(),
      }).eq("id", mission.id);

      const historyNote = `Completed through Churning reward tracker · mission:${mission.id}`;
      const actualEarned = nextSteps.find((item) => item.step_type === "bonus_received")?.current_amount;
      const earnedAmount = numberValue(actualEarned);
      const { data: existingHistory } = await supabase.from("account_history")
        .select("id")
        .eq("user_id", mission.user_id)
        .eq("notes", historyNote)
        .maybeSingle();

      const historyPayload = {
        institution: mission.institution,
        product_name: mission.title,
        opened_at: mission.opened_at,
        bonus_received_at: completedDate,
        bonus_amount: earnedAmount,
        bonus_received: true,
        outcome: "open",
        eligible_again_at: null,
        notes: historyNote,
        updated_at: new Date().toISOString(),
      };
      if (existingHistory?.id) {
        await supabase.from("account_history").update(historyPayload).eq("id", existingHistory.id);
      } else {
        await supabase.from("account_history").insert({ user_id: mission.user_id, ...historyPayload });
      }
      router.refresh();
    } else if (!allComplete && mission.status === "complete") {
      const historyNote = `Completed through Churning reward tracker · mission:${mission.id}`;
      await supabase.from("missions").update({ status: "active", updated_at: new Date().toISOString() }).eq("id", mission.id);
      await supabase.from("account_history").delete().eq("user_id", mission.user_id).eq("notes", historyNote);
      router.refresh();
    }
  }

  async function toggleStep(step: MissionStep, complete: boolean) {
    await updateStep(step, { is_complete: complete, completed_at: complete ? new Date().toISOString() : null });
  }

  async function updateAmount(step: MissionStep, amount: number) {
    const target = numberValue(step.target_amount);
    const requiresMultipleDeposits = step.step_type === "direct_deposit" && Number(opportunity?.dd_deposit_count || 0) > 1;
    const complete = target > 0 && amount >= target && step.step_type === "direct_deposit" && !requiresMultipleDeposits;
    await updateStep(step, {
      current_amount: Math.max(0, amount),
      is_complete: complete ? true : step.is_complete,
      completed_at: complete ? new Date().toISOString() : step.completed_at,
    });

    if (
      opportunity &&
      step.step_type === "direct_deposit" &&
      amount > 0 &&
      opportunity.qualification_start_trigger === "first_dd_at" &&
      !mission.first_dd_at &&
      mission.opened_at
    ) {
      const firstDd = todayIso();
      const benefitStartOverride = opportunity.benefit_start_trigger === "first_dd_at"
        ? firstDd
        : opportunity.benefit_start_trigger === "funded_at"
          ? mission.funded_at || mission.opened_at
          : mission.opened_at;
      const nextTimeline = timelineFromOpenedDate(
        opportunity,
        mission.opened_at,
        inferredTrackingDays(mission),
        benefitStartOverride,
        firstDd,
      );

      if (guestMode) {
        emitGuest({
          ...mission,
          first_dd_at: firstDd,
          qualification_start_date: nextTimeline.qualificationStartDate,
          qualification_deadline: nextTimeline.qualificationDeadline,
          payout_due_date: nextTimeline.payoutDueDate,
          safe_close_review_date: nextTimeline.safeCloseReviewDate,
          benefit_start_date: nextTimeline.benefitStartDate,
          benefit_end_date: nextTimeline.benefitEndDate,
        });
      } else {
        const supabase = createClient();
        await supabase.from("missions").update({
          first_dd_at: firstDd,
          qualification_start_date: nextTimeline.qualificationStartDate,
          qualification_deadline: nextTimeline.qualificationDeadline,
          payout_due_date: nextTimeline.payoutDueDate,
          safe_close_review_date: nextTimeline.safeCloseReviewDate,
          benefit_start_date: nextTimeline.benefitStartDate,
          benefit_end_date: nextTimeline.benefitEndDate,
          updated_at: new Date().toISOString(),
        }).eq("id", mission.id);
        router.refresh();
      }
    }
  }

  async function startTracker() {
    if (!opportunity || !startDate) return;
    const benefitStartOverride = opportunity.benefit_start_trigger === "funded_at"
      ? fundedDate || startDate
      : opportunity.benefit_start_trigger === "first_dd_at"
        ? firstDdDate || null
        : startDate;
    const qualificationStartOverride = opportunity.qualification_start_trigger === "funded_at"
      ? fundedDate || null
      : opportunity.qualification_start_trigger === "first_dd_at"
        ? firstDdDate || null
        : startDate;
    const nextTimeline = timelineFromOpenedDate(
      opportunity,
      startDate,
      inferredTrackingDays(mission),
      benefitStartOverride,
      qualificationStartOverride,
    );
    const openedStep = steps.find((step) => step.step_type === "open_account");
    const nextSteps = steps.map((step) => step.step_type === "open_account" ? { ...step, is_complete: true, completed_at: new Date().toISOString() } : step);
    const nextMission: Mission = {
      ...mission,
      opened_at: startDate,
      funded_at: fundedDate || null,
      first_dd_at: firstDdDate || null,
      qualification_start_date: nextTimeline.qualificationStartDate,
      qualification_deadline: nextTimeline.qualificationDeadline,
      payout_due_date: nextTimeline.payoutDueDate,
      minimum_account_age_date: nextTimeline.minimumAccountAgeDate,
      safe_close_review_date: nextTimeline.safeCloseReviewDate,
      benefit_start_date: nextTimeline.benefitStartDate,
      benefit_end_date: nextTimeline.benefitEndDate,
      status: "active",
      next_action: numberValue(opportunity.direct_deposit_required) > 0
        ? `Complete ${money.format(numberValue(opportunity.direct_deposit_required))} in qualifying direct deposits.`
        : "Complete the qualification requirements and keep the tracker updated.",
      mission_steps: nextSteps,
    };

    if (guestMode) {
      setSteps(nextSteps);
      emitGuest(nextMission);
      setStarting(false);
      return;
    }

    const supabase = createClient();
    await supabase.from("missions").update({
      opened_at: startDate,
      funded_at: fundedDate || null,
      first_dd_at: firstDdDate || null,
      qualification_start_date: nextTimeline.qualificationStartDate,
      qualification_deadline: nextTimeline.qualificationDeadline,
      payout_due_date: nextTimeline.payoutDueDate,
      minimum_account_age_date: nextTimeline.minimumAccountAgeDate,
      safe_close_review_date: nextTimeline.safeCloseReviewDate,
      benefit_start_date: nextTimeline.benefitStartDate,
      benefit_end_date: nextTimeline.benefitEndDate,
      status: "active",
      next_action: nextMission.next_action,
      updated_at: new Date().toISOString(),
    }).eq("id", mission.id);
    if (openedStep) await supabase.from("mission_steps").update({ is_complete: true, completed_at: new Date().toISOString(), updated_at: new Date().toISOString() }).eq("id", openedStep.id);
    setStarting(false);
    router.refresh();
  }

  return (
    <article className={`reward-card ${mission.status === "planned" ? "planned" : ""}`}>
      <div className="reward-card-top">
        <div className="reward-title-group"><span className="reward-bank">{mission.institution}</span><h3>{mission.title}</h3><span className={`reward-safety ${safety.tone}`}><ShieldCheck size={13} /> {safety.label}</span></div>
        <div className="reward-value"><small>{mission.status === "complete" ? "Reward earned" : "Expected reward"}</small><strong>{money.format(reward)}</strong>{numberValue(mission.amount_committed) > 0 && <span>{money.format(numberValue(mission.amount_committed))} committed</span>}</div>
      </div>

      {mission.status === "planned" && !mission.opened_at ? (
        <div className="reward-start-panel">
          <div><span className="reward-start-icon"><Landmark size={19} /></span><div><b>Added to your queue — clock not started</b><p>We will not guess an opening date. Confirm it only after the account is actually open.</p></div></div>
          {starting ? <div className="reward-start-form">
            <label><small>Opened</small><input type="date" value={startDate} max={todayIso()} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setStartDate(event.target.value)} /></label>
            {opportunity?.benefit_start_trigger === "funded_at" ? <label><small>Funded <em>optional</em></small><input type="date" value={fundedDate} max={todayIso()} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFundedDate(event.target.value)} /></label> : null}
            {opportunity?.qualification_start_trigger === "first_dd_at" || opportunity?.benefit_start_trigger === "first_dd_at" ? <label><small>First DD <em>optional</em></small><input type="date" value={firstDdDate} max={todayIso()} onChange={(event: React.ChangeEvent<HTMLInputElement>) => setFirstDdDate(event.target.value)} /></label> : null}
            <button type="button" className="button primary compact" onClick={startTracker}>Start tracker</button><button type="button" className="button ghost compact" onClick={() => setStarting(false)}>Cancel</button>
          </div> : <button type="button" className="button primary compact" onClick={() => setStarting(true)}>I opened this account</button>}
        </div>
      ) : (
        <div className="reward-progress-zone">
          <div className="reward-progress-block">
            <div className="reward-progress-row"><div><small>TIME WINDOW</small><strong>{timeline.percent}% elapsed</strong></div><span>{timeline.total ? `${timeline.elapsed} of ${timeline.total} days · ${timeline.remaining} left` : "No timed window stored"}</span></div>
            <div className="reward-progress-track time"><span style={{ width: `${timeline.percent}%` }} /></div>
          </div>
          <div className="reward-progress-block">
            <div className="reward-progress-row"><div><small>REQUIREMENTS</small><strong>{requirements}% complete</strong></div><span>{completedSteps} of {steps.length} confirmed</span></div>
            <div className="reward-progress-track requirements"><span style={{ width: `${requirements}%` }} /></div>
          </div>
        </div>
      )}

      <div className="reward-quick-grid">
        <div><Clock3 size={16} /><span><small>{mission.benefit_end_date ? "Benefit ends" : opportunity?.category === "hysa" ? "Tracking period ends" : "Qualify by"}</small><b>{readableDate(mission.benefit_end_date || mission.qualification_deadline)}</b></span></div>
        <div><CircleDollarSign size={16} /><span><small>{opportunity?.category === "hysa" ? "Interest review" : "Expected payout"}</small><b>{readableDate(mission.payout_due_date)}</b></span></div>
        <div><TimerReset size={16} /><span><small>{opportunity?.category === "hysa" ? "Strategy review" : "Safe-close review"}</small><b>{readableDate(mission.safe_close_review_date)}</b></span></div>
        <div className={closeState.ready ? "ready" : ""}><BadgeCheck size={16} /><span><small>{opportunity?.category === "hysa" ? "Review status" : "Exit status"}</small><b>{closeState.text}</b></span></div>
      </div>

      <div className="reward-next-action"><span>NEXT ACTION</span><strong>{mission.next_action || "Review the official offer requirements."}</strong></div>

      {doNotDo && <div className="reward-do-not-warning"><TriangleAlert size={15} /><span><strong>Do not do this yet:</strong> {doNotDo}</span></div>}
      {monthlyFee > 0 && <div className="reward-fee-warning"><TriangleAlert size={15} /><span><strong>{money.format(monthlyFee)}/mo stored monthly fee{feeStartDate ? ` · fee watch starts ${readableDate(feeStartDate)}` : ""}.</strong> {opportunity?.fee_waiver_summary || "Review the current fee-waiver rule before deciding whether to keep the account."}</span></div>}
      {lifecycle && <div className="reward-lifecycle-note"><BadgeCheck size={15} /><span><strong>{lifecycle.label}:</strong> {lifecycle.text}</span></div>}

      <button type="button" className="reward-expand" onClick={() => setExpanded((value) => !value)}>{expanded ? "Hide tracker details" : "Requirements, terms & closing plan"}<ChevronDown size={17} className={expanded ? "rotated" : ""} /></button>

      {expanded && (
        <div className="reward-details">
          <div className="reward-step-list">
            <div className="reward-section-title"><span>Requirement confirmation</span><b>{completedSteps}/{steps.length}</b></div>
            <p className="reward-section-help">Elapsed time does not mark requirements complete. Confirm each item from your actual account activity. “Reward received” is always manual.</p>
            {steps.map((step) => <StepEditor key={step.id} step={step} onToggle={toggleStep} onAmount={updateAmount} />)}
          </div>
          <div className="reward-close-plan">
            <div className="reward-section-title"><span>Account exit plan</span></div>
            <div className="close-plan-date"><CalendarDays size={18} /><div><small>EARLIEST REVIEW DATE</small><b>{readableDate(mission.safe_close_review_date)}</b></div></div>
            <p>{monthlyFee > 0 ? `This account may cost ${money.format(monthlyFee)} per month unless the current waiver rule is satisfied.` : "No monthly fee is stored for this offer, but current terms should still be checked before keeping it long term."}</p>
            <p><strong>{opportunity?.category === "hysa" ? "Treat this as a strategy review, not an automatic transfer date." : "Do not treat this as an automatic close date."}</strong> It is the earliest Churning review point calculated from the stored qualification, payout, tracking, and minimum-account-age windows. Official terms control.</p>
            {review && <div className="reward-safety-audit"><span><small>Hard pull</small><b>{reviewStatusLabel(review.hard_pull_status)}</b></span><span><small>Chex</small><b>{reviewStatusLabel(review.chexsystems_status)}</b></span><span><small>EWS</small><b>{reviewStatusLabel(review.ews_status)}</b></span><span><small>Tax</small><b>{reviewStatusLabel(review.tax_status)}</b></span></div>}
            {review?.safe_close_summary && <p><strong>Research close note:</strong> {review.safe_close_summary}</p>}
            {opportunity?.eligibility_notes && <p><strong>Eligibility note:</strong> {opportunity.eligibility_notes}</p>}
            {opportunity?.terms_summary && <p><strong>Stored terms:</strong> {opportunity.terms_summary}</p>}
            {mission.quick_access_url && <a className="card-link" href={mission.quick_access_url} target="_blank" rel="noreferrer">Open official terms</a>}
          </div>
        </div>
      )}
    </article>
  );
}

export function RewardTracker({
  missions,
  guestMode = false,
  onGuestMissionsChange,
}: {
  missions: Mission[];
  guestMode?: boolean;
  onGuestMissionsChange?: (missions: Mission[]) => void;
}) {
  const [tab, setTab] = useState<"active" | "completed">("active");
  const [guestMissions, setGuestMissions] = useState(missions);

  useEffect(() => {
    if (guestMode) setGuestMissions(missions);
  }, [guestMode, missions]);

  const source = guestMode ? guestMissions : missions;
  const active = useMemo(() => source.filter((mission) => mission.status !== "complete" && mission.status !== "closed"), [source]);
  const completed = useMemo(() => source.filter((mission) => ["complete", "cancelled"].includes(mission.status)), [source]);
  const lifetime = completed.reduce((sum, mission) => sum + earnedValue(mission), 0);
  const expected = active.reduce((sum, mission) => sum + numberValue(mission.expected_bonus) + numberValue(mission.expected_interest), 0);
  const committed = active.reduce((sum, mission) => sum + numberValue(mission.amount_committed), 0);
  const shown = tab === "active" ? active : completed;

  function updateGuestMission(nextMission: Mission) {
    const next = guestMissions.map((mission) => mission.id === nextMission.id ? nextMission : mission);
    setGuestMissions(next);
    onGuestMissionsChange?.(next);
  }

  return (
    <section className="reward-tracker-shell">
      <div className="reward-tracker-head">
        <div><span className="kicker">REWARD MISSION CONTROL</span><h2>Track the clock and the requirements separately.</h2><p>Time passing never means you qualified. Churning keeps the deadline, the actual checklist, payout timing, fees, and close-review date visible in one place.</p></div>
        <div className="reward-head-stats">
          <div><small>Active expected</small><strong>{money.format(expected)}</strong></div>
          <div><small>Cash committed</small><strong>{money.format(committed)}</strong></div>
          <div className="positive"><small>Lifetime earned</small><strong>{money.format(lifetime)}</strong></div>
        </div>
      </div>
      <div className="reward-tabs"><button className={tab === "active" ? "active" : ""} onClick={() => setTab("active")}>Active rewards <span>{active.length}</span></button><button className={tab === "completed" ? "active" : ""} onClick={() => setTab("completed")}>Completed history <span>{completed.length}</span></button></div>
      <div className="reward-grid">
        {shown.length ? shown.map((mission) => <MissionCard mission={mission} guestMode={guestMode} onGuestUpdate={updateGuestMission} key={mission.id} />) : <div className="reward-empty"><CircleDollarSign size={28} /><h3>{tab === "active" ? "No active rewards yet" : "No completed rewards yet"}</h3><p>{tab === "active" ? "Add a recommended opportunity. It will enter your queue first, and its countdown begins only after you confirm the real opening date." : "Only rewards you manually confirm as received are counted in lifetime earnings."}</p></div>}
      </div>
    </section>
  );
}
