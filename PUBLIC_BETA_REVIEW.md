# Public beta review — November 5, 2026

## Implemented

- My Profile replaces Start Here; editable sections retain mounted form values.
- New profiles start with zero cash instead of illustrative account balances.
- Plain-language homepage explanations for paycheck bonuses, savings bonuses and APY.
- Opportunities defaults to the full catalog with search, category and optional profile filters.
- Offer cards show deposit requirements, fees, application deadlines, verification dates, eligibility, payout and closing information.
- Research status is a server-side projection of allowed aggregate fields. No raw logs, initiator identities or research credentials go to visitors.
- Verified badges require current evidence and complete review; expired and unverified offers are labeled.
- Saved accounts remain separate from new recommendations; remove the arbitrary eight-account card cap.
- Missing qualification dates remain visible in the timeline. Dates derive from the qualifying event.
- Explicit manual-tracking explanation and update-after-payday prompts; save confirmation.
- An already-opened account can be recorded even when new-offer availability checks would reject a new commitment.
- My Plan reports read errors instead of silently showing empty data.
- Password reset request/form and PKCE confirmation handling; redirect destinations use an allowlist.

## Verified

- TypeScript check passed.
- 33 tests passed, including evidence freshness, incomplete review, expiry, qualification timing, discovery and reward-history regression tests.
- Production build passed locally with publishable Supabase configuration. Network restrictions prevented local live-feed reads; deployment verification is separate.
- Production database: RLS enabled on all 19 public tables; owner-scoped policies on private user tables; no public views or SECURITY DEFINER functions found.
- Database role simulation: the existing owner reads their missions, an unrelated authenticated identity reads zero rows from ten private tables, and signed-out access returns zero rows or permission denied. No account records were changed. This is not a full penetration test or browser session test.
- Production monitoring and discovery have recent daily runs. November 5 monitoring read 19 of 25 official pages; six were unavailable. Discovery recorded three new candidates with partial source coverage.

## Launch gates still requiring verification

- Preview/production browser checks at desktop and mobile widths.
- Two real test accounts: sign up, email confirmation, login/logout, password recovery, save/reload and cross-account read/write attempts through the API.
- Confirm recovery redirect allowlist and email delivery settings in Supabase. No email was sent during implementation.
- Confirm account updates and all production routes after deployment.
- Resolve blocked research sources and review new candidates before publishing offers; a successful scan is not verification of all terms.
- Supabase advisor reports leaked-password protection disabled. Evaluate availability within the free-plan requirement; no paid feature was enabled.
- Complete an accurate privacy policy and user data deletion process before a broad public launch.
- Small tester group feedback before LinkedIn announcement; use sample financial data in screenshots.
