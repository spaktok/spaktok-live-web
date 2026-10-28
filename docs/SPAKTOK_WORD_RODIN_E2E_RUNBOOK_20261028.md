# Spaktok Word • Rodin end-to-end connector (October 28, 2026)

## Actual components
- Server session-authenticated route: `/api/spaktok-word/rodin` (GET status, POST enqueue, DELETE authorized asset cleanup).
- Server HMAC gateway `lib/server/spaktok-word-gateway.ts` to Cloudflare `spaktok-word-rodin.spaktok.workers.dev` (no public bypass).
- Worker: `cloudflare/workers/spaktok-word-rodin.mjs`; existing D1 `spaktok-primary`; existing private R2 `spaktok-private-drafts`; EU queue `spaktok-word-rodin-jobs`; cron every five minutes.
- Creator-facing Spaktok Word UI: `components/spaktok/word-rodin-execution.tsx`. Once Rodin reports `needs_review`, creators can inspect and import a fetched GLB into Word's **existing project**, triggering structural QA and resetting rights/animation/device approval. A validated asset <=15 MB may be handed to Avatar Studio in the browser. It is never auto-published.

## Current production configuration
- `WORD_PAID_ENABLED=false` is an intentional cost safeguard. There is **no** Rodin API key configured in this integration and **no** Vercel credit approval variable. No auto-paid task is authorized or executable.
- Cloudflare `WORD_SIGNING_SECRET` is a secret (not visible to browsers). Vercel has `SPAKTOK_WORD_WORKER_URL` and `SPAKTOK_WORD_SIGNING_SECRET` server-only.
- Existing D1 migrations:
  - `migrations/native/0004_word_rodin_jobs.sql`: private owner-scoped ledger and per-user idempotency.
  - `migrations/native/0005_word_source_fingerprint.sql`: SHA-256 immutable source digest, rejects idempotency reuse for different bytes.
- Exact Rodin Gen-2.5 pinned inputs: tier `Gen-2.5-Medium`, `mesh_mode=Quad`, `quality=medium`, `material=PBR`, output `glb`, no paid add-ons. Current documented base is 0.5 credits. Confirm provider quote and API entitlement before switching billing on.
- The only accepted quote in Worker is exactly 0.5 credits, matching the pinned input. No client or user may set the tier/addons dynamically during server execution.

## Operator activation prerequisites (separate explicit action)
1. Verify Hyper3D account has API access and budget; review current price, data retention, and creator consent. Don't paste API keys into public source or chat.
2. Inspect actual Rodin completion response from approved account to identify the **exact HTTPS CDN hostname(s)** used for GLB downloads. Configure only those hosts in `RODIN_DOWNLOAD_HOSTS` (comma-separated); reject redirects, userinfo, IP addresses and unapproved domains.
3. Add Cloudflare Worker secret `RODIN_API_KEY`; configure `RODIN_FIXED_JOB_CREDITS=0.5` on Worker and `SPAKTOK_WORD_FIXED_CREDITS=0.5` in Vercel production. Use secret settings for credentials. Confirm both endpoints and queue health.
4. After physical staging checks, switch `WORD_PAID_ENABLED` to `true` on the Worker. **Do not do this automatically.** A client cannot override this gate; any queued message that arrives after the operator disables it is marked failed rather than charged.
5. Test precisely one original/owned test picture with signed-in creator session and two explicit consent controls (photo transfer and 0.5-credit billing approval). Inspect D1 status and private R2 result. Confirm first /status request >=5s after submission, and that `/status` uses `jobs.subscription_key` and `/download` uses top-level `uuid`.
6. Inspect GLB topology, UV, PBR, eye blink, jaw and lip visemes, model silhouette from side/back, and phone thermal FPS. Rodin generation and skeleton rigging **do not guarantee ARKit 52 blendshape targets**. Creator must re-confirm rights for generated asset.
7. Retain user-visible deletion for queued/terminal assets; in-progress paid vendor tasks cannot be reliably cancelled/refunded by this API. D1 task ledger remains for charge accounting. Do not claim removal when R2 deletion returns partial failure.

## Outstanding quality / security work
- Facial retopology with stable ARKit morph naming, UV bake, anisotropic hair, LOD/texture optimization, complete face 6DoF transformation.
- Real Agora publishing (not local preview), audio/video sync, device laboratory QA, permissions and re-encryption/revocation.
- Job audit log, budget caps by team, provider billing reconciliation, refund policy, retention and deletion of vendor copies.
- Implement automated test execution on a runner. A Vercel Next.js/TypeScript production build does not prove all unit tests, visual fidelity, or user/device behavior.

## Provider specifications (verified)
- https://docs.hyper3d.ai/en/get-started/quick-start
- https://docs.hyper3d.ai/en/api-specification/rodin-gen2-5
- https://docs.hyper3d.ai/en/api-specification/download-results
