"use client";

import { useMemo, useState } from "react";
import { CalendarDays, Check, Landmark, Plus, ShieldCheck, Sparkles, WalletCards, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import { FormattedNumberInput } from "@/components/formatted-number-input";
import { benefitDurationLabel, categoryLabel, money, numberValue, timelineFromOpenedDate, trackedInterestEstimate, verificationAgeDays } from "@/lib/plan-math";
import type { Opportunity, PlanStartDetails } from "@/lib/types";

function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

function purchaseRequirement(opportunity: Opportunity) {
  const count = Math.max(0, Number(opportunity.purchase_count || 0));
  const minimum = numberValue(opportunity.purchase_min_amount);
  if (!count) return null;
  return minimum > 0
    ? `${count} qualifying purchases of at least ${money.format(minimum)} each`
    : `${count} qualifying purchases`;
}

export function AddToPlanButton({
  opportunity,
  compact = false,
  guestMode = false,
  onGuestAdd,
  alreadyAdded = false,
  allowGuestSimulationOnHold = false,
  allowPlanningOnHold = false,
}: {
  opportunity: Opportunity;
  compact?: boolean;
  guestMode?: boolean;
  onGuestAdd?: (opportunity: Opportunity, details: PlanStartDetails) => void;
  alreadyAdded?: boolean;
  allowGuestSimulationOnHold?: boolean;
  allowPlanningOnHold?: boolean;
}) {
  const router = useRouter();
  const [saving, setSaving] = useState(false);
  const [added, setAdded] = useState(alreadyAdded);
  const [error, setError] = useState("");
  const [open, setOpen] = useState(false);
  const [openedAlready, setOpenedAlready] = useState(false);

  const suggestedCommitment = useMemo(
    () => Math.max(numberValue(opportunity.required_balance), numberValue(opportunity.min_opening_deposit)),
    [opportunity],
  );
  const suggestedDirectDeposit = numberValue(opportunity.direct_deposit_required);
  const purchaseRule = purchaseRequirement(opportunity);
  const needsCustomHysaHorizon = opportunity.category === "hysa" && !numberValue(opportunity.benefit_duration_days || opportunity.qualification_days || opportunity.direct_deposit_window_days);
  const benefitLabel = benefitDurationLabel(opportunity);
  const showFundingDate = openedAlready && ["hysa", "savings_bonus"].includes(opportunity.category);
  const showFirstDdDate = openedAlready && suggestedDirectDeposit > 0;

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");

    const form = new FormData(event.currentTarget);
    const trackingDays = needsCustomHysaHorizon ? Math.max(30, Number(form.get("tracking_days") || 90)) : null;
    const reminderMode = String(form.get("reminder_mode") || "default");
    const details: PlanStartDetails = {
      openedAlready,
      openedAt: openedAlready ? String(form.get("opened_at") || todayIso()) : null,
      fundedAt: openedAlready && form.get("funded_at") ? String(form.get("funded_at")) : null,
      firstDdAt: openedAlready && form.get("first_dd_at") ? String(form.get("first_dd_at")) : null,
      amountCommitted: Math.max(0, numberValue(String(form.get("amount_committed") || 0))),
      plannedDirectDeposit: Math.max(0, numberValue(String(form.get("planned_dd") || 0))),
      trackingDays,
      reminderEnabled: reminderMode === "on" ? true : reminderMode === "off" ? false : null,
    };

    if (guestMode) {
      onGuestAdd?.(opportunity, details);
      setAdded(true);
      setSaving(false);
      setOpen(false);
      return;
    }

    const supabase = createClient();
    const { data: claimsData } = await supabase.auth.getClaims();
    const userId = claimsData?.claims?.sub;
    if (!userId) {
      router.push("/auth?next=/my-plan");
      return;
    }

    const { data: existing } = await supabase
      .from("missions")
      .select("id")
      .eq("user_id", userId)
      .eq("opportunity_id", opportunity.id)
      .in("status", ["planned", "active", "waiting_bonus", "bonus_received", "safe_to_close"])
      .maybeSingle();

    if (existing) {
      setAdded(true);
      setSaving(false);
      setOpen(false);
      router.push("/my-plan");
      return;
    }

    const benefitStartOverride = opportunity.benefit_start_trigger === "funded_at"
      ? details.fundedAt
      : opportunity.benefit_start_trigger === "first_dd_at"
        ? details.firstDdAt
        : details.openedAt;
    const qualificationStartOverride = opportunity.qualification_start_trigger === "funded_at"
      ? details.fundedAt
      : opportunity.qualification_start_trigger === "first_dd_at"
        ? details.firstDdAt
        : details.openedAt;
    const timeline = details.openedAt ? timelineFromOpenedDate(opportunity, details.openedAt, details.trackingDays, benefitStartOverride, qualificationStartOverride) : {
      qualificationStartDate: null,
      qualificationDeadline: null,
      payoutDueDate: null,
      minimumAccountAgeDate: null,
      safeCloseReviewDate: null,
      benefitStartDate: null,
      benefitEndDate: null,
    };
    const expectedInterest = trackedInterestEstimate(opportunity, details.amountCommitted, details.trackingDays);
    const expectedTotalEarnings = numberValue(opportunity.bonus_amount) + expectedInterest;

    const nextAction = details.openedAlready
      ? suggestedDirectDeposit > 0
        ? `Complete ${money.format(suggestedDirectDeposit)} in qualifying direct deposits.`
        : purchaseRule
          ? `Complete ${purchaseRule.toLowerCase()}.`
          : numberValue(opportunity.required_balance) > 0
            ? "Confirm the required balance is in place and keep it through the stored qualification period."
            : opportunity.category === "hysa"
              ? "Keep the tracked balance in place and review the rate and terms through your selected tracking period."
              : "Complete the stored qualification requirements."
      : "Open the account, then confirm the opening date to start the tracking clock.";

    const { data: mission, error: missionError } = await supabase
      .from("missions")
      .insert({
        user_id: userId,
        opportunity_id: opportunity.id,
        institution: opportunity.institution,
        title: opportunity.product_name,
        amount_committed: details.amountCommitted,
        expected_bonus: numberValue(opportunity.bonus_amount),
        expected_interest: expectedInterest,
        opened_at: details.openedAt,
        qualification_start_date: timeline.qualificationStartDate,
        qualification_deadline: timeline.qualificationDeadline,
        payout_due_date: timeline.payoutDueDate,
        minimum_account_age_date: timeline.minimumAccountAgeDate,
        safe_close_review_date: timeline.safeCloseReviewDate,
        funded_at: details.fundedAt,
        first_dd_at: details.firstDdAt,
        benefit_start_date: timeline.benefitStartDate,
        benefit_end_date: timeline.benefitEndDate,
        email_reminders_enabled: details.reminderEnabled,
        status: details.openedAlready ? "active" : "planned",
        quick_access_url: opportunity.official_url,
        next_action: nextAction,
      })
      .select("id")
      .single();

    if (missionError || !mission) {
      setError(missionError?.message || "Could not add this offer yet.");
      setSaving(false);
      return;
    }

    const now = new Date().toISOString();
    let stepOrder = 1;
    const steps: Array<Record<string, unknown>> = [
      {
        mission_id: mission.id,
        user_id: userId,
        label: "Account opened and opening date confirmed",
        step_type: "open_account",
        step_order: stepOrder++,
        is_complete: details.openedAlready,
        completed_at: details.openedAlready ? now : null,
      },
    ];

    if (suggestedDirectDeposit > 0) {
      const depositCount = Math.max(0, Number(opportunity.dd_deposit_count || 0));
      const minimumEach = numberValue(opportunity.dd_min_each);
      const detail = depositCount > 0 && minimumEach > 0
        ? ` · ${depositCount} deposits of at least ${money.format(minimumEach)}`
        : "";
      steps.push({
        mission_id: mission.id,
        user_id: userId,
        label: `Qualifying direct deposits (${money.format(suggestedDirectDeposit)} target${detail})`,
        step_type: "direct_deposit",
        step_order: stepOrder++,
        target_amount: suggestedDirectDeposit,
        current_amount: Math.min(details.plannedDirectDeposit, suggestedDirectDeposit),
        is_complete: details.plannedDirectDeposit >= suggestedDirectDeposit,
        completed_at: details.plannedDirectDeposit >= suggestedDirectDeposit ? now : null,
      });
    }

    if (purchaseRule) {
      steps.push({
        mission_id: mission.id,
        user_id: userId,
        label: purchaseRule,
        step_type: "spend",
        step_order: stepOrder++,
        is_complete: false,
        completed_at: null,
      });
    }

    if (numberValue(opportunity.required_balance) > 0) {
      const target = numberValue(opportunity.required_balance);
      steps.push({
        mission_id: mission.id,
        user_id: userId,
        label: `Required balance (${money.format(target)} target)`,
        step_type: "hold",
        step_order: stepOrder++,
        target_amount: target,
        current_amount: details.amountCommitted,
        is_complete: false,
        completed_at: null,
      });
    }

    steps.push({
      mission_id: mission.id,
      user_id: userId,
      label: opportunity.category === "hysa" && numberValue(opportunity.bonus_amount) <= 0 ? "Actual interest earned during tracked period" : expectedInterest > 0 ? "Actual reward + interest received" : "Reward received",
      step_type: "bonus_received",
      step_order: stepOrder,
      target_amount: expectedTotalEarnings,
      current_amount: 0,
      is_complete: false,
      completed_at: null,
    });

    const { error: stepError } = await supabase.from("mission_steps").insert(steps);
    if (stepError) {
      await supabase.from("missions").delete().eq("id", mission.id);
      setError("The tracker checklist could not be created, so Churning rolled back the add. Please try again.");
      setSaving(false);
      return;
    }

    setAdded(true);
    setSaving(false);
    setOpen(false);
    router.push("/my-plan");
    router.refresh();
  }

  const displayedAdded = added || alreadyAdded;
  const verificationAge = verificationAgeDays(opportunity.last_verified_at);
  const safetyGate = (opportunity.safety_gate || "").toLowerCase();
  const safetyCleared = ["green", "pass"].includes(safetyGate)
    && numberValue(opportunity.evidence_confidence) >= 80
    && verificationAge !== null
    && verificationAge <= 7;
  const simulationOnly = !safetyCleared && guestMode && allowGuestSimulationOnHold;
  const planningWithPendingResearch = !safetyCleared && allowPlanningOnHold;
  const canOpen = safetyCleared || simulationOnly || planningWithPendingResearch;

  return (
    <div className={compact ? "add-plan-wrap compact" : "add-plan-wrap"}>
      <button
        className={displayedAdded || !canOpen ? "button ghost compact" : simulationOnly ? "button simulation compact" : "button primary compact"}
        type="button"
        onClick={() => !displayedAdded && canOpen && setOpen(true)}
        disabled={displayedAdded || !canOpen}
        title={!safetyCleared && !simulationOnly && !planningWithPendingResearch ? "This offer has not cleared Churning’s current confidence, safety, and freshness checks." : simulationOnly ? "Guest simulation only — this offer is still on research hold." : planningWithPendingResearch ? "Add this candidate to your plan for tracking and final verification; this is not a recommendation to open it." : undefined}
      >
        {displayedAdded ? <><Check size={16} /> Added ✓</> : simulationOnly ? <><Sparkles size={16} /> Simulate tracker</> : planningWithPendingResearch ? <><Plus size={16} /> Add for review</> : !safetyCleared ? <><ShieldCheck size={16} /> Research hold</> : <><Plus size={16} /> Add to My Plan</>}
      </button>
      {error && <small className="add-plan-error">{error}</small>}

      {open && (
        <div className="plan-modal-backdrop" role="presentation" onMouseDown={(event: React.MouseEvent<HTMLDivElement>) => event.target === event.currentTarget && setOpen(false)}>
          <div className="plan-modal" role="dialog" aria-modal="true" aria-labelledby={`add-${opportunity.id}`}>
            <button className="plan-modal-close" type="button" onClick={() => setOpen(false)} aria-label="Close"><X size={18} /></button>
            <div className="plan-modal-eyebrow"><ShieldCheck size={14} /> ACCURATE TRACKING SETUP</div>
            <h2 id={`add-${opportunity.id}`}>Add {opportunity.institution} to your plan</h2>
            <p className="plan-modal-lede">Give Churning the real starting details so the countdown, cash commitment, and requirement progress are based on your situation—not a generic example.</p>
            {simulationOnly && <div className="simulation-warning"><Sparkles size={15} /><span><strong>Guest simulation only.</strong> This candidate is still on research hold. Use this to test the tracker experience—not as a recommendation to open the account.</span></div>}
            {planningWithPendingResearch && !simulationOnly && <div className="simulation-warning"><ShieldCheck size={15} /><span><strong>Final verification is still pending.</strong> Adding this candidate creates a planning/tracking item only. Recheck the official terms and unresolved research before opening an account.</span></div>}

            <div className="plan-modal-offer">
              <span className="plan-modal-bank"><Landmark size={18} /></span>
              <div><strong>{opportunity.product_name}</strong><small>{categoryLabel(opportunity)} · {numberValue(opportunity.bonus_amount) > 0 ? `${money.format(numberValue(opportunity.bonus_amount))} potential reward` : `${numberValue(opportunity.apy).toFixed(2)}% APY`}{benefitLabel ? ` · ${benefitLabel}` : ""}</small></div>
              <b>{numberValue(opportunity.evidence_confidence)}% research confidence</b>
            </div>

            <form onSubmit={submit}>
              <div className="plan-modal-toggle">
                <button type="button" className={!openedAlready ? "active" : ""} onClick={() => setOpenedAlready(false)}>Planning to open</button>
                <button type="button" className={openedAlready ? "active" : ""} onClick={() => setOpenedAlready(true)}>Already opened</button>
              </div>

              <div className="plan-modal-grid">
                {openedAlready && <label className="modal-field"><span><CalendarDays size={15} /> Opening date</span><input name="opened_at" type="date" defaultValue={todayIso()} max={todayIso()} required /><small>This starts the main account clock.</small></label>}
                {showFundingDate && <label className="modal-field"><span><CalendarDays size={15} /> Funding date <em>optional</em></span><input name="funded_at" type="date" max={todayIso()} /><small>Add it only if the benefit starts when money is funded.</small></label>}
                {showFirstDdDate && <label className="modal-field"><span><CalendarDays size={15} /> First qualifying DD <em>optional</em></span><input name="first_dd_at" type="date" max={todayIso()} /><small>Add it if the bank starts its measurement period from the first deposit.</small></label>}
                <label className="modal-field"><span><WalletCards size={15} /> Cash committed</span><div className="money-input"><i>$</i><FormattedNumberInput name="amount_committed" defaultValue={suggestedCommitment} ariaLabel="Cash committed" /></div><small>{suggestedCommitment > 0 ? `Stored offer target: ${money.format(suggestedCommitment)}` : "Enter only cash you actually plan to commit."}</small></label>
                {suggestedDirectDeposit > 0 && <label className="modal-field"><span><Landmark size={15} /> Qualifying DD completed so far</span><div className="money-input"><i>$</i><FormattedNumberInput name="planned_dd" defaultValue={0} ariaLabel="Qualifying direct deposit completed so far" /></div><small>Stored target: {money.format(suggestedDirectDeposit)}. Update only deposits that actually posted.</small></label>}
                {needsCustomHysaHorizon && <label className="modal-field"><span><CalendarDays size={15} /> Tracking horizon</span><select name="tracking_days" defaultValue="90"><option value="90">90 days</option><option value="180">180 days</option><option value="365">1 year</option></select><small>This is your review horizon for an ongoing rate, not a bank lockup requirement.</small></label>}
                <label className="modal-field"><span><CalendarDays size={15} /> Email reminders</span><select name="reminder_mode" defaultValue="default"><option value="default">Use my dashboard setting</option><option value="on">On for this offer</option><option value="off">Off for this offer</option></select><small>You can change this later from My Plan.</small></label>
              </div>

              {purchaseRule && <div className="plan-modal-requirement"><strong>Stored spending requirement</strong><span>{purchaseRule}. You will confirm completion manually from your actual account activity.</span></div>}
              <div className="plan-modal-note"><ShieldCheck size={16} /><span>{openedAlready ? "The tracking clock starts from the opening date you enter." : "No countdown starts until you confirm the account was actually opened."} Official terms still control eligibility, payout, fees, and closing rules.</span></div>

              <div className="plan-modal-actions">
                <button type="button" className="button ghost" onClick={() => setOpen(false)}>Cancel</button>
                <button type="submit" className="button primary" disabled={saving}>{saving ? "Adding…" : guestMode ? "Add to practice plan" : "Start tracking"}</button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
