# Churning

Churning is a personal cash-planning workspace. It helps users compare bank bonuses and high-yield savings options, build a cash allocation plan, and track requirements without automatically moving money.

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the Supabase project URL and publishable key.
3. Run `npm install`.
4. Run `npm run dev`.

## Checks

- `npm run lint`
- `npm run build`

The live app uses Supabase Auth and row-level security. Never add a Supabase secret or service-role key to a public environment variable.
