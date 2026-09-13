# Churning

Churning is a safety-first cash strategy and reward-tracking workspace. It compares bank bonuses and high-yield savings against a user’s current cash baseline, then tracks the real requirements from account opening through payout and account-exit review.

## Product loop

1. **Build a profile** — available cash, reserve, current APY, paycheck capacity, normal spending, tax estimate, state, and prior-bank history.
2. **Rank opportunities** — only recently verified offers that clear the research gate can become actionable recommendations.
3. **Add real starting details** — opening date, committed cash, and direct-deposit progress are entered by the user; Churning never moves money or opens accounts.
4. **Track the mission** — time progress and requirement completion are shown separately, with payout timing, fees, research notes, and a safe-close review date.
5. **Confirm earnings** — lifetime earnings only increase after the user records the actual payout/interest received.

Guest Mode runs the same planning and tracker experience in temporary local React state. It does not write guest inputs to Supabase.

## Stack

- Next.js App Router
- React
- Supabase Auth + Postgres + Row Level Security
- Vercel

## Local setup

1. Copy `.env.example` to `.env.local`.
2. Add the Supabase project URL and publishable key.
3. Run `npm install`.
4. Run `npm run dev`.

```bash
NEXT_PUBLIC_SUPABASE_URL=...
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=...
```

## Checks

```bash
npm run lint
npm run build
```

## Security model

Churning does not require or use bank login credentials for the current workflow. Users take all external banking actions themselves. User-owned plans, missions, steps, and history are protected by Supabase row-level security. Never expose a Supabase secret/service-role key in a `NEXT_PUBLIC_` variable or commit secrets to the repository.
