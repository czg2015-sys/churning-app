# Daily research — free official-source pipeline

## Schedule

The existing Vercel cron configuration is the single scheduler; do not add a second GitHub/ChatGPT schedule for the same jobs.

- 16:15 UTC daily: monitor every live offer, compare terms and approved page hashes, save findings, hold changed or repeatedly unreachable offers.
- 16:30 UTC daily: discover candidates from seven curated bank/category entries plus every supported live offer, then inspect up to 18 additional same-host offer links.
- 16:45 UTC: existing reminders job, unchanged.

These are daily schedules, not guaranteed exact-minute execution. The research jobs do not call an AI/search API. Hosting/database usage remains subject to account free-tier limits.

## Coverage and review

The initial source set is 28 bank/category entries with the current 21 live offers. Shared URLs are fetched once per discovery sweep. Categories: HYSA, checking bonus, savings bonus, debit spending, optional credit-card bonus. Sources expand automatically as live offers are added. The curated additions include American Express, Synchrony, Capital One savings, Banner Bank, and Frontwave.

Discovery follows only one level of HTTPS links on the same host, excludes application/login/business/loan URLs, and checks the destination's content before saving a candidate. Offer/referral codes are retained because they may affect eligibility. Generic direct-deposit text alone no longer counts as a bonus. The inferred category and extracted snippet still require human review, especially on pages listing multiple products.

New discoveries are private candidates, not published recommendations. Discovery does not write rates or bonuses into live offers. Existing monitoring retains Hold/review behavior and only refreshes a previously approved unchanged page. Partial failures appear in the Research Center's latest-run panel; blocked sources are never bypassed. No whole-web or exhaustive coverage claim is made.

## Runtime limits

Three concurrent discovery checks; 12-second total fetch/redirect timeout; 2 MB page limit; 200-second discovery budget and 300-second route limit. Redirect destinations are checked for public HTTPS. An exhausted budget or blocked/unreadable page is reported as partial coverage. This first phase does not render JavaScript-only pages or parse PDF terms.

## Verify and operate

1. Configure production `NEXT_PUBLIC_SUPABASE_URL`, publishable key, `SUPABASE_SECRET_KEY`, `RESEARCH_ADMIN_EMAILS`, and `CRON_SECRET` using Vercel's environment settings; never commit secrets.
2. Deploy this revision. Confirm Vercel Cron Jobs are enabled for the production project.
3. Sign in as a research admin at `/research` and run a scan and discovery sweep. Confirm completed rows in `research_runs` and `discovery_runs`, actual findings/candidates, and any partial-coverage errors.
4. Check the following scheduled day has `trigger_type = cron`; deployment success alone does not prove recurring execution.
5. Review candidates and changed offers before publishing. Add trusted source URLs to `SEED_SOURCES` for institutions outside the current set.

Local checks: `npm run test:research`, `npx tsc --noEmit`, and `npm run build` with public Supabase configuration. The test suite covers unsafe links, duplicate sources, category preservation, query-code preservation, link limits, and generic-copy false positives.
