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

export function localTodayIso(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export function addDaysIso(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T12:00:00`);
  date.setDate(date.getDate() + Math.max(0, days));
  return date.toISOString().slice(0, 10);
}

export function timelineFromOpenedDate(
  opportunity: Opportunity,
  openedAt: string,
  trackingDays?: number | null,
  benefitStartOverride?: string | null,
  qualificationStartOverride?: string | null,
) {
  const qualificationDays = Math.max(0, numberValue(opportunity.qualification_days || opportunity.direct_deposit_window_days));
  const payoutDays = Math.max(0, numberValue(opportunity.payout_days));
  const minimumAgeDays = Math.max(0, numberValue(opportunity.min_account_age_days));
  const benefitDurationDays = Math.max(0, numberValue(opportunity.benefit_duration_days || trackingDays));

  const qualificationNeedsEvent = Boolean(opportunity.qualification_start_trigger);
  const qualificationStartDate = qualificationDays
    ? (qualificationNeedsEvent ? qualificationStartOverride || null : qualificationStartOverride || openedAt)
    : null;
  const qualificationDeadline = qualificationStartDate && qualificationDays
    ? addDaysIso(qualificationStartDate, qualificationDays)
    : null;
  const payoutDueDate = qualificationDeadline
    ? addDaysIso(qualificationDeadline, payoutDays)
    : (!qualificationDays && payoutDays ? addDaysIso(openedAt, payoutDays) : null);
  const minimumAccountAgeDate = minimumAgeDays ? addDaysIso(openedAt, minimumAgeDays) : null;
  const benefitStartDate = benefitDurationDays ? (benefitStartOverride || openedAt) : null;
  const benefitEndDate = benefitStartDate && benefitDurationDays ? addDaysIso(benefitStartDate, benefitDurationDays) : null;
  const safeCloseReviewDate = [minimumAccountAgeDate, payoutDueDate, benefitEndDate]
    .filter((value): value is string => Boolean(value))
    .sort()
    .at(-1) || null;

  return {
    qualificationStartDate,
    qualificationDeadline,
    payoutDueDate,
    minimumAccountAgeDate,
    safeCloseReviewDate,
    benefitStartDate,
    benefitEndDate,
  };
}

export function trackedInterestEstimate(opportunity: Opportunity, amountCommitted: number, trackingDays?: number | null) {
  const apy = Math.max(0, numberValue(opportunity.apy)) / 100;
  const days = Math.max(0, numberValue(opportunity.benefit_duration_days || opportunity.qualification_days || opportunity.direct_deposit_window_days || trackingDays));
  if (apy <= 0 || amountCommitted <= 0 || days <= 0) return 0;
  return amountCommitted * apy * (days / 365);
}

export function categoryLabel(opportunity: Opportunity) {
  const labels: Record<Opportunity["category"], string> = {
    hysa: "High-yield savings",
    savings_bonus: "Savings bonus",
    checking_bonus: "Checking / direct deposit",
    debit_spend: "Debit rewards",
    credit_card_bonus: "Credit card offer",
    cd: "CD",
    treasury: "Treasury",
    brokerage_bonus: "Brokerage bonus",
  };
  return labels[opportunity.category] || opportunity.category.replaceAll("_", " ");
}

export function benefitDurationLabel(opportunity: Opportunity) {
  const days = Math.max(0, numberValue(opportunity.benefit_duration_days));
  if (!days) return null;
  const months = Math.round(days / 30.4375);
  const duration = months >= 2 && Math.abs(days - months * 30.4375) <= 8
    ? `${months} month${months === 1 ? "" : "s"}`
    : `${days} days`;
  return opportunity.benefit_label ? `${opportunity.benefit_label} · ${duration}` : `Limited benefit · ${duration}`;
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

  const hysaComparisonDays = opportunity.category === "hysa"
    ? Math.max(1, numberValue(opportunity.benefit_duration_days) || 365)
    : 0;
  const offerInterest = opportunity.category === "hysa"
    ? deployable * apy * (hysaComparisonDays / 365)
    : cashUsed > 0 && qualificationDays > 0
      ? cashUsed * apy * (qualificationDays / 365)
      : 0;
  const baselineAnnualInterest = opportunity.category === "hysa"
    ? deployable * currentApy * (hysaComparisonDays / 365)
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
  const availablePayPerCycle = Math.max(0, numberValue(profile.biweekly_pay));
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
  const review = latestReview(opportunity);
  const known = (value?: string | null) => Boolean(value && !["unknown", "pending", "unreviewed"].includes(value.toLowerCase()));
  const depositProduct = ["checking_bonus", "savings_bonus", "hysa", "debit_spend", "cd"].includes(opportunity.category);
  const cardProduct = opportunity.category === "credit_card_bonus";
  const requiredReviewFields = depositProduct
    ? [review?.hard_pull_status, review?.chexsystems_status, review?.ews_status, review?.tax_status, review?.insurance_status, review?.close_rule_status]
    : cardProduct
      ? [review?.hard_pull_status, review?.tax_status, review?.close_rule_status]
      : [review?.tax_status, review?.close_rule_status];
  const reviewComplete = Boolean(review) && requiredReviewFields.every(known);
  const researchReady = confidence >= 80 && freshEnough && reviewComplete;
  const gate = (opportunity.safety_gate || "").toLowerCase();
  const safetyPassed = ["green", "pass"].includes(gate) && researchReady;
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
    reviewComplete,
    baseScore,
    verificationAge,
    freshEnough,
    reasons,
    ...economics,
  };
}

export function accountLifecycleGuidance(opportunity: Opportunity) {
  const monthlyFee = numberValue(opportunity.monthly_fee);
  const annualFee = numberValue(opportunity.annual_fee);
  const feeWaiver = (opportunity.fee_waiver_summary || "").trim();
  const researchedClose = latestReview(opportunity)?.safe_close_summary?.trim();

  if (opportunity.category === "credit_card_bonus") {
    if (annualFee > 0) {
      return {
        label: "REVIEW BEFORE ANNUAL FEE",
        shortLabel: "Annual-fee review",
        tone: "review",
        closeBias: "review" as const,
        text: `A stored ${money.format(annualFee)} annual fee applies. After the welcome offer, review the ongoing value before the next fee posts; keeping, downgrading, or closing should depend on current issuer terms and your credit goals.`,
      };
    }
    return {
      label: "NO NEED TO CLOSE",
      shortLabel: "No automatic close",
      tone: "neutral",
      closeBias: "keep" as const,
      text: "No annual fee is stored. There is no automatic reason to close after the welcome offer; review the card’s ongoing value and your credit goals first.",
    };
  }

  if (monthlyFee > 0 && feeWaiver) {
    return {
      label: "KEEP ONLY IF FEE IS WAIVED",
      shortLabel: "Fee-waiver watch",
      tone: "review",
      closeBias: "conditional" as const,
      text: `A stored ${money.format(monthlyFee)}/month fee applies unless the waiver is met: ${feeWaiver} After the reward and minimum-open period, keep it only if you expect to keep meeting that waiver or the account still provides enough value; otherwise review it for closure after re-checking current terms.`,
    };
  }

  if (monthlyFee > 0) {
    return {
      label: "REVIEW TO CLOSE",
      shortLabel: "Close review",
      tone: "review",
      closeBias: "close_review" as const,
      text: `A stored ${money.format(monthlyFee)}/month fee applies and no verified waiver is stored. After the reward is received and the minimum-open/clawback window is satisfied, review the account for closure so the fee does not erase the bonus. Re-check the current official terms before closing.`,
    };
  }

  if (opportunity.category === "hysa") {
    return {
      label: "NO NEED TO CLOSE",
      shortLabel: "Rate review",
      tone: "neutral",
      closeBias: "keep" as const,
      text: opportunity.benefit_duration_days
        ? "No monthly fee is stored. When the promotional rate ends, compare the new rate with your alternatives; this is a move-money review, not an automatic account-close instruction."
        : "No monthly fee is stored. Keep the account while the rate and access still fit; review the rate periodically rather than closing automatically.",
    };
  }

  if (["savings_bonus", "checking_bonus", "debit_spend"].includes(opportunity.category)) {
    return {
      label: "NO NEED TO CLOSE",
      shortLabel: "No automatic close",
      tone: "neutral",
      closeBias: "keep" as const,
      text: researchedClose || "No recurring monthly fee is stored. There is no automatic reason to close after the reward; review future eligibility, account usefulness, and current terms before deciding.",
    };
  }

  return {
    label: "REVIEW AFTER COMPLETION",
    shortLabel: "Review later",
    tone: "neutral",
    closeBias: "review" as const,
    text: researchedClose || "After the benefit is complete, review the current official terms and ongoing value before deciding whether to keep or close the account.",
  };
}

export function beforeOpenFacts(opportunity: Opportunity) {
  const review = latestReview(opportunity);
  const requiredCash = Math.max(numberValue(opportunity.required_balance), numberValue(opportunity.min_opening_deposit));
  const holdDays = Math.max(numberValue(opportunity.qualification_days), numberValue(opportunity.min_account_age_days));
  const monthlyFee = numberValue(opportunity.monthly_fee);
  const annualFee = numberValue(opportunity.annual_fee);
  return {
    requiredCash,
    holdDays,
    monthlyFee,
    annualFee,
    insurance: opportunity.issuer_kind === "credit_card" ? "Not a deposit product" : (opportunity as Opportunity & { insurance_type?: string | null }).insurance_type || "Verify FDIC/NCUA",
    closeRule: review?.safe_close_summary || opportunity.keep_guidance || "Review current official close/clawback terms before opening.",
    feeNote: opportunity.fee_waiver_summary || (monthlyFee > 0 ? "No fee waiver is stored; re-check current terms." : "No recurring monthly fee is stored."),
  };
}

export function rankOpportunities(opportunities: Opportunity[], profile: FinancialProfile, usedBanks: string[], stateCode?: string | null) {
  return opportunities
    .filter((item) => item.offer_status === "live" && stateEligible(item, stateCode) && !["credit_card_bonus", "brokerage_bonus"].includes(item.category))
    .map((item) => ({ item, ...opportunityFit(item, profile, usedBanks) }))
    .filter((result) => result.safetyPassed && result.cashFit >= 95 && result.ddFit >= 90 && result.spendFit >= 75)
    .sort((a, b) => b.score - a.score);
}

export function rankResearchQueue(opportunities: Opportunity[], profile: FinancialProfile, usedBanks: string[], stateCode?: string | null) {
  return opportunities
    .filter((item) => item.offer_status === "live" && stateEligible(item, stateCode) && !["credit_card_bonus", "brokerage_bonus"].includes(item.category))
    .map((item) => ({ item, ...opportunityFit(item, profile, usedBanks) }))
    .filter((result) => !result.safetyPassed)
    .sort((a, b) => Number(b.researchReady) - Number(a.researchReady) || b.baseScore - a.baseScore || b.confidence - a.confidence);
}

export function rankMatches(opportunities: Opportunity[], profile: FinancialProfile, usedBanks: string[], stateCode?: string | null) {
  return opportunities
    .filter((item) => item.offer_status === "live" && stateEligible(item, stateCode) && !["credit_card_bonus", "brokerage_bonus"].includes(item.category))
    .map((item) => ({ item, ...opportunityFit(item, profile, usedBanks) }))
    .sort((a, b) => {
      const bFit = Number(b.cashFit >= 95 && b.ddFit >= 90 && b.spendFit >= 75);
      const aFit = Number(a.cashFit >= 95 && a.ddFit >= 90 && a.spendFit >= 75);
      return bFit - aFit
        || Number(b.safetyPassed) - Number(a.safetyPassed)
        || Number(b.researchReady) - Number(a.researchReady)
        || b.score - a.score;
    });
}


export function selectFeasibleRecommendations(
  opportunities: Opportunity[],
  profile: FinancialProfile,
  usedBanks: string[],
  stateCode?: string | null,
  limit = 3,
) {
  const ranked = rankMatches(opportunities, profile, usedBanks, stateCode)
    .filter((result) => result.safetyPassed && result.cashFit >= 95 && result.ddFit >= 90 && result.spendFit >= 75)
    .slice(0, 12);

  if (ranked.length <= 1) return ranked.slice(0, limit);

  const deployableCash = Math.max(0, numberValue(profile.total_cash) - numberValue(profile.emergency_reserve));
  const monthlyDdCapacity = Math.max(0, numberValue(profile.biweekly_pay)) * (26 / 12);
  const monthlySpendCapacity = Math.max(0, numberValue(profile.monthly_card_spend));
  const allowMultipleDd = profile.employer_multiple_dd === true;

  function monthlyDdNeed(item: Opportunity) {
    const explicit = numberValue(item.reward_monthly_dd_threshold);
    if (explicit > 0) return explicit;
    const required = numberValue(item.direct_deposit_required);
    if (required <= 0) return 0;
    const days = Math.max(30, numberValue(item.direct_deposit_window_days || item.qualification_days || 30));
    return required / Math.max(1, days / 30);
  }

  function monthlySpendNeed(item: Opportunity) {
    const direct = numberValue(item.purchase_required_spend);
    const counted = Math.max(0, Number(item.purchase_count || 0)) * numberValue(item.purchase_min_amount);
    const required = Math.max(direct, counted);
    if (required <= 0) return 0;
    const days = Math.max(30, numberValue(item.spend_window_days || item.qualification_days || 30));
    return required / Math.max(1, days / 30);
  }

  function feasible(bundle: typeof ranked) {
    const cashNeed = bundle.reduce((sum, result) => sum + Math.max(numberValue(result.item.required_balance), numberValue(result.item.min_opening_deposit)), 0);
    if (cashNeed > deployableCash + 0.01) return false;

    const ddItems = bundle.filter((result) => numberValue(result.item.direct_deposit_required) > 0 || numberValue(result.item.reward_monthly_dd_threshold) > 0);
    if (!allowMultipleDd && ddItems.length > 1) return false;
    const ddNeed = ddItems.reduce((sum, result) => sum + monthlyDdNeed(result.item), 0);
    if (ddNeed > monthlyDdCapacity + 0.01) return false;

    const spendNeed = bundle.reduce((sum, result) => sum + monthlySpendNeed(result.item), 0);
    if (spendNeed > monthlySpendCapacity + 0.01 && spendNeed > 0) return false;

    return true;
  }

  let best: typeof ranked = [];
  let bestScore = -Infinity;
  const n = ranked.length;
  for (let i = 0; i < n; i++) {
    const one = [ranked[i]];
    if (feasible(one) && (one[0].score > bestScore || best.length < 1)) {
      best = one;
      bestScore = one[0].score;
    }
    for (let j = i + 1; j < n; j++) {
      const two = [ranked[i], ranked[j]];
      const twoScore = two.reduce((sum, result) => sum + result.score, 0);
      if (feasible(two) && (best.length < 2 || twoScore > bestScore)) {
        best = two;
        bestScore = twoScore;
      }
      if (limit < 3) continue;
      for (let k = j + 1; k < n; k++) {
        const three = [ranked[i], ranked[j], ranked[k]];
        if (!feasible(three)) continue;
        const score = three.reduce((sum, result) => sum + result.score, 0);
        if (best.length < 3 || score > bestScore) {
          best = three;
          bestScore = score;
        }
      }
    }
  }

  return best.sort((a, b) => b.score - a.score).slice(0, limit);
}
