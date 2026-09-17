export type OpportunityReview = {
  id?: string;
  review_stage: string;
  overall_status: string;
  risk_level: string;
  hard_pull_status: string;
  chexsystems_status: string;
  ews_status: string;
  tax_status: string;
  insurance_status: string;
  close_rule_status: string;
  safe_close_summary?: string | null;
  source_kind?: string | null;
  reviewed_at: string;
  notes?: string | null;
};

export type Opportunity = {
  id: string;
  institution: string;
  product_name: string;
  category:
    | "checking_bonus"
    | "savings_bonus"
    | "hysa"
    | "debit_spend"
    | "credit_card_bonus"
    | "cd"
    | "treasury"
    | "brokerage_bonus";
  official_url: string;
  offer_status: string;
  safety_gate: string;
  bonus_amount: number | string | null;
  apy: number | string | null;
  min_opening_deposit?: number | string | null;
  required_balance: number | string | null;
  direct_deposit_required: number | string | null;
  direct_deposit_window_days?: number | null;
  dd_min_each?: number | string | null;
  dd_deposit_count?: number | null;
  purchase_count?: number | null;
  purchase_min_amount?: number | string | null;
  reward_rate?: number | string | null;
  reward_cap_annual?: number | string | null;
  reward_monthly_dd_threshold?: number | string | null;
  qualification_days: number | null;
  payout_days: number | null;
  min_account_age_days?: number | null;
  monthly_fee: number | string | null;
  estimated_unavoidable_fees?: number | string | null;
  early_close_fee?: number | string | null;
  effort: number | null;
  evidence_confidence: number | null;
  liquidity_score: number | null;
  terms_summary: string | null;
  eligibility_notes?: string | null;
  fee_waiver_summary?: string | null;
  annual_fee?: number | string | null;
  fee_starts_after_days?: number | null;
  purchase_required_spend?: number | string | null;
  spend_window_days?: number | null;
  reward_points?: number | string | null;
  cash_value_per_point?: number | string | null;
  travel_value_per_point?: number | string | null;
  issuer_kind?: string | null;
  credit_score_band_hint?: string | null;
  keep_guidance?: string | null;
  state_scope?: string | null;
  insurance_type?: string | null;
  last_verified_at: string | null;
  expires_at?: string | null;
  benefit_duration_days?: number | null;
  benefit_label?: string | null;
  benefit_start_trigger?: string | null;
  qualification_start_trigger?: string | null;
  standard_apy_after_benefit?: number | string | null;
  opportunity_reviews?: OpportunityReview[];
};

export type MissionStep = {
  id: string;
  mission_id: string;
  user_id: string;
  label: string;
  step_type: string;
  step_order: number;
  target_amount?: number | string | null;
  current_amount?: number | string | null;
  is_complete: boolean;
  completed_at?: string | null;
};

export type Mission = {
  id: string;
  user_id: string;
  opportunity_id?: string | null;
  institution: string;
  title: string;
  amount_committed: number | string;
  expected_bonus: number | string;
  expected_interest: number | string;
  opened_at?: string | null;
  qualification_deadline?: string | null;
  payout_due_date?: string | null;
  minimum_account_age_date?: string | null;
  safe_close_review_date?: string | null;
  funded_at?: string | null;
  first_dd_at?: string | null;
  qualification_start_date?: string | null;
  benefit_start_date?: string | null;
  benefit_end_date?: string | null;
  email_reminders_enabled?: boolean | null;
  status: string;
  quick_access_url?: string | null;
  next_action?: string | null;
  mission_steps?: MissionStep[];
  opportunity?: Opportunity | null;
};

export type FinancialProfile = {
  total_cash: number | string;
  savings_cash: number | string;
  checking_cash: number | string;
  emergency_reserve: number | string;
  current_hysa_apy: number | string;
  biweekly_pay: number | string;
  biweekly_essential_spend: number | string;
  estimated_tax_rate: number | string | null;
  tax_rate_known: boolean;
  strategy_mode: number;
  monthly_card_spend: number | string;
  current_spend_reward_rate: number | string;
  ranking_preference: string;
  annual_extra_goal: number | string;
  recent_bank_openings?: number | string;
  employer_multiple_dd?: boolean | null;
  alerts_opt_in?: boolean;
  reminder_preference?: "all" | "important" | "off";
  card_helper_opt_in?: boolean;
  card_helper_prompt_answered?: boolean;
  credit_score_band?: string | null;
  no_credit_card?: boolean;
  credit_cards_pay_in_full?: boolean;
};

export type PlanStartDetails = {
  openedAlready: boolean;
  openedAt: string | null;
  fundedAt?: string | null;
  firstDdAt?: string | null;
  amountCommitted: number;
  plannedDirectDeposit: number;
  trackingDays?: number | null;
  reminderEnabled?: boolean | null;
};

export type AccountHistory = {
  id: string;
  user_id: string;
  opportunity_id?: string | null;
  institution: string;
  product_name?: string | null;
  opened_at?: string | null;
  closed_at?: string | null;
  bonus_received_at?: string | null;
  bonus_received?: boolean | null;
  bonus_amount?: number | string | null;
  outcome?: string | null;
  notes?: string | null;
};