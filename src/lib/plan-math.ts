import type { FinancialProfile, Opportunity } from "@/lib/types";

export const money = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  maximumFractionDigits: 0,
});

export function numberValue(value: number | string | null | undefined) {
  const parsed = Number(String(value ?? 0).replace(/,/g, ""));
  return Number.isFinite(parsed) ? parsed : 0;
}

export function addDaysIso(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T12:00:00`);
  date.setDate(date.getDate() + Math.max(0, days));
  return date.toISOString().slice(0, 10);
}

export function timelineFromOpenedDate(opportunity: Opportunity, openedAt: string, trackingDays?: number | null) {
  const qualificationDays = Math.max(0, numberValue(opportunity.qualification_days || opportunity.direct_deposit_window_days || trackingDays));
  const payoutDays = Math.max(0, numberValue(opportunity.payout_days));
  const minimumAgeDays = Math.max(0, numberValue(opportunity.min_account_age_days));
  const qualificationDeadline = qualificationDays ? addDaysIso(openedAt, qualificationDays) : null;
  const payoutDueDate = qualificationDays || payoutDays ? addDaysIso(openedAt, qualificationDays + payoutDays) : null;
  const minimumAccountAgeDate = minimumAgeDays ? addDaysIso(openedAt, minimumAgeDays) : null;
  const safeCloseDays = Math.max(minimumAgeDays, qualificationDays + payoutDays);

  return {
    qualificationDeadline,
    payoutDueDate,
    minimumAccountAgeDate,
    safeCloseReviewDate: safeCloseDays ? addDaysIso(openedAt, safeCloseDays) : null,
  };
}

export function trackedInterestEstimate(opportunity: Opportunity, amountCommitted: number, trackingDays?: number | null) {
  const apy = Math.max(0, numberValue(opportunity.apy)) / 100;
  const days = Math.max(0, numberValue(opportunity.qualification_days || opportunity.direct_deposit_window_days || trackingDays));
  if (apy <= 0 || amountCommitted <= 0 || days <= 0) return 0;
  return amountCommitted * apy * (days / 365);
}


const stateNames: Record<string, string> = {
  AL:"alabama", AK:"alaska", AZ:"arizona", AR:"arkansas", CA:"california", CO:"colorado", CT:"connecticut", DE:"delaware", FL:"florida", GA:"georgia", HI:"hawaii", ID:"idaho", IL:"illinois", IN:"indiana", IA:"iowa", KS:"kansas", KY:"kentucky", LA:"louisiana", ME:"maine", MD:"maryland", MA:"massachusetts", MI:"michigan", MN:"minnesota", MS:"mississippi", MO:"missouri", MT:"montana", NE:"nebraska", NV:"nevada", NH:"new hampshire", NJ:"new jersey", NM:"new mexico", NY:"new york", NC:"north carolina", ND:"north dakota", OH:"ohio", OK:"oklahoma", OR:"oregon", PA:"pennsylvania", RI:"rhode island", SC:"south carolina", SD:"south dakota", TN:"tennessee", TX:"texas", UT:"utah", VT:"vermont", VA:"virginia", WA:"washington", WV:"west virginia", WI:"wisconsin", WY:"wyoming", DC:"district of columbia"
};

export function stateEligible(opportunity: Opportunity, stateCode?: string | null) {
  const scope = (opportunity.state_scope || "").trim();
  if (!scope || !stateCode) return true;
  const normalized = scope.toLowerCase();
  if (["all states", "nationwide", "national", "all us", "all u.s."].some((token) => normalized.includes(token))) return true;
  const code = stateCode.toUpperCase();
  const fullName = stateNames[code];
  const tokens = normalized.split(/[^a-z]+/).filter(Boolean);
  return tokens.includes(code.toLowerCase()) || (fullName ? normalized.includes(fullName) : false);
}

export function latestReview(opportunity: Opportunity) {
  return [...(opportunity.opportunity_reviews || [])].sort((a, b) => new Date(b.reviewed_at).getTime() - new Date(a.reviewed_at).getTime())[0] || null;
}

export function reviewStatusLabel(status?: string | null) {
  const value = (status || "unknown").replaceAll("_", " ").trim();
  if (!value || value === "unknown") return "Unknown";
  if (value === "verified taxable") return "Verified taxable";
  if (value === "verified") return "Verified";
  if (value === "none found" || value === "no hard pull") return "None found";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

export function verificationAgeDays(lastVerifiedAt?: string | null) {
  if (!lastVerifiedAt) return null;
  const verified = new Date(lastVerifiedAt).getTime();
  if (!Number.isFinite(verified)) return null;
  return Math.max(0, Math.floor((Date.now() - verified) / 86_400_000));
}

export function opportunityEconomics(opportunity: Opportunity, profile: FinancialProfile) {
  const totalCash = numberValue(profile.total_cash);
  const reserve = Math.min(totalCash, numberValue(profile.emergency_reserve));
  const deployable = Math.max(0, totalCash - reserve);
  const requiredCash = Math.max(numberValue(opportunity.required_balance), numberValue(opportunity.min_opening_deposit));
  const cashUsed = requiredCash > 0 ? Math.min(requiredCash, deployable) : 0;
  const qualificationDays = Math.max(0, numberValue(opportunity.qualification_days || opportunity.direct_deposit_window_days));
  const currentApy = numberValue(profile.current_hysa_apy) / 100;
  const unavoidableFees = numberValue(opportunity.estimated_unavoidable_fees);
  const bonus = numberValue(opportunity.bonus_amount);
  const apy = numberValue(opportunity.apy) / 100;

  const baselineInterestLost = cashUsed > 0 && qualificationDays > 0
    ? cashUsed * currentApy * (qualificationDays / 365)
    : 0;

  const offerInterest = opportunity.category === "hysa"
    ? deployable * apy
    : cashUsed > 0 && qualificationDays > 0
      ? cashUsed * apy * (qualificationDays / 365)
      : 0;
  const baselineAnnualInterest = opportunity.category === "hysa"
    ? deployable * currentApy
    : 0;

  const grossAdvantage = opportunity.category === "hysa"
    ? offerInterest - baselineAnnualInterest
    : bonus + offerInterest - baselineInterestLost - unavoidableFees;

  const taxRate = profile.tax_rate_known ? Math.max(0, numberValue(profile.estimated_tax_rate)) / 100 : 0;
  const bankBonusLikelyTaxable = ["checking_bonus", "savings_bonus", "hysa", "cd"].includes(opportunity.category) || (opportunity.category === "debit_spend" && bonus > 0);
  const bonusAfterTax = bonus * (bankBonusLikelyTaxable ? 1 - taxRate : 1);
  const offerInterestAfterTax = offerInterest * (1 - taxRate);
  const baselineInterestLostAfterTax = baselineInterestLost * (1 - taxRate);
  const baselineAnnualInterestAfterTax = baselineAnnualInterest * (1 - taxRate);
  const estimatedAfterTaxAdvantage = opportunity.category === "hysa"
    ? bonusAfterTax + offerInterestAfterTax - baselineAnnualInterestAfterTax - unavoidableFees
    : bonusAfterTax + offerInterestAfterTax - baselineInterestLostAfterTax - unavoidableFees;

  return {
    deployable,
    requiredCash,
    cashUsed,
    baselineInterestLost,
    grossAdvantage,
    estimatedAfterTaxAdvantage,
  };
}

export function opportunityFit(opportunity: Opportunity, profile: FinancialProfile, usedBanks: string[]) {
  const economics = opportunityEconomics(opportunity, profile);
  const availablePayPerCycle = Math.max(0, numberValue(profile.biweekly_pay) - numberValue(profile.biweekly_essential_spend));
  const requiredDD = numberValue(opportunity.direct_deposit_required);
  const ddWindowDays = Math.max(14, numberValue(opportunity.direct_deposit_window_days || opportunity.qualification_days || 14));
  const expectedAvailableDD = availablePayPerCycle * Math.max(1, ddWindowDays / 14);
  const cashFit = economics.requiredCash <= economics.deployable
    ? 100
    : Math.max(0, 100 - ((economics.requiredCash - economics.deployable) / Math.max(economics.requiredCash, 1)) * 100);
  const ddFit = requiredDD <= 0 ? 100 : Math.min(100, (expectedAvailableDD / requiredDD) * 100);
  const purchaseCount = Math.max(0, Number(opportunity.purchase_count || 0));
  const purchaseMinimum = numberValue(opportunity.purchase_min_amount);
  const requiredSpend = purchaseCount > 0 && purchaseMinimum > 0 ? purchaseCount * purchaseMinimum : 0;
  const availableSpend = numberValue(profile.monthly_card_spend) * Math.max(1, numberValue(opportunity.qualification_days || 30) / 30);
  const spendFit = purchaseCount <= 0 ? 100 : requiredSpend > 0 ? Math.min(100, (availableSpend / requiredSpend) * 100) : numberValue(profile.monthly_card_spend) > 0 ? 100 : 45;
  const confidence = Math.max(0, Math.min(100, numberValue(opportunity.evidence_confidence)));
  const verificationAge = verificationAgeDays(opportunity.last_verified_at);
  const freshEnough = verificationAge !== null && verificationAge <= 7;
  const researchReady = confidence >= 80 && freshEnough;
  const safetyPassed = (opportunity.safety_gate || "").toLowerCase() === "pass" && researchReady;
  const liquidity = Math.max(0, Math.min(100, numberValue(opportunity.liquidity_score)));
  const effort = Math.max(1, numberValue(opportunity.effort));
  const historyMatch = usedBanks.some((bank) => bank.trim().toLowerCase() === opportunity.institution.trim().toLowerCase());
  const mode = Number(profile.strategy_mode || 2);
  const modePenalty = mode === 1 ? (effort - 1) * 14 : mode === 2 ? (effort - 1) * 7 : 0;
  const historyPenalty = historyMatch ? 22 : 0;
  const fitBonus = Math.max(-250, Math.min(1000, economics.estimatedAfterTaxAdvantage));

  const baseScore = fitBonus * 0.08 + cashFit * 0.20 + ddFit * 0.16 + spendFit * 0.10 + confidence * 0.22 + liquidity * 0.16 - modePenalty - historyPenalty;
  const score = baseScore + (safetyPassed ? 35 : researchReady ? 8 : -25);

  const reasons: string[] = [];
  if (cashFit >= 95 && economics.requiredCash > 0) reasons.push("fits your available cash");
  if (ddFit >= 95 && requiredDD > 0) reasons.push("fits your paycheck capacity");
  if (spendFit >= 95 && purchaseCount > 0) reasons.push("fits your normal spending");
  if (liquidity >= 85) reasons.push("keeps liquidity high");
  if (effort <= 2) reasons.push("low maintenance");
  if (economics.grossAdvantage > 0) reasons.push("beats your current cash baseline");

  return {
    score,
    cashFit,
    ddFit,
    spendFit,
    confidence,
    liquidity,
    effort,
    historyMatch,
    safetyPassed,
    researchReady,
    baseScore,
    verificationAge,
    freshEnough,
    reasons,
    ...economics,
  };
}

export function rankOpportunities(opportunities: Opportunity[], profile: FinancialProfile, usedBanks: string[], stateCode?: string | null) {
  return opportunities
    .filter((item) => item.offer_status === "live" && stateEligible(item, stateCode))
    .map((item) => ({ item, ...opportunityFit(item, profile, usedBanks) }))
    .filter((result) => result.safetyPassed && result.cashFit >= 95 && result.ddFit >= 90 && result.spendFit >= 75)
    .sort((a, b) => b.score - a.score);
}

export function rankResearchQueue(opportunities: Opportunity[], profile: FinancialProfile, usedBanks: string[], stateCode?: string | null) {
  return opportunities
    .filter((item) => item.offer_status === "live" && stateEligible(item, stateCode))
    .map((item) => ({ item, ...opportunityFit(item, profile, usedBanks) }))
    .filter((result) => !result.safetyPassed)
    .sort((a, b) => Number(b.researchReady) - Number(a.researchReady) || b.baseScore - a.baseScore || b.confidence - a.confidence);
}


export function rankMatches(opportunities: Opportunity[], profile: FinancialProfile, usedBanks: string[], stateCode?: string | null) {
  return opportunities
    .filter((item) => item.offer_status === "live" && stateEligible(item, stateCode))
    .map((item) => ({ item, ...opportunityFit(item, profile, usedBanks) }))
    .filter((result) => result.cashFit >= 80 && result.ddFit >= 75 && result.spendFit >= 60)
    .sort((a, b) => Number(b.safetyPassed) - Number(a.safetyPassed) || Number(b.researchReady) - Number(a.researchReady) || b.score - a.score);
}
