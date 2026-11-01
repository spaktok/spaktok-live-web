# Spaktok production release policy

Effective 2026-11-01. Source of truth for ongoing development: **main**.

## Release contract

1. Changes may be committed directly to main, but a green build by itself never authorizes release.
2. Vercel Git auto-deploy for main is disabled in `vercel.json`. Do not re-enable it to work around a failed test.
3. Before each production release, record the exact main commit SHA and require:
   - Full application tests, TypeScript/Next production build and Cloudflare Worker contract tests.
   - Security checks for auth, authorization, cross-account data access, private R2, rate limits and media ownership.
   - A real authenticated end-to-end smoke run against a non-production environment.
   - Database migration compatibility, rollback path, and sensitive data/privacy review.
   - For payments and coins: idempotency, replay rejection, authoritative ledger, reconciliation and refund tests.
   - For live and camera: verified device-level reconnect, permission, latency and abuse-handling tests.
4. Only release the exact tested commit with deliberate operator action. Verify the domain after release and retain a known-good rollback deployment.
5. If a required check is failed, unavailable, or has no logs, the release is **blocked**, not waived.
6. Do not store credentials, private user media, owner IDs or signing keys in GitHub.
7. Backend migrations and new Cloudflare Workers are separate releases with their own reversible rollout; a web build passing does not approve them.

## Current blockers (do not silently override)

- The main quality workflow's first run failed without useful job-step logs. GitHub Actions execution must be restored/diagnosed before calling the gate green.
- The separate React Native app and native Android device validation are not covered by the web CI gate.
- Production business flows for LIVE/PK, coin balances and payout approvals require their own integration tests.
- Vercel deployment policies require a paid Vercel tier in the currently connected project; the repository-based deployment disable is the active safeguard.

## Release evidence template

- Commit:
- GitHub Actions runs and conclusions:
- Unit/contract test summary:
- Production build output:
- Integration + real device test record:
- Security audit:
- Cloudflare D1/R2/Workers change list and rollback:
- Vercel preview/staging URL:
- Approved deployment and timestamp:
- Post-release health and rollback verification:
