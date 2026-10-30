import { money, numberValue } from "@/lib/plan-math";
import type { AccountHistory, FinancialProfile, Mission, Opportunity } from "@/lib/types";

// Do not assume that an earlier customer can earn another welcome bonus.
// This is a conservative institution-level check until bank-specific repeat rules are verified.
export function bankKey(name: string | null | undefined) {
  return (name || "").toLowerCase()
    .replace(/j\.?p\.?\s*morgan\s+chase/g, "chase")
    .replace(/\b(bank|national association|credit union|incorporated)\b/g, "")
    .replace(/[^a-z0-9]/g, "");
}
export function isBonusOpportunity(item: Opportunity) {
  return numberValue(item.bonus_amount) > 0
    && ["checking_bonus", "savings_bonus", "debit_spend", "credit_card_bonus", "brokerage_bonus"].includes(item.category);
}
export function hasReceivedBankBonus(item: Opportunity, history: AccountHistory[], missions: Mission[]) {
  if (!isBonusOpportunity(item)) return false;
  const key = bankKey(item.institution);
  return history.some(h => bankKey(h.institution) === key && (h.bonus_received === true || Boolean(h.bonus_received_at)))
    || missions.some(m => m.status === "complete" && bankKey(m.institution) === key && numberValue(m.expected_bonus) > 0);
}
export function isTracking(item: Opportunity, missions: Mission[]) {
  return missions.some(m => m.opportunity_id === item.id && !["complete", "cancelled"].includes(m.status));
}
export function activeMissions(missions: Mission[]) {
  return missions.filter(m => !["complete", "cancelled"].includes(m.status));
}
export function committedCash(missions: Mission[]) {
  return activeMissions(missions).reduce((sum, m) => {
    if (!m.opportunity || !["hysa", "savings_bonus", "cd"].includes(m.opportunity.category)) return sum;
    const cash = Math.max(numberValue(m.amount_committed), numberValue(m.opportunity.required_balance), numberValue(m.opportunity.min_opening_deposit));
    return sum + cash;
  }, 0);
}
export function requiredDdPerPaycheck(item: Opportunity) {
  const threshold = numberValue(item.reward_monthly_dd_threshold) / 2;
  const window = Math.max(14, numberValue(item.direct_deposit_window_days || item.qualification_days || 30));
  const total = numberValue(item.direct_deposit_required);
  const numberOfChecks = Math.max(1, Math.floor(window / 14));
  return Math.max(threshold, total / numberOfChecks, numberValue(item.dd_min_each));
}
export function remainingDdPerPaycheck(profile: FinancialProfile, missions: Mission[]) {
  const reserved = activeMissions(missions).reduce((sum, m) => {
    if (!m.opportunity) return sum;
    const steps = m.mission_steps || [];
    const deposit = steps.find(s => s.step_type === "direct_deposit");
    if (numberValue(m.opportunity.reward_monthly_dd_threshold) <= 0 && (deposit?.is_complete || (numberValue(deposit?.target_amount) > 0 && numberValue(deposit?.current_amount) >= numberValue(deposit?.target_amount)))) return sum;
    return sum + requiredDdPerPaycheck(m.opportunity);
  }, 0);
  return Math.max(0, numberValue(profile.biweekly_pay) - reserved);
}
export function availabilityWarnings(item: Opportunity, profile: FinancialProfile, missions: Mission[], history: AccountHistory[]) {
  const warnings: string[] = [];
  if (hasReceivedBankBonus(item, history, missions))
    warnings.push("You already received a bonus from this bank. Repeat eligibility needs to be verified; this offer is not available to add.");
  if (isTracking(item, missions))
    warnings.push("Already in your active plan — open its tracker above to update progress.");
  const deadline = item.expires_at ? Date.parse(item.expires_at) : NaN;
  if (Number.isFinite(deadline) && deadline < Date.now())
    warnings.push("The stored offer deadline has passed.");

  const balance = Math.max(numberValue(item.required_balance), numberValue(item.min_opening_deposit));
  const liquid = Math.max(0, numberValue(profile.total_cash) - numberValue(profile.emergency_reserve));
  const remainingCash = Math.max(0, liquid - committedCash(missions));
  if (balance > remainingCash)
    warnings.push("Needs " + money.format(balance) + " cash, but only " + money.format(remainingCash) + " remains after your existing savings commitments.");

  const perCheck = requiredDdPerPaycheck(item);
  if (perCheck > 0) {
    const remaining = remainingDdPerPaycheck(profile, missions);
    const currentDdOffers = activeMissions(missions).filter(m => m.opportunity && requiredDdPerPaycheck(m.opportunity) > 0
      && (numberValue(m.opportunity.reward_monthly_dd_threshold) > 0 || !(m.mission_steps || []).find(s => s.step_type === "direct_deposit")?.is_complete));
    if (currentDdOffers.length && profile.employer_multiple_dd !== true)
      warnings.push("Your existing DD offer uses your paycheck. Confirm your employer can split payroll before trying a second DD bonus.");
    if (perCheck > remaining)
      warnings.push("Needs about " + money.format(perCheck) + "/paycheck; only " + money.format(remaining) + "/paycheck is uncommitted after your tracked DD offers.");
  }
  const spendRequired = Math.max(numberValue(item.purchase_required_spend), numberValue(item.purchase_count) * numberValue(item.purchase_min_amount));
  if (spendRequired > numberValue(profile.monthly_card_spend) * Math.max(1, numberValue(item.spend_window_days || item.qualification_days || 30) / 30))
    warnings.push("Spending requirement is greater than your saved normal spending budget.");

  return warnings;
}
