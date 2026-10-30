# Spaktok private Hi3D v3.0 API smoke test (2026-10-30)

STATUS: **Code added in draft GitHub PR; not deployed; no API
credentials connected; no paid generation or actual GLB verified.**

## Purpose and constraints
Hi3D v3.0 by Math Magic is proprietary, hosted, 2048^3 image-to-3D
generation. This prototype is independent of the *user's* Meta DINOv3
credential and TRELLIS.2 setup, but **Hi3D has not publicly warranted
its entire internal implementation has zero Meta-derived components**.
Don't make that claim. Do not assume this is better than Rodin for
every subject before an empirical blind visual comparison.

This smoke test does **not** use the user's Vast.ai A100, does not
provision any GPU and makes no requests to a cloud provider by default.
Stop unneeded Vast resources in the owner's dashboard to avoid charges.

## Official information
- API overview https://docs.hi3d.ai/en/api/api-reference/overview
- Get token https://docs.hi3d.ai/en/api/api-reference/list/get-token
- Create task https://docs.hi3d.ai/en/api/api-reference/list/create-task
- Query task https://docs.hi3d.ai/en/api/api-reference/list/query-task
- Developer console https://platform.hitem3d.ai/

Do not confuse the general web subscription credits with API resource
packages. Platform API published resource table indicates:
v3.0 2048quality: geometry 30 + texture 10 + PBR 5 = 45 API credits;
2048master: geometry 130 + texture 10 + PBR 5 = 145 API credits.
**These are API credits, not confirmed USD prices.** Check the live
console package price and commercial rights before spending.

## Flow (single private test)
- Operator acquires an API resource package / trial and creates
  client_id and client_secret on the developer console.
- Python is NOT required. Node.js 22+ runs on Windows, Linux or Mac.
- Client obtains Bearer access token over TLS using HTTP Basic
  client_id:client_secret via /open-api/v1/auth/token.
- Submit **one** owned image <=8 MiB as multipart/form-data with fixed
  model hi3dv3.0, resolution 2048quality, 2M faces, request_type 3
  (mesh and texture), PBR 1, shading 0.5, GLB format 2.
- Record task ID locally (private, never public). Poll via GET query-task.
- Download GLB using a strict HTTPS host allowlist (currently
  hitem3dstatic.zaohaowu.net from official docs), no redirects,
  256 MiB cap and glTF version/length integrity check.
- Save local file with mode 0600. Large raw output likely needs
  optimization before it can be stored in Spaktok browser drafts,
  since current handoff requires <=15 MiB and direct Forge <=35 MiB.
- Do NOT auto-publish, claim rigging, animate or upload to R2.

## Commands
First, check with a photo you own. **This spends nothing**:

    npm run hi3d:smoke -- --image ./owned.png

Review the API pricing and upload/transfer privacy policies, then, if
you explicitly choose to spend credits, provide secrets using local
environment variables (not command-line arguments, GitHub issues,
ChatGPT, screenshots, commits, logs or browser public env variables):

    HI3D_CLIENT_ID=<private-id>
    HI3D_CLIENT_SECRET=<private-secret>
    HI3D_ALLOW_PAID_TEST=YES

After enabling variables locally, start the **one paid submission**:

    npm run hi3d:smoke -- --image ./owned.png --execute-paid

The CLI prints the actual provider task ID immediately. If a network
failure or long processing occurs, **do not resubmit**. Resume polling
that SAME task ID without a new generation:

    npm run hi3d:smoke -- --resume-task <task-id>

Default output directory is ./hi3d-private-results, local-only, not
automatically uploaded to Spaktok. Delete confidential images/GLB and
temporary tokens when done according to your organization's policy.

Run all offline API contract checks (no credentials, no charges):

    npm run test:hi3d

## Production tasks NOT done
This PR does not expose a paid public upload button. Before integrating
with Spaktok AI Director, add:
1. Account-scoped authenticated submit/status endpoints with D1
   idempotency, a confirmed allowance and platform spend limits.
2. An approved private Cloudflare R2 ingest flow and owner-scoped
   artifact visibility; do not put API credentials in native Android.
3. Vendor DPA/GDPR transfer assessment, retention/deletion, commercial
   license review and a check of the provider's unpublished dependencies.
4. Automatic GLB optimization to mobile budgets and verified avatar
   rigging, gift animation, filter anchors and Android/Agora performance.
5. Provider errors/retries, and a known CDN allowlist when the live
   provider returns a new documented model-output domain.

The actual generation must remain **opt-in, budgeted and disabled by
default**. The initial smoke test CLI is the only paid-capable new path.
