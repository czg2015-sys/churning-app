import type { AccountHistory, FinancialProfile, Mission, Opportunity } from "@/lib/types";
import { numberValue, rankMatches } from "@/lib/plan-math";

type Ranked = ReturnType<typeof rankMatches>[number];

export function isBonusOffer(item: Opportunity) {
  return ["checking_bonus", "savings_bonus", "debit_spend", "credit_card_bonus", "brokerage_bonus"].includes(item.category)
    && numberValue(item.bonus_amount) > 0;
}

function normalizeInstitution(value: string | null | undefined) {
  return (value || "").toLowerCase().replace(/[^a-z0-9]/g, "");
}

export function hasPriorBonusHistory(item: Opportunity, history: AccountHistory[]) {
  // Do not guess an institution's repeat-bonus waiting period. Until rules are
  // verified per offer, bank history keeps incentive offers out of recommendations.
  if (!isBonusOffer(item)) return false;
  return history.some((entry) =>
    (Boolean(entry.opportunity_id) && entry.opportunity_id === item.id)
    || (Boolean(normalizeInstitution(entry.institution))
      && normalizeInstitution(entry.institution) === normalizeInstitution(item.institution)));
}

export function isPastDeadline(item: Opportunity, now = Date.now()) {
  if (!item.expires_at) return false;
  const deadline = Date.parse(item.expires_at);
  return Number.isFinite(deadline) && deadline < now;
}

export function preliminarilyFits(
  result: Ranked | undefined,
  history: AccountHistory[],
  activeIds: Set<string>,
  now = Date.now(),
) {
  return Boolean(result
    && result.cashFit >= 100
    && result.ddFit >= 100
    && result.spendFit >= 100
    && !hasPriorBonusHistory(result.item, history)
    && !activeIds.has(result.item.id)
    && !isPastDeadline(result.item, now));
}

export function monthlyDepositNeed(item: Opportunity) {
  const repeating = numberValue(item.reward_monthly_dd_threshold);
  const total = numberValue(item.direct_deposit_required);
  const windowDays = Math.max(14, numberValue(item.direct_deposit_window_days || item.qualification_days || 30));
  return Math.max(repeating, total / Math.max(1, windowDays / 30));
}

export type Combination = {
  first: Ranked;
  second: Ranked;
  totalMonthlyDeposits: number;
  availableMonthlyDeposits: number;
};

// A pairing is a potential *split payroll* strategy. One transfer cannot be
// counted at two institutions, and the banks' definitions must be rechecked.
export function findConcurrentDepositPair(
  ranked: Ranked[],
  profile: FinancialProfile,
  history: AccountHistory[],
  missions: Mission[],
): Combination | null {
  if (profile.employer_multiple_dd !== true) return null;

  const active = missions.filter((m) => !["complete", "cancelled"].includes(m.status));
  const capacity = Math.max(1, Math.min(3, Math.floor(numberValue(profile.strategy_mode) || 2)));
  if (active.length + 2 > capacity) return null;

  const existingNeed = active.reduce((total, mission) => {
    if (!mission.opportunity) return total;
    const step = (mission.mission_steps || []).find((s) => s.step_type === "direct_deposit");
    if (step?.is_complete || (step && numberValue(step.target_amount) > 0 && numberValue(step.current_amount) >= numberValue(step.target_amount))) return total;
    return total + monthlyDepositNeed(mission.opportunity);
  }, 0);

  // Two ordinary biweekly paychecks, rather than an optimistic monthly average.
  const available = Math.max(0, numberValue(profile.biweekly_pay) * 2 - existingNeed);
  const activeIds = new Set(active.map((m) => m.opportunity_id).filter((id): id is string => Boolean(id)));
  const candidates = ranked.filter((result) => result.item.category === "checking_bonus"
    && result.safetyPassed
    && preliminarilyFits(result, history, activeIds)
    && numberValue(result.item.direct_deposit_required) > 0
    && numberValue(result.item.direct_deposit_window_days || result.item.qualification_days) >= 28);

  for (let i = 0; i < candidates.length; i++) {
    for (let j = i + 1; j < candidates.length; j++) {
      const first = candidates[i];
      const second = candidates[j];
      if (normalizeInstitution(first.item.institution) === normalizeInstitution(second.item.institution)) continue;
      const total = monthlyDepositNeed(first.item) + monthlyDepositNeed(second.item);
      if (total <= available + 0.01) {
        return { first, second, totalMonthlyDeposits: total, availableMonthlyDeposits: available };
      }
    }
  }
  return null;
}
