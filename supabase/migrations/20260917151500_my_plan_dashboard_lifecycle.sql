-- My Plan dashboard lifecycle + reminder infrastructure

alter table public.opportunities
  add column if not exists benefit_duration_days integer,
  add column if not exists benefit_label text,
  add column if not exists benefit_start_trigger text,
  add column if not exists standard_apy_after_benefit numeric;

alter table public.missions
  add column if not exists funded_at date,
  add column if not exists first_dd_at date,
  add column if not exists benefit_start_date date,
  add column if not exists benefit_end_date date,
  add column if not exists email_reminders_enabled boolean;

alter table public.financial_profiles
  add column if not exists reminder_preference text not null default 'important';

alter table public.account_history
  add column if not exists opportunity_id uuid references public.opportunities(id) on delete set null,
  add column if not exists bonus_received boolean;

do $$
begin
  if not exists (
    select 1 from pg_constraint where conname = 'financial_profiles_reminder_preference_check'
  ) then
    alter table public.financial_profiles
      add constraint financial_profiles_reminder_preference_check
      check (reminder_preference in ('all','important','off'));
  end if;
end $$;

create table if not exists public.reminder_notifications (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  mission_id uuid not null references public.missions(id) on delete cascade,
  reminder_type text not null,
  target_date date not null,
  days_before integer not null,
  title text not null,
  message text not null,
  channel text not null default 'in_app',
  email_status text not null default 'not_requested',
  read_at timestamptz,
  sent_at timestamptz,
  created_at timestamptz not null default now(),
  unique (mission_id, reminder_type, target_date, days_before)
);

alter table public.reminder_notifications enable row level security;

drop policy if exists reminder_notifications_select_own on public.reminder_notifications;
create policy reminder_notifications_select_own
on public.reminder_notifications for select
using ((select auth.uid()) = user_id);

drop policy if exists reminder_notifications_update_own on public.reminder_notifications;
create policy reminder_notifications_update_own
on public.reminder_notifications for update
using ((select auth.uid()) = user_id)
with check ((select auth.uid()) = user_id);

create index if not exists reminder_notifications_user_created_idx
  on public.reminder_notifications(user_id, created_at desc);

create index if not exists missions_reminder_dates_idx
  on public.missions(user_id, qualification_deadline, benefit_end_date, payout_due_date, safe_close_review_date);

-- Backfill the known time-limited benefit records from their already-reviewed terms.
update public.opportunities
set benefit_duration_days = 183,
    benefit_label = 'Promotional APY boost',
    benefit_start_trigger = 'opened_at',
    standard_apy_after_benefit = 3.75,
    qualification_days = null,
    updated_at = now()
where institution = 'CIT Bank'
  and product_name = 'Platinum Savings with CITBOOST';

update public.opportunities
set benefit_duration_days = 90,
    benefit_label = 'Promotional savings rate',
    benefit_start_trigger = 'opened_at',
    updated_at = now()
where institution = 'Citi'
  and product_name ilike 'Savings — 3.75% promotional rate%';

update public.opportunities
set benefit_duration_days = 365,
    benefit_label = 'Monthly reward period',
    benefit_start_trigger = 'opened_at',
    updated_at = now()
where institution = 'BMO'
  and product_name ilike 'Savings Builder%';

update public.opportunities
set benefit_duration_days = 183,
    benefit_label = 'Monthly bonus period',
    benefit_start_trigger = 'opened_at',
    updated_at = now()
where institution = 'BMO'
  and product_name ilike 'Smart Advantage Checking%';
