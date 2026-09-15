# V1.1 Changelog

- Lighter charcoal/green background while preserving the existing visual identity.
- Optional Cards & Spending helper added under `/cards`.
- Credit score/card history/pay-in-full questions appear only inside the optional card helper.
- Debit and credit-card opportunities remain separate from the core cash plan.
- Core recommendation engine excludes credit-card and brokerage categories.
- Multiple direct-deposit lanes limited to Active mode + confirmed payroll split support.
- Research Verified now requires granular review completeness, current verification, confidence, and pass gate.
- Research Agent extracts structured terms and records old -> new differences.
- Unsafe/internal URLs and unsafe redirect targets are rejected.
- Research fetching is concurrency-limited.
- Baselines/mismatches/changes trigger Hold; mismatched baselines cannot be approved.
- Weekly full scan plus daily scan for offers expiring within 14 days.
- Before You Open details added to top recommendations.
- Reward Tracker adds Do Not Do This Yet, fee-watch, and keep/close lifecycle guidance.
- Account closure is a review recommendation, never an automatic action.
- Database migration for V1.1 has already been applied to the connected Supabase project and is included in source control.
