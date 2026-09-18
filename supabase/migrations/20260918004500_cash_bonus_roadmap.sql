-- Persist user-selected roadmap swaps while continuing to rebuild the plan from live profile + opportunity data.

alter table public.financial_profiles
  add column if not exists roadmap_selected_opportunity_ids jsonb not null default '[]'::jsonb,
  add column if not exists roadmap_updated_at timestamptz;
