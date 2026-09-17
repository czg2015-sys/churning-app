-- Email reminders are opt-in. Existing users remain off until they choose a preference.

alter table public.financial_profiles
  alter column reminder_preference set default 'off';

update public.financial_profiles
set reminder_preference = 'off',
    updated_at = now()
where reminder_preference = 'important';
