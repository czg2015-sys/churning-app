-- Research Agent V1 audit/monitoring tables.
-- This migration mirrors the production schema created for Churning's private Research Center.

create table if not exists public.research_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null default 'manual',
  status text not null default 'running',
  initiated_by uuid null references auth.users(id) on delete set null,
  started_at timestamptz not null default now(),
  completed_at timestamptz null,
  total_offers integer not null default 0,
  checked_offers integer not null default 0,
  baseline_offers integer not null default 0,
  unchanged_offers integer not null default 0,
  changed_offers integer not null default 0,
  unreachable_offers integer not null default 0,
  notes text null,
  error_message text null,
  created_at timestamptz not null default now()
);

create table if not exists public.research_findings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.research_runs(id) on delete cascade,
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  institution text not null,
  product_name text not null,
  official_url text not null,
  final_url text null,
  fetch_status text not null,
  http_status integer null,
  change_status text not null,
  content_hash text null,
  previous_hash text null,
  page_title text null,
  content_length integer not null default 0,
  detected_signals jsonb not null default '{}'::jsonb,
  mismatch_flags text[] not null default '{}'::text[],
  excerpt text null,
  error_message text null,
  created_at timestamptz not null default now()
);

create table if not exists public.research_monitor_state (
  opportunity_id uuid primary key references public.opportunities(id) on delete cascade,
  last_run_id uuid null references public.research_runs(id) on delete set null,
  monitor_status text not null default 'unmonitored',
  last_checked_at timestamptz null,
  last_fetch_status text null,
  last_http_status integer null,
  last_content_hash text null,
  approved_content_hash text null,
  approved_at timestamptz null,
  approved_by uuid null references auth.users(id) on delete set null,
  last_changed_at timestamptz null,
  last_final_url text null,
  last_page_title text null,
  last_content_length integer not null default 0,
  consecutive_failures integer not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.research_actions (
  id uuid primary key default gen_random_uuid(),
  opportunity_id uuid not null references public.opportunities(id) on delete cascade,
  finding_id uuid null references public.research_findings(id) on delete set null,
  actor_user_id uuid null references auth.users(id) on delete set null,
  action_type text not null,
  notes text null,
  created_at timestamptz not null default now()
);

create index if not exists research_runs_started_at_idx on public.research_runs(started_at desc);
create index if not exists research_runs_initiated_by_idx on public.research_runs(initiated_by);
create index if not exists research_findings_run_id_idx on public.research_findings(run_id);
create index if not exists research_findings_opportunity_created_idx on public.research_findings(opportunity_id, created_at desc);
create index if not exists research_findings_change_status_idx on public.research_findings(change_status);
create index if not exists research_monitor_last_run_idx on public.research_monitor_state(last_run_id);
create index if not exists research_monitor_approved_by_idx on public.research_monitor_state(approved_by);
create index if not exists research_monitor_status_idx on public.research_monitor_state(monitor_status);
create index if not exists research_actions_finding_id_idx on public.research_actions(finding_id);
create index if not exists research_actions_actor_user_id_idx on public.research_actions(actor_user_id);
create index if not exists research_actions_opportunity_created_idx on public.research_actions(opportunity_id, created_at desc);

alter table public.research_runs enable row level security;
alter table public.research_findings enable row level security;
alter table public.research_monitor_state enable row level security;
alter table public.research_actions enable row level security;

revoke all on table public.research_runs from anon, authenticated;
revoke all on table public.research_findings from anon, authenticated;
revoke all on table public.research_monitor_state from anon, authenticated;
revoke all on table public.research_actions from anon, authenticated;

drop policy if exists research_runs_deny_client_access on public.research_runs;
create policy research_runs_deny_client_access on public.research_runs for all to anon, authenticated using (false) with check (false);
drop policy if exists research_findings_deny_client_access on public.research_findings;
create policy research_findings_deny_client_access on public.research_findings for all to anon, authenticated using (false) with check (false);
drop policy if exists research_monitor_state_deny_client_access on public.research_monitor_state;
create policy research_monitor_state_deny_client_access on public.research_monitor_state for all to anon, authenticated using (false) with check (false);
drop policy if exists research_actions_deny_client_access on public.research_actions;
create policy research_actions_deny_client_access on public.research_actions for all to anon, authenticated using (false) with check (false);
