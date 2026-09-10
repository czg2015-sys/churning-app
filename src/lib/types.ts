export type Opportunity = {
  id: string;
  institution: string;
  product_name: string;
  category: "checking_bonus" | "savings_bonus" | "hysa" | "debit_spend" | "cd" | "treasury";
  official_url: string;
  offer_status: string;
  safety_gate: string;
  bonus_amount: number | string | null;
  apy: number | string | null;
  min_opening_deposit?: number | string | null;
  required_balance: number | string | null;
  direct_deposit_required: number | string | null;
  direct_deposit_window_days?: number | null;
  qualification_days: number | null;
  payout_days: number | null;
  min_account_age_days?: number | null;
  monthly_fee: number | string | null;
  early_close_fee?: number | string | null;
  effort: number | null;
  evidence_confidence: number | null;
  liquidity_score: number | null;
  terms_summary: string | null;
  eligibility_notes?: string | null;
  fee_waiver_summary?: string | null;
  last_verified_at: string | null;
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
};
