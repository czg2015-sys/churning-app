-- Track qualification clocks that begin after a real user event, such as the first qualifying direct deposit.

alter table public.opportunities
  add column if not exists qualification_start_trigger text;

alter table public.missions
  add column if not exists qualification_start_date date;

update public.opportunities
set qualification_start_trigger = 'first_dd_at',
    updated_at = now()
where institution = 'SoFi'
  and product_name ilike 'Checking & Savings%DD bonus%';
