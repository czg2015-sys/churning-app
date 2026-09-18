import type { FinancialProfile, Mission, Opportunity } from "@/lib/types";
import { addDaysIso, numberValue, opportunityEconomics, rankMatches } from "@/lib/plan-math";

export type RoadmapOverrides = {
  bonusIds?: string[];
  hysaId?: string | null;
  keepCurrentSavings?: boolean;
};

export type RoadmapBonusSlot = {
  opportunity: Opportunity;
  cashAmount: number;
  monthlyDdAmount: number;
  projectedAdvantage: number;
  researchReady: boolean;
};

export type RoadmapSavingsSlot = {
  opportunity: Opportunity | null;
  amount: number;
  apy: number;
  label: string;
  projectedAdvantage: number;
  isCurrentSavings: boolean;
};

export type CashBonusRoadmap = {
  strategyName: "Simple" | "Balanced" | "Active";
  totalCash: number;
  reserve: number;
  activeCash: number;
  availableCash: number;
  monthlyDdStream: number;
  activeMonthlyDd: number;
  availableMonthlyDd: number;
  bonusCashBudget: number;
  bonusSlots: RoadmapBonusSlot[];
  savingsSlot: RoadmapSavingsSlot;
  bonusCashUsed: number;
  ddUsed: number;
  projectedBonusValue: number;
  projectedIncrementalValue: number;
  warningCount: number;
  planningStartDate: string;
};

type Ranked = ReturnType<typeof rankMatches>[number];

const strategyConfig = {
  1: { name: "Simple" as const, maxBonusSlots: 1, bonusCashShare: 0.45, ddShare: 0.50 },
  2: { name: "Balanced" as const, maxBonusSlots: 2, bonusCashShare: 0.70, ddShare: 0.75 },
  3: { name: "Active" as const, maxBonusSlots: 3, bonusCashShare: 0.90, ddShare: 0.90 },
};

export function roadmapStrategy(profile: FinancialProfile) {
  const mode = Math.max(1, Math.min(3, Number(profile.strategy_mode || 2))) as 1 | 2 | 3;
  return strategyConfig[mode];
}

export function monthlyDdNeed(item: Opportunity) {
  const explicit = numberValue(item.reward_monthly_dd_threshold);
  if (explicit > 0) return explicit;
  const required = numberValue(item.direct_deposit_required);
  if (required <= 0) return 0;
  const days = Math.max(30, numberValue(item.direct_deposit_window_days || item.qualification_days || 30));
  return required / Math.max(1, days / 30);
}

export function opportunityCashNeed(item: Opportunity) {
  return Math.max(numberValue(item.required_balance), numberValue(item.min_opening_deposit));
}

function activeResourceUse(missions: Mission[]) {
  return missions
    .filter((mission) => !["completed", "closed"].includes(mission.status))
    .reduce((acc, mission) => {
      acc.cash += Math.max(0, numberValue(mission.amount_committed));
      if (mission.opportunity) acc.dd += monthlyDdNeed(mission.opportunity);
      return acc;
    }, { cash: 0, dd: 0 });
}

function bonusCandidate(result: Ranked, profile: FinancialProfile) {
  if (result.item.category === "hysa") return false;
  if (["credit_card_bonus", "brokerage_bonus", "cd", "treasury"].includes(result.item.category)) return false;
  if (result.item.category === "debit_spend" && !profile.card_helper_opt_in) return false;
  return result.cashFit >= 95 && result.ddFit >= 90 && result.spendFit >= 75;
}

function roadmapRankValue(result: Ranked, profile: FinancialProfile) {
  const preference = (profile.ranking_preference || "balanced").toLowerCase();
  const advantage = Math.max(-500, Math.min(1500, profile.tax_rate_known ? result.estimatedAfterTaxAdvantage : result.grossAdvantage));
  const cashNeed = opportunityCashNeed(result.item);
  const deployable = Math.max(1, numberValue(profile.total_cash) - numberValue(profile.emergency_reserve));
  const cashShare = Math.min(1, cashNeed / deployable);

  if (preference === "profit") return result.score + advantage * 0.11;
  if (preference === "ease") return result.score - (Math.max(1, result.effort) - 1) * 24 + result.liquidity * 0.04;
  if (preference === "liquidity") return result.score + result.liquidity * 0.12 - cashShare * 36;
  return result.score + advantage * 0.035 + result.liquidity * 0.025;
}

function canAddBonus(
  result: Ranked,
  selected: RoadmapBonusSlot[],
  cashBudget: number,
  ddBudget: number,
  profile: FinancialProfile,
  strategyMode: number,
) {
  const cash = opportunityCashNeed(result.item);
  const dd = monthlyDdNeed(result.item);
  const usedCash = selected.reduce((sum, slot) => sum + slot.cashAmount, 0);
  const usedDd = selected.reduce((sum, slot) => sum + slot.monthlyDdAmount, 0);
  if (usedCash + cash > cashBudget + 0.01) return false;
  if (usedDd + dd > ddBudget + 0.01) return false;

  const ddLanes = selected.filter((slot) => slot.monthlyDdAmount > 0).length + (dd > 0 ? 1 : 0);
  if (ddLanes > 1 && (strategyMode < 3 || profile.employer_multiple_dd !== true)) return false;
  return true;
}

function toBonusSlot(result: Ranked, profile: FinancialProfile): RoadmapBonusSlot {
  const economics = opportunityEconomics(result.item, profile);
  return {
    opportunity: result.item,
    cashAmount: opportunityCashNeed(result.item),
    monthlyDdAmount: monthlyDdNeed(result.item),
    projectedAdvantage: profile.tax_rate_known ? economics.estimatedAfterTaxAdvantage : economics.grossAdvantage,
    researchReady: result.safetyPassed,
  };
}

function bestSavingsSlot(
  amount: number,
  ranked: Ranked[],
  profile: FinancialProfile,
  overrides: RoadmapOverrides,
): RoadmapSavingsSlot {
  const currentApy = Math.max(0, numberValue(profile.current_hysa_apy));
  const hysaCandidates = ranked
    .filter((result) => result.item.category === "hysa")
    .filter((result) => opportunityCashNeed(result.item) <= amount + 0.01)
    .sort((a, b) => numberValue(b.item.apy) - numberValue(a.item.apy) || b.score - a.score);

  const forced = overrides.hysaId
    ? hysaCandidates.find((result) => result.item.id === overrides.hysaId)
    : null;
  const candidate = forced || hysaCandidates[0] || null;

  if (overrides.keepCurrentSavings || !candidate || currentApy >= numberValue(candidate.item.apy)) {
    return {
      opportunity: null,
      amount,
      apy: currentApy,
      label: currentApy > 0 ? "Keep in your current savings / HYSA" : "Keep liquid while you compare savings options",
      projectedAdvantage: 0,
      isCurrentSavings: true,
    };
  }

  const apy = numberValue(candidate.item.apy);
  const days = Math.max(1, numberValue(candidate.item.benefit_duration_days) || 365);
  const projectedAdvantage = amount * Math.max(0, apy - currentApy) / 100 * (days / 365);
  return {
    opportunity: candidate.item,
    amount,
    apy,
    label: `${candidate.item.institution} · ${candidate.item.product_name}`,
    projectedAdvantage,
    isCurrentSavings: false,
  };
}

export function buildCashBonusRoadmap({
  opportunities,
  profile,
  missions,
  usedBanks,
  stateCode,
  overrides = {},
}: {
  opportunities: Opportunity[];
  profile: FinancialProfile;
  missions: Mission[];
  usedBanks: string[];
  stateCode?: string | null;
  overrides?: RoadmapOverrides;
}): CashBonusRoadmap {
  const config = roadmapStrategy(profile);
  const strategyMode = Math.max(1, Math.min(3, Number(profile.strategy_mode || 2)));
  const totalCash = Math.max(0, numberValue(profile.total_cash));
  const reserve = Math.min(totalCash, Math.max(0, numberValue(profile.emergency_reserve)));
  const resources = activeResourceUse(missions);
  const deployableBeforeActive = Math.max(0, totalCash - reserve);
  const activeCash = Math.min(deployableBeforeActive, resources.cash);
  const availableCash = Math.max(0, deployableBeforeActive - activeCash);
  const monthlyDdStream = Math.max(0, numberValue(profile.biweekly_pay)) * (26 / 12);
  const activeMonthlyDd = Math.min(monthlyDdStream, resources.dd);
  const availableMonthlyDd = Math.max(0, monthlyDdStream - activeMonthlyDd);
  const bonusCashBudget = availableCash * config.bonusCashShare;
  const ddBudget = availableMonthlyDd * config.ddShare;

  const activeIds = new Set(
    missions
      .filter((mission) => !["completed", "closed"].includes(mission.status))
      .map((mission) => mission.opportunity_id)
      .filter((id): id is string => Boolean(id)),
  );
  const ranked = rankMatches(opportunities, profile, usedBanks, stateCode)
    .filter((result) => !activeIds.has(result.item.id));
  const candidates = ranked
    .filter((result) => bonusCandidate(result, profile))
    .sort((a, b) => roadmapRankValue(b, profile) - roadmapRankValue(a, profile));

  const selected: RoadmapBonusSlot[] = [];
  const selectedIds = new Set<string>();

  const overrideIds = Array.isArray(overrides.bonusIds) ? overrides.bonusIds : [];
  for (const id of overrideIds) {
    if (selected.length >= config.maxBonusSlots) break;
    const result = candidates.find((candidate) => candidate.item.id === id);
    if (!result || selectedIds.has(id)) continue;
    if (!canAddBonus(result, selected, bonusCashBudget, ddBudget, profile, strategyMode)) continue;
    selected.push(toBonusSlot(result, profile));
    selectedIds.add(id);
  }

  for (const result of candidates) {
    if (selected.length >= config.maxBonusSlots) break;
    if (selectedIds.has(result.item.id)) continue;
    if (!canAddBonus(result, selected, bonusCashBudget, ddBudget, profile, strategyMode)) continue;
    selected.push(toBonusSlot(result, profile));
    selectedIds.add(result.item.id);
  }

  const bonusCashUsed = selected.reduce((sum, slot) => sum + slot.cashAmount, 0);
  const ddUsed = selected.reduce((sum, slot) => sum + slot.monthlyDdAmount, 0);
  const savingsAmount = Math.max(0, availableCash - bonusCashUsed);
  const savingsSlot = bestSavingsSlot(savingsAmount, ranked, profile, overrides);
  const projectedBonusValue = selected.reduce((sum, slot) => sum + numberValue(slot.opportunity.bonus_amount), 0);
  const projectedIncrementalValue = selected.reduce((sum, slot) => sum + slot.projectedAdvantage, 0) + savingsSlot.projectedAdvantage;
  const warningCount = selected.filter((slot) => !slot.researchReady).length + (savingsSlot.opportunity && !["green", "pass"].includes((savingsSlot.opportunity.safety_gate || "").toLowerCase()) ? 1 : 0);

  return {
    strategyName: config.name,
    totalCash,
    reserve,
    activeCash,
    availableCash,
    monthlyDdStream,
    activeMonthlyDd,
    availableMonthlyDd,
    bonusCashBudget,
    bonusSlots: selected,
    savingsSlot,
    bonusCashUsed,
    ddUsed,
    projectedBonusValue,
    projectedIncrementalValue,
    warningCount,
    planningStartDate: new Date().toISOString().slice(0, 10),
  };
}

export function planningDates(opportunity: Opportunity, startDate: string) {
  const qualificationDays = Math.max(0, numberValue(opportunity.qualification_days || opportunity.direct_deposit_window_days));
  const payoutDays = Math.max(0, numberValue(opportunity.payout_days));
  const benefitDays = Math.max(0, numberValue(opportunity.benefit_duration_days));
  return {
    start: startDate,
    qualification: qualificationDays ? addDaysIso(startDate, qualificationDays) : null,
    payout: qualificationDays || payoutDays ? addDaysIso(startDate, qualificationDays + payoutDays) : null,
    benefitEnd: benefitDays ? addDaysIso(startDate, benefitDays) : null,
  };
}
