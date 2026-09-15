-- Research Agent V1.1 + optional Cards & Spending preferences.
-- Backwards-compatible additions only.

alter table public.financial_profiles
  add column if not exists employer_multiple_dd boolean,
  add column if not exists alerts_opt_in boolean not null default false,
  add column if not exists card_helper_opt_in boolean not null default false,
  add column if not exists credit_score_band text,
  add column if not exists no_credit_card boolean not null default false,
  add column if not exists credit_cards_pay_in_full boolean not null default false;

alter table public.account_history
  add column if not exists account_type text;

alter table public.opportunities
  add column if not exists annual_fee numeric not null default 0,
  add column if not exists fee_starts_after_days integer,
  add column if not exists purchase_required_spend numeric not null default 0,
  add column if not exists spend_window_days integer,
  add column if not exists reward_points numeric not null default 0,
  add column if not exists cash_value_per_point numeric not null default 0,
  add column if not exists travel_value_per_point numeric not null default 0,
  add column if not exists issuer_kind text,
  add column if not exists credit_score_band_hint text,
  add column if not exists keep_guidance text;

alter table public.research_findings
  add column if not exists extracted_terms jsonb not null default '{}'::jsonb,
  add column if not exists term_diffs jsonb not null default '[]'::jsonb,
  add column if not exists material_change boolean not null default false;

alter table public.research_monitor_state
  add column if not exists last_extracted_terms jsonb not null default '{}'::jsonb;

create index if not exists opportunities_expires_at_live_idx
  on public.opportunities (expires_at)
  where offer_status = 'live';

comment on column public.financial_profiles.employer_multiple_dd is
  'Whether the user says their payroll supports multiple direct-deposit destinations. NULL means unknown.';
comment on column public.financial_profiles.card_helper_opt_in is
  'Cards & Spending is optional and hidden unless the user explicitly opts in.';
comment on column public.financial_profiles.credit_cards_pay_in_full is
  'User acknowledgement used only for optional credit-card comparisons; not a guarantee of future behavior.';
comment on column public.research_findings.term_diffs is
  'Structured differences detected between the current official page, the prior page extraction, and stored opportunity terms.';
