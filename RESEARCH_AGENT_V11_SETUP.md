# Churning Research Agent V1.1 + Cards & Spending

## What this version adds

### Research Agent
- Monitors every live opportunity already stored in Supabase.
- Supports checking/savings bonuses, direct-deposit bonuses, HYSAs, debit-spend rewards, CDs, and the new optional `credit_card_bonus` category.
- Checks official HTTPS sources only and rejects localhost/private-network URLs.
- Follows redirects only after re-validating the next destination.
- Processes a small number of institutions at a time instead of blasting every site simultaneously.
- Extracts important terms from official pages when possible: bonus, APY, DD amount, fees, spend requirement, timing, minimum account age, and cash-back rate.
- Compares extracted terms with both the previous official-page extraction and the stored Churning opportunity record.
- Saves structured term differences so Research Center can show `old -> new` instead of only saying “page changed.”
- A first baseline, a material change, a stored-term mismatch, or repeated unreachable source puts the opportunity on Hold.
- Research Center cannot approve a fetched baseline while mismatch flags/material changes remain unresolved.
- An unchanged page can refresh `last_verified_at` only when its exact page hash was previously approved and no term mismatch is present.
- Weekly full scan: Monday at 16:00 UTC.
- Daily targeted scan: offers with a stored expiration date in the next 14 days.
- Does not bypass bot protection, CAPTCHAs, or blocked bank pages.

### Safety / research standard
A public recommendation is not “safe” in an absolute sense. The UI uses **Research Verified**.

For deposit products, Research Verified requires a current review with known statuses for:
- hard inquiry
- ChexSystems
- Early Warning Services
- tax treatment
- deposit insurance (FDIC/NCUA or applicable structure)
- close/clawback rules

For credit-card welcome offers, Research Verified requires a current review with known statuses for:
- hard inquiry
- tax/reward treatment
- close/annual-fee rules

New/changed opportunities should normally remain Hold until reviewed.

### My Plan / lifecycle behavior
- Shows a **Before you open** box with cash needed, timing, stored recurring fees, deposit protection, close rules, and keep/close guidance.
- Account completion does not automatically mean “close it.”
- Fee accounts: review closure after qualification, payout, minimum-open, and clawback rules.
- Fee with waiver: keep while useful when waiver/benefits still make sense.
- No-fee HYSA/checking: Keep optional unless current terms or strategy say otherwise.
- Credit card with annual fee: review keep/downgrade/close before renewal; never automatically close.
- Active tracker shows **Do not do this yet** warnings when a balance, DD, or close action could jeopardize the reward.
- Reward is not counted as earned until the user manually confirms actual payout.

### Direct deposit behavior
- Main cash plan remains the core product.
- Simple/Balanced plans show at most one DD lane in ranked recommendations.
- Active mode may show a second DD lane only when the user explicitly says payroll supports multiple deposit destinations.

### Optional Cards & Spending
- Hidden behind an optional **Cards & Spending** helper from My Plan.
- Credit-score range is asked only inside this optional helper.
- Includes an “I don’t currently have a credit card” option.
- Search/select cards the user already has or recently had.
- Asks normal monthly card/debit spending and current cash-back rate.
- Credit-card offers remain hidden unless the user acknowledges they plan to pay balances in full.
- Does not recommend extra spending to chase a bonus.
- Only shows research-verified debit/credit opportunities that fit normal spending.
- Card points show conservative cash value separately from potential travel value when those researched values exist.
- Existing cards/history are used as an eligibility warning/filter, not a guarantee of approval.

## Database
The V1.1 migration has already been applied to the connected Supabase project in this working session. The migration file is also included in the repo for source control.

New fields include:
- card-helper preferences in `financial_profiles`
- `account_type` in `account_history`
- card/fee/value fields in `opportunities`
- extracted term diffs in `research_findings`
- last extracted terms in `research_monitor_state`

## Required Vercel environment variables
Keep these server-only values configured:
- `SUPABASE_SECRET_KEY` (or legacy `SUPABASE_SERVICE_ROLE_KEY`)
- `RESEARCH_ADMIN_EMAILS`
- `CRON_SECRET`

Never prefix those secrets with `NEXT_PUBLIC_`.

## Important limitation
V1.1 monitors/re-checks opportunities already in Churning. It still does **not** discover brand-new offers across the web. Discovery is Research Agent V2 and should use a search provider plus the same Hold -> Review -> Research Verified pipeline.

The `alerts_opt_in` preference is stored now, but actual email/push notification delivery still needs a notification provider in a later phase. In-app tracker warnings are included now.
