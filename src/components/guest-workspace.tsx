"use client";

import { useMemo, useState } from "react";
import { DatabaseZap, ShieldCheck, Sparkles } from "lucide-react";
import { PlanDashboard } from "@/components/plan-dashboard";
import { RecommendedOpportunities } from "@/components/recommended-opportunities";
import { RewardTracker } from "@/components/reward-tracker";
import { money, numberValue, timelineFromOpenedDate, trackedInterestEstimate } from "@/lib/plan-math";
import type { FinancialProfile, Mission, MissionStep, Opportunity, PlanStartDetails } from "@/lib/types";

function guestStepId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function purchaseRequirement(opportunity: Opportunity) {
  const count = Math.max(0, Number(opportunity.purchase_count || 0));
  const minimum = numberValue(opportunity.purchase_min_amount);
  if (!count) return null;
  return minimum > 0
    ? `${count} qualifying purchases of at least ${money.format(minimum)} each`
    : `${count} qualifying purchases`;
}

function makeGuestMission(opportunity: Opportunity, details: PlanStartDetails): Mission {
  const missionId = guestStepId("guest-mission");
  const now = new Date().toISOString();
  const timeline = details.openedAt ? timelineFromOpenedDate(opportunity, details.openedAt, details.trackingDays) : {
    qualificationDeadline: null,
    payoutDueDate: null,
    minimumAccountAgeDate: null,
    safeCloseReviewDate: null,
  };
  const expectedInterest = trackedInterestEstimate(opportunity, details.amountCommitted, details.trackingDays);
  const expectedTotalEarnings = numberValue(opportunity.bonus_amount) + expectedInterest;
  let stepOrder = 1;

  const steps: MissionStep[] = [
    {
      id: guestStepId("opened"),
      mission_id: missionId,
      user_id: "guest",
      label: "Account opened and opening date confirmed",
      step_type: "opened",
      step_order: stepOrder++,
      is_complete: details.openedAlready,
      completed_at: details.openedAlready ? now : null,
    },
  ];

  const ddTarget = numberValue(opportunity.direct_deposit_required);
  if (ddTarget > 0) {
    const depositCount = Math.max(0, Number(opportunity.dd_deposit_count || 0));
    const minimumEach = numberValue(opportunity.dd_min_each);
    const detail = depositCount > 0 && minimumEach > 0
      ? ` · ${depositCount} deposits of at least ${money.format(minimumEach)}`
      : "";
    steps.push({
      id: guestStepId("dd"),
      mission_id: missionId,
      user_id: "guest",
      label: `Qualifying direct deposits (${money.format(ddTarget)} target${detail})`,
      step_type: "direct_deposit",
      step_order: stepOrder++,
      target_amount: ddTarget,
      current_amount: Math.min(details.plannedDirectDeposit, ddTarget),
      is_complete: details.plannedDirectDeposit >= ddTarget,
      completed_at: details.plannedDirectDeposit >= ddTarget ? now : null,
    });
  }

  const purchaseRule = purchaseRequirement(opportunity);
  if (purchaseRule) {
    steps.push({
      id: guestStepId("purchase"),
      mission_id: missionId,
      user_id: "guest",
      label: purchaseRule,
      step_type: "purchase_requirement",
      step_order: stepOrder++,
      is_complete: false,
      completed_at: null,
    });
  }

  const balanceTarget = numberValue(opportunity.required_balance);
  if (balanceTarget > 0) {
    steps.push({
      id: guestStepId("balance"),
      mission_id: missionId,
      user_id: "guest",
      label: `Required balance (${money.format(balanceTarget)} target)`,
      step_type: "balance_hold",
      step_order: stepOrder++,
      target_amount: balanceTarget,
      current_amount: details.amountCommitted,
      is_complete: false,
      completed_at: null,
    });
  }

  steps.push({
    id: guestStepId("reward"),
    mission_id: missionId,
    user_id: "guest",
    label: opportunity.category === "hysa" && numberValue(opportunity.bonus_amount) <= 0 ? "Actual interest earned during tracked period" : expectedInterest > 0 ? "Actual reward + interest received" : "Reward received",
    step_type: "reward_received",
    step_order: stepOrder,
    target_amount: expectedTotalEarnings,
    current_amount: 0,
    is_complete: false,
    completed_at: null,
  });

  const nextAction = details.openedAlready
    ? ddTarget > 0
      ? `Complete ${money.format(ddTarget)} in qualifying direct deposits.`
      : purchaseRule
        ? `Complete ${purchaseRule.toLowerCase()}.`
        : balanceTarget > 0
          ? "Confirm the required balance is in place and keep it through the stored qualification period."
          : opportunity.category === "hysa"
            ? "Keep the tracked balance in place and review the rate and terms through your selected tracking period."
            : "Complete the stored qualification requirements."
    : "Open the account, then confirm the opening date to start the tracking clock.";

  return {
    id: missionId,
    user_id: "guest",
    opportunity_id: opportunity.id,
    institution: opportunity.institution,
    title: opportunity.product_name,
    amount_committed: details.amountCommitted,
    expected_bonus: numberValue(opportunity.bonus_amount),
    expected_interest: expectedInterest,
    opened_at: details.openedAt,
    qualification_deadline: timeline.qualificationDeadline,
    payout_due_date: timeline.payoutDueDate,
    minimum_account_age_date: timeline.minimumAccountAgeDate,
    safe_close_review_date: timeline.safeCloseReviewDate,
    status: details.openedAlready ? "active" : "planned",
    quick_access_url: opportunity.official_url,
    next_action: nextAction,
    mission_steps: steps,
    opportunity,
  };
}

export function GuestWorkspace({
  profile,
  opportunities,
  usedBanks,
  stateCode,
}: {
  profile: FinancialProfile;
  opportunities: Opportunity[];
  usedBanks: string[];
  stateCode?: string | null;
}) {
  const [missions, setMissions] = useState<Mission[]>([]);
  const addedOpportunityIds = useMemo(() => missions.map((mission) => mission.opportunity_id).filter(Boolean) as string[], [missions]);

  function addGuestMission(opportunity: Opportunity, details: PlanStartDetails) {
    setMissions((current) => current.some((mission) => mission.opportunity_id === opportunity.id && !["completed", "closed"].includes(mission.status))
      ? current
      : [makeGuestMission(opportunity, details), ...current]);
  }

  return (
    <div className="guest-workspace">
      <div className="guest-workspace-banner">
        <div><DatabaseZap size={18} /><span><b>Temporary practice workspace</b><small>Everything below lives only in this browser page. Refreshing or leaving clears it.</small></span></div>
        <div><ShieldCheck size={16} /><span>Same recommendation and tracking flow · no database writes</span></div>
      </div>

      {missions.length === 0 ? (
        <>
          <div className="workspace-start-callout"><Sparkles size={18} /><div><b>Start here</b><p>Your numbers are ready. Review the safety-cleared queue below. If research is still on hold, you can inspect the candidates without starting a tracker yet.</p></div></div>
          <RecommendedOpportunities profile={profile} opportunities={opportunities} usedBanks={usedBanks} stateCode={stateCode} guestMode onGuestAdd={addGuestMission} addedOpportunityIds={addedOpportunityIds} prominent />
          <div className="dashboard-section-label"><span className="kicker">PRACTICE CASH ALLOCATION</span><p>See how the rest of your available cash could stay liquid while you evaluate a reward.</p></div>
          <PlanDashboard profile={profile} opportunities={opportunities} guestMode stateCode={stateCode} />
        </>
      ) : (
        <>
          <RewardTracker missions={missions} guestMode onGuestMissionsChange={setMissions} />
          <RecommendedOpportunities profile={profile} opportunities={opportunities} usedBanks={usedBanks} stateCode={stateCode} guestMode onGuestAdd={addGuestMission} addedOpportunityIds={addedOpportunityIds} />
          <div className="dashboard-section-label"><span className="kicker">PRACTICE CASH ALLOCATION</span><p>Keep the cash that is not committed to a reward working without sacrificing your emergency reserve.</p></div>
          <PlanDashboard profile={profile} opportunities={opportunities} guestMode stateCode={stateCode} />
        </>
      )}
    </div>
  );
}
