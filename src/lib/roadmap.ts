import type { FinancialProfile, Mission, MissionStep, Opportunity } from "@/lib/types";
import { accountLifecycleGuidance, localTodayIso, money, numberValue } from "@/lib/plan-math";

export type RoadmapAction = {
  label: string;
  detail: string;
  tone: "start" | "progress" | "wait" | "reward" | "review";
  date: string | null;
};

export type RoadmapTimelineEvent = {
  key: string;
  missionId: string;
  date: string;
  title: string;
  detail: string;
  tone: "action" | "deadline" | "reward" | "review";
};

export type LiveRoadmapMission = {
  mission: Mission;
  action: RoadmapAction;
  lifecycle: ReturnType<typeof accountLifecycleGuidance> | null;
  requirementPercent: number;
  ddTarget: number;
  ddRecorded: number;
  ddRemaining: number;
  monthlyDdNeeded: number;
  cashAmount: number;
  expectedValue: number;
};

export type LiveCashBonusRoadmap = {
  strategyName: "Simple" | "Balanced" | "Active";
  totalCash: number;
  reserve: number;
  deployableCash: number;
  selectedCash: number;
  remainingCash: number;
  cashOverage: number;
  monthlyDdStream: number;
  monthlyDdUsed: number;
  monthlyDdRemaining: number;
  ddOverage: number;
  potentialRewardValue: number;
  potentialRewardCount: number;
  missions: LiveRoadmapMission[];
  timeline: RoadmapTimelineEvent[];
};

function dateAtNoon(value?: string | null) {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T12:00:00`);
  return Number.isFinite(date.getTime()) ? date : null;
}

function daysUntil(value?: string | null, today = localTodayIso()) {
  const end = dateAtNoon(value);
  const start = dateAtNoon(today);
  if (!end || !start) return null;
  return Math.ceil((end.getTime() - start.getTime()) / 86_400_000);
}

function formatDate(value?: string | null) {
  const date = dateAtNoon(value);
  if (!date) return "the stored deadline";
  return new Intl.DateTimeFormat("en-US", { month: "short", day: "numeric" }).format(date);
}

function stepOf(mission: Mission, type: string) {
  return (mission.mission_steps || []).find((step) => step.step_type === type);
}

function qualificationSteps(mission: Mission) {
  return (mission.mission_steps || []).filter((step) => step.step_type !== "bonus_received");
}

export function requirementProgress(mission: Mission) {
  const steps = qualificationSteps(mission);
  if (!steps.length) return mission.opened_at ? 100 : 0;
  return Math.round((steps.filter((step) => step.is_complete).length / steps.length) * 100);
}

export function remainingOnStep(step?: MissionStep | null) {
  if (!step) return 0;
  return Math.max(0, numberValue(step.target_amount) - numberValue(step.current_amount));
}

export function monthlyDdNeedForMission(mission: Mission, today = localTodayIso()) {
  const opportunity = mission.opportunity;
  const ddStep = stepOf(mission, "direct_deposit");
  if (!opportunity || !ddStep || ddStep.is_complete) return 0;

  const remaining = remainingOnStep(ddStep);
  if (remaining <= 0) return 0;

  const daysLeft = daysUntil(mission.qualification_deadline, today);
  if (daysLeft !== null && daysLeft > 0) {
    return remaining / Math.max(1, daysLeft / 30.4375);
  }

  const storedMonthly = numberValue(opportunity.reward_monthly_dd_threshold);
  if (storedMonthly > 0) return storedMonthly;

  const windowDays = Math.max(30, numberValue(opportunity.direct_deposit_window_days || opportunity.qualification_days || 30));
  return remaining / Math.max(1, windowDays / 30.4375);
}

export function missionRoadmapAction(mission: Mission, today = localTodayIso()): RoadmapAction {
  const opportunity = mission.opportunity;
  const lifecycle = opportunity ? accountLifecycleGuidance(opportunity) : null;
  const expected = numberValue(mission.expected_bonus) + numberValue(mission.expected_interest);
  const openStep = stepOf(mission, "open_account");
  const ddStep = stepOf(mission, "direct_deposit");
  const holdStep = stepOf(mission, "hold");
  const spendStep = stepOf(mission, "spend");
  const rewardStep = stepOf(mission, "bonus_received");

  if (mission.status === "cancelled") {
    return { label: "Removed from roadmap", detail: "This item is no longer active.", tone: "review", date: null };
  }

  if (!mission.opened_at || openStep?.is_complete === false || mission.status === "planned") {
    const ddTarget = numberValue(ddStep?.target_amount || opportunity?.direct_deposit_required);
    const cashTarget = Math.max(numberValue(holdStep?.target_amount), numberValue(opportunity?.required_balance), numberValue(opportunity?.min_opening_deposit));
    const next = ddTarget > 0
      ? `Open the account, then set up qualifying DD toward ${money.format(ddTarget)}.`
      : cashTarget > 0
        ? `Open the account, then fund about ${money.format(cashTarget)}.`
        : "Open the account and confirm the real opening date.";
    return {
      label: "Start this account",
      detail: next,
      tone: "start",
      date: null,
    };
  }

  if (ddStep && !ddStep.is_complete) {
    const remaining = remainingOnStep(ddStep);
    const recorded = numberValue(ddStep.current_amount);
    const target = numberValue(ddStep.target_amount);
    return {
      label: remaining > 0 ? `Send ${money.format(remaining)} more in qualifying DD` : "Confirm the DD requirement",
      detail: `${money.format(recorded)} of ${money.format(target)} recorded${mission.qualification_deadline ? ` · target date ${formatDate(mission.qualification_deadline)}` : ""}.`,
      tone: "progress",
      date: mission.qualification_deadline || null,
    };
  }

  if (holdStep && !holdStep.is_complete) {
    const target = numberValue(holdStep.target_amount);
    const current = numberValue(holdStep.current_amount);
    const remaining = Math.max(0, target - current);
    if (remaining > 0) {
      return {
        label: `Add ${money.format(remaining)} to reach the required balance`,
        detail: `${money.format(current)} of ${money.format(target)} recorded.`,
        tone: "progress",
        date: mission.qualification_deadline || null,
      };
    }

    const days = daysUntil(mission.qualification_deadline, today);
    return {
      label: days !== null && days <= 0 ? "Balance window reached — verify qualification" : `Keep ${money.format(target)} in place`,
      detail: mission.qualification_deadline
        ? `Maintain the tracked balance through ${formatDate(mission.qualification_deadline)} before treating the requirement as complete.`
        : "Keep the stored balance in place until the offer requirement is confirmed.",
      tone: "wait",
      date: mission.qualification_deadline || null,
    };
  }

  if (spendStep && !spendStep.is_complete) {
    const remaining = remainingOnStep(spendStep);
    return {
      label: remaining > 0 ? `Complete ${money.format(remaining)} more in qualifying spend` : "Finish the purchase requirement",
      detail: mission.qualification_deadline ? `Track only purchases that actually qualify · target date ${formatDate(mission.qualification_deadline)}.` : "Confirm the qualifying purchases in the tracker.",
      tone: "progress",
      date: mission.qualification_deadline || null,
    };
  }

  const benefitDays = daysUntil(mission.benefit_end_date, today);
  if (benefitDays !== null && benefitDays >= 0 && benefitDays <= 30) {
    return {
      label: benefitDays === 0 ? "Promotional benefit ends today" : `Promotional benefit ends in ${benefitDays} days`,
      detail: "Compare the next savings or bonus move before the stored promotional period ends.",
      tone: "review",
      date: mission.benefit_end_date || null,
    };
  }

  const nonRewardComplete = qualificationSteps(mission).every((step) => step.is_complete);
  if (rewardStep && !rewardStep.is_complete && nonRewardComplete) {
    const payoutDays = daysUntil(mission.payout_due_date, today);
    if (payoutDays !== null && payoutDays <= 0) {
      return {
        label: `Check whether the ${money.format(expected)} reward posted`,
        detail: "Only mark the reward received after you see the actual payout in the account.",
        tone: "reward",
        date: mission.payout_due_date || null,
      };
    }
    return {
      label: mission.payout_due_date ? `Watch for the reward by ${formatDate(mission.payout_due_date)}` : "Watch for the reward",
      detail: `Requirements look complete. Expected tracked value: ${money.format(expected)}.`,
      tone: "reward",
      date: mission.payout_due_date || null,
    };
  }

  if (mission.status === "complete" || rewardStep?.is_complete) {
    const closeDays = daysUntil(mission.safe_close_review_date, today);
    return {
      label: lifecycle?.shortLabel || "Review what to do with the account",
      detail: mission.safe_close_review_date && closeDays !== null && closeDays > 0
        ? `Reward recorded. Keep the account unchanged until the review point on ${formatDate(mission.safe_close_review_date)}; then re-check current terms.`
        : lifecycle?.text || "Reward recorded. Review current terms before keeping, moving money, or closing.",
      tone: "review",
      date: mission.safe_close_review_date || null,
    };
  }

  return {
    label: mission.next_action || "Review the current requirements",
    detail: "Keep the tracker updated from actual account activity.",
    tone: "progress",
    date: mission.qualification_deadline || mission.payout_due_date || null,
  };
}

function timelineForMission(mission: Mission, today = localTodayIso()): RoadmapTimelineEvent[] {
  if (mission.status === "cancelled") return [];
  const lifecycle = mission.opportunity ? accountLifecycleGuidance(mission.opportunity) : null;
  const action = missionRoadmapAction(mission, today);
  const events: RoadmapTimelineEvent[] = [{
    key: `${mission.id}-now`,
    missionId: mission.id,
    date: today,
    title: `${mission.institution}: ${action.label}`,
    detail: action.detail,
    tone: "action",
  }];

  if (mission.qualification_deadline) {
    events.push({
      key: `${mission.id}-qualify`,
      missionId: mission.id,
      date: mission.qualification_deadline,
      title: `${mission.institution} qualification target`,
      detail: "Check the tracker against actual DD, balance, or spend activity before treating the requirement as complete.",
      tone: "deadline",
    });
  }

  if (mission.payout_due_date) {
    events.push({
      key: `${mission.id}-payout`,
      missionId: mission.id,
      date: mission.payout_due_date,
      title: `${mission.institution} reward check`,
      detail: `Check for about ${money.format(numberValue(mission.expected_bonus) + numberValue(mission.expected_interest))}; record the actual amount only after it posts.`,
      tone: "reward",
    });
  }

  if (mission.benefit_end_date) {
    events.push({
      key: `${mission.id}-benefit`,
      missionId: mission.id,
      date: mission.benefit_end_date,
      title: `${mission.institution} promotional benefit review`,
      detail: "Compare the next destination before the stored promotional period ends.",
      tone: "review",
    });
  }

  if (mission.safe_close_review_date) {
    events.push({
      key: `${mission.id}-close`,
      missionId: mission.id,
      date: mission.safe_close_review_date,
      title: `${mission.institution}: ${lifecycle?.shortLabel || "account review"}`,
      detail: lifecycle?.text || "Re-check current terms before moving money or closing the account.",
      tone: "review",
    });
  }

  return events;
}

function strategyName(profile: FinancialProfile): LiveCashBonusRoadmap["strategyName"] {
  const mode = Math.max(1, Math.min(3, Number(profile.strategy_mode || 2)));
  return mode === 1 ? "Simple" : mode === 3 ? "Active" : "Balanced";
}

export function buildLiveCashBonusRoadmap({
  profile,
  missions,
  today = localTodayIso(),
}: {
  profile: FinancialProfile;
  missions: Mission[];
  today?: string;
}): LiveCashBonusRoadmap {
  const totalCash = Math.max(0, numberValue(profile.total_cash));
  const reserve = Math.min(totalCash, Math.max(0, numberValue(profile.emergency_reserve)));
  const deployableCash = Math.max(0, totalCash - reserve);

  const liveMissions = missions.filter((mission) => !["cancelled", "closed"].includes(mission.status));
  const futureOrActiveMissions = liveMissions.filter((mission) => {
    if (mission.status !== "complete") return true;
    const reviewDays = daysUntil(mission.safe_close_review_date, today);
    return reviewDays === null || reviewDays >= 0;
  });

  const missionStates = futureOrActiveMissions.map((mission) => {
    const ddStep = stepOf(mission, "direct_deposit");
    const ddTarget = numberValue(ddStep?.target_amount);
    const ddRecorded = numberValue(ddStep?.current_amount);
    return {
      mission,
      action: missionRoadmapAction(mission, today),
      lifecycle: mission.opportunity ? accountLifecycleGuidance(mission.opportunity) : null,
      requirementPercent: requirementProgress(mission),
      ddTarget,
      ddRecorded,
      ddRemaining: Math.max(0, ddTarget - ddRecorded),
      monthlyDdNeeded: monthlyDdNeedForMission(mission, today),
      cashAmount: Math.max(0, numberValue(mission.amount_committed)),
      expectedValue: Math.max(0, numberValue(mission.expected_bonus) + numberValue(mission.expected_interest)),
    };
  });

  const selectedCash = missionStates.reduce((sum, item) => sum + item.cashAmount, 0);
  const remainingCash = Math.max(0, deployableCash - selectedCash);
  const cashOverage = Math.max(0, selectedCash - deployableCash);
  const monthlyDdStream = Math.max(0, numberValue(profile.biweekly_pay)) * (26 / 12);
  const monthlyDdUsed = missionStates.reduce((sum, item) => sum + item.monthlyDdNeeded, 0);
  const monthlyDdRemaining = Math.max(0, monthlyDdStream - monthlyDdUsed);
  const ddOverage = Math.max(0, monthlyDdUsed - monthlyDdStream);

  const potentialMissions = missionStates.filter((item) => item.mission.status !== "complete" && !stepOf(item.mission, "bonus_received")?.is_complete);
  const potentialRewardValue = potentialMissions.reduce((sum, item) => sum + item.expectedValue, 0);

  const timeline = missionStates
    .flatMap((item) => timelineForMission(item.mission, today))
    .filter((event, index, rows) => rows.findIndex((candidate) => candidate.key === event.key) === index)
    .filter((event) => {
      const d = daysUntil(event.date, today);
      return d === null || d >= -2;
    })
    .sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title))
    .slice(0, 18);

  return {
    strategyName: strategyName(profile),
    totalCash,
    reserve,
    deployableCash,
    selectedCash,
    remainingCash,
    cashOverage,
    monthlyDdStream,
    monthlyDdUsed,
    monthlyDdRemaining,
    ddOverage,
    potentialRewardValue,
    potentialRewardCount: potentialMissions.length,
    missions: missionStates,
    timeline,
  };
}
