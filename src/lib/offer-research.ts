import type { Opportunity } from "./types.ts";

export function offerResearchStatus(item: Opportunity, now = new Date()) {
  const verified = item.last_verified_at ? Date.parse(item.last_verified_at) : NaN;
  const age = (now.getTime() - verified) / 86_400_000;
  const fresh = Number.isFinite(age) && age >= 0 && age <= 7;
  const expired = Boolean(item.expires_at && item.expires_at.slice(0,10) < now.toISOString().slice(0,10));
  const review = [...(item.opportunity_reviews || [])].sort((a,b) => b.reviewed_at.localeCompare(a.reviewed_at))[0];
  const deposit = ["checking_bonus","savings_bonus","hysa","debit_spend","cd"].includes(item.category);
  const fields = deposit ? [review?.hard_pull_status,review?.chexsystems_status,review?.ews_status,review?.tax_status,review?.insurance_status,review?.close_rule_status]
    : item.category === "credit_card_bonus" ? [review?.hard_pull_status,review?.tax_status,review?.close_rule_status] : [review?.tax_status,review?.close_rule_status];
  const complete = Boolean(review) && fields.every(value => Boolean(value && !["unknown","pending","unreviewed"].includes(value.toLowerCase())));
  const cleared = !expired && fresh && complete && ["green","pass"].includes((item.safety_gate || "").toLowerCase()) && Number(item.evidence_confidence)>=80;
  return {cleared, expired, label: expired ? "Deadline passed" : cleared ? "Research checked" : !fresh ? "Needs a fresh check" : "Terms need review"};
}
