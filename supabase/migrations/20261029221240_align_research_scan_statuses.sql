-- Match the deployed research scanner's explicit fetch/monitor statuses.
-- Retain legacy values for compatibility with existing data.
alter table public.research_findings
  drop constraint research_findings_fetch_status_check,
  add constraint research_findings_fetch_status_check
  check (fetch_status in ('ok','thin','blocked','unreachable','error','http_error','empty','network_error','unsafe_url'));

alter table public.research_monitor_state
  drop constraint research_monitor_state_last_fetch_status_check,
  add constraint research_monitor_state_last_fetch_status_check
  check (last_fetch_status is null or last_fetch_status in ('ok','thin','blocked','unreachable','error','http_error','empty','network_error','unsafe_url'));

alter table public.research_monitor_state
  drop constraint research_monitor_state_monitor_status_check,
  add constraint research_monitor_state_monitor_status_check
  check (monitor_status in ('unmonitored','baseline_pending','source_stable','changed','unreachable','blocked','needs_review','stale','verified'));

-- The research API writes cron, whereas the original schema permitted scheduled.
alter table public.research_runs
  drop constraint research_runs_trigger_type_check,
  add constraint research_runs_trigger_type_check
  check (trigger_type in ('manual','scheduled','api','cron'));
