# Operator-only one-image Spaktok AI → Vast TRELLIS.2 → Studio E2E

## Verified prerequisites

The owner already demonstrated a successful localhost TRELLIS.2 + DINOv3 +
ZhengPeng7/BiRefNet generation on Vast A100 80GB. The resulting private GLB
(5,343,540 bytes) and five-target JSON draft manifest are independently
present in Spaktok's Cloudflare R2 bucket `spaktok-private-drafts`.

This does **not** prove a website upload-to-GPU round-trip. The following
is a **separate paid single-image acceptance test**, not production.

## Preview-only transport when no Cloudflare DNS zone is available

The Spaktok Cloudflare account currently has no managed zone or named Tunnel
available. For testing only, the repo accepts an explicit operator-pinned
`*.trycloudflare.com` Quick Tunnel **IF AND ONLY IF**:
- Vercel uses `VERCEL_ENV=preview`; production is rejected.
- `SPAKTOK_FORGE_GPU_ALLOW_PREVIEW_QUICK_TUNNEL=true` explicitly.
- `SPAKTOK_FORGE_GPU_QUICK_TUNNEL_EXPIRES_AT` Unix epoch is in the future
  and at most 3600 seconds away.
- Provider is `vast`, engine is `trellis2`, `SPAKTOK_FORGE_GPU_DAILY_LIMIT=1`.
- Exact tunnel hostname is pinned in two separate server env vars.
- HTTPS is mandatory, single-use HMAC tickets expire in 120s, D1 quota
  and owner-session auth remain enabled; browser CORS requires exact origin.
- The tunnel must be shut down after the one test. This is **not** a secure
  production ingress design. For production use an owned named Tunnel or
  authenticated R2/queue worker; no continuously public GPU endpoint.

## Before touching a paid GPU

1. Review and validate PR #15. Preview Vercel build must be READY and
   relevant GitHub checks should be green.
2. Prepare separate **preview** Spaktok auth + D1 database access with
   `SPAKTOK_D1_BRIDGE_URL`, `SPAKTOK_D1_BRIDGE_SIGNING_KEY`,
   `SPAKTOK_AUTH_PEPPER` and owner login. Do not copy production credentials
   into an unreviewed preview branch. The preview origin will have a distinct
   login cookie; production login cookies do not transfer.
3. Confirm the D1 quota table used by
   `lib/server/spaktok-forge-budget.ts` is available.
4. In Vercel Preview, run `GET /api/spaktok-forge/gpu-ticket`:
   disabled until all runtime variables are configured AND the remote GPU
   `/health` endpoint returns `{"ready":true,"engine":"trellis2"}`.
5. The owner is responsible for rented GPU cost and shutdown.
   Do not enable public user access or run more than one image test.

## On the same Vast instance (operator action, not a ChatGPT remote login)

```bash
conda activate /workspace/trellis2-env
export HF_HOME=/workspace/hf-cache
cd /workspace/spaktok-live-web
git pull --ff-only

# Replace exactly with the origin of the Vercel PREVIEW you opened.
export FORGE_GPU_ALLOWED_ORIGIN='https://v0-spaktok-elite-app-git-feat-forge-bbc71f-danialmq3s-projects.vercel.app'
export FORGE_GPU_TOKEN="$(python -c 'import secrets;print(secrets.token_urlsafe(48))')"
export SPAKTOK_FORGE_OPERATOR_APPROVED=yes
bash services/forge-gpu/start-vast-trellis2.sh
```

This stays in the foreground, binds `127.0.0.1:8000`, and loads the model
once. In a second Vast terminal:

```bash
command -v cloudflared || echo 'Install official Cloudflare cloudflared first'
cloudflared tunnel --url http://127.0.0.1:8000
```

It prints a **temporary** `https://<random>.trycloudflare.com` hostname.
The service still needs the exact pre-approved origin in its CORS settings.

## Vercel Preview environmental settings (NOT production)

Set all settings below for the same reviewed preview branch/project.
Use Vercel's secret input for `SPAKTOK_FORGE_GPU_TOKEN` and never paste
tokens into ChatGPT, issues, images, or GitHub source. The value must
exactly match `FORGE_GPU_TOKEN` on Vast. This implies the owner must
transfer that secret directly from the Vast terminal into Vercel's
protected settings.

```ini
SPAKTOK_FORGE_GPU_ENABLED=true
SPAKTOK_FORGE_GPU_DIRECT_ENABLED=true
SPAKTOK_FORGE_GPU_DAILY_LIMIT=1
SPAKTOK_FORGE_GPU_PROVIDER=vast
SPAKTOK_FORGE_GPU_ENGINE=trellis2
SPAKTOK_FORGE_GPU_BROWSER_ORIGIN=https://v0-spaktok-elite-app-git-feat-forge-bbc71f-danialmq3s-projects.vercel.app
SPAKTOK_FORGE_GPU_HOST=<exact generated quick tunnel host only>
SPAKTOK_FORGE_GPU_VAST_HOSTNAME=<same exact host>
SPAKTOK_FORGE_GPU_URL=https://<same host>/v1/generate
SPAKTOK_FORGE_GPU_TOKEN=<protected token set in Vercel only>
SPAKTOK_FORGE_GPU_ALLOW_PREVIEW_QUICK_TUNNEL=true
SPAKTOK_FORGE_GPU_QUICK_TUNNEL_EXPIRES_AT=<Unix seconds, now plus at most 3600>
```

Server-side variables are read at function runtime; redeploy preview so
environment variables take effect reliably. Never set preview tunnel flag
in production.

## Acceptance run from the browser

1. Sign into **Spaktok native auth on the same preview origin**.
2. Open `/spaktok-word#ai-director`.
3. Use a fully owned/authorized image, PNG/JPEG/WEBP between 128 bytes
   and 8 MB. Select `AI 360°`, choose targets.
4. `/api/spaktok-forge/gpu-ticket` must report `enabled:true`,
   `provider:"vast"`, `engine:"trellis2"`.
5. Confirm source rights, compute charge, and external image transfer.
6. Click Generate **once**. The signed route creates D1 quota and one-time
   HMAC, browser uploads raw image direct to pinned Cloudflare Quick Tunnel;
   GPU performs one TRELLIS.2 inference and returns private GLB bytes.
7. Browser verifies self-contained GLB, audits geometry/PBR,
   and (as of latest branch) automatically saves a one-bundle
   IndexedDB manifest for the five selected Studio destinations.
8. Open target section(s) in the same browser; verify visual preview.
   All are unpublished drafts, *not* automatically rigged/live/AR-ready.
9. Stop the tunnel, GPU server and Vast rental; remove preview env
   tunnel variables and revoke shared trial secret.

**Failure:** do not retry automatically; nonce and quota may have been
consumed and GPU time is billable. Record precise public-safe UI message,
GPU stage log (no secrets), Vercel route status and R2 audit.

## Remaining production-grade needs

Use named Cloudflare DNS Tunnel or serverless queue-driven pull worker,
durable nonce admission, per-owner R2 object ACL, async jobs/progress,
asset moderation/rights, final rigging and mobile Android quality testing.
