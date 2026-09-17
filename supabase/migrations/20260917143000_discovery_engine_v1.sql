create table if not exists public.discovery_runs (
  id uuid primary key default gen_random_uuid(),
  trigger_type text not null check (trigger_type in ('manual','cron')),
  status text not null default 'running' check (status in ('running','completed','failed','skipped')),
  provider text not null default 'brave',
  started_at timestamptz not null default now(),
  completed_at timestamptz,
  queries_count integer not null default 0,
  results_count integer not null default 0,
  new_candidates integer not null default 0,
  duplicate_candidates integer not null default 0,
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.discovery_candidates (
  id uuid primary key default gen_random_uuid(),
  candidate_key text not null unique,
  institution_guess text,
  product_name_guess text,
  category_guess text not null,
  source_title text,
  source_url text not null,
  source_domain text,
  source_snippet text,
  official_source_status text not null default 'needs_official_source' check (official_source_status in ('possible_official','needs_official_source','official_confirmed','not_official')),
  official_url text,
  candidate_status text not null default 'discovered' check (candidate_status in ('discovered','terms_extracted','research_review','verified','hold','dismissed','duplicate')),
  matched_opportunity_id uuid references public.opportunities(id) on delete set null,
  first_discovered_at timestamptz not null default now(),
  last_seen_at timestamptz not null default now(),
  last_discovery_run_id uuid references public.discovery_runs(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_sightings (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.discovery_runs(id) on delete cascade,
  candidate_id uuid not null references public.discovery_candidates(id) on delete cascade,
  source_query text not null,
  source_url text not null,
  source_title text,
  source_snippet text,
  result_rank integer,
  created_at timestamptz not null default now(),
  unique(run_id, candidate_id, source_query, source_url)
);

create index if not exists discovery_runs_started_at_idx on public.discovery_runs(started_at desc);
create index if not exists discovery_candidates_status_idx on public.discovery_candidates(candidate_status, last_seen_at desc);
create index if not exists discovery_candidates_category_idx on public.discovery_candidates(category_guess, last_seen_at desc);
create index if not exists discovery_sightings_run_idx on public.discovery_sightings(run_id);

alter table public.discovery_runs enable row level security;
alter table public.discovery_candidates enable row level security;
alter table public.discovery_sightings enable row level security;
