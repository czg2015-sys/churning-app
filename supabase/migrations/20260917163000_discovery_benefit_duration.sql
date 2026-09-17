-- Capture time-limited promotion signals during discovery so research reviewers do not miss the clock.

alter table public.discovery_candidates
  add column if not exists detected_benefit_duration_days integer,
  add column if not exists detected_benefit_text text;
