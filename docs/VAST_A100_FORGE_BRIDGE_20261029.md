# Vast.ai A100 SXM4 80GB -> Spaktok Forge bridge (2026-10-29)

## Current status
- This change is an **unmerged draft**. It does not activate paid GPU processing.
- The Vast.ai instance shown by its owner is **58258491 (1x A100 SXM4 80GB)**. Its All-in-One Studio and ComfyUI are running, but **that is not the Spaktok Forge API**.
- The public `rain-donations-courier-magical.trycloudflare.com/#/apps` link is the **Vast Studio portal**. It must **never** be configured as the GPU model endpoint.
- This PR has **not** installed Stable Fast 3D on Vast, verified model licensing, tested a 3D GLB on live hardware, or set up an automatic rental termination.
- A Vast.ai API key sent in chat must be **revoked and rotated**. Never commit it, paste it in issues, place it in a browser bundle, or include it in log output.

## Verified code design
1. Spaktok web requires creator login and separate rights/paid compute/transfer consent.
2. The client hashes the exact photo locally and calls `POST /api/spaktok-forge/gpu-ticket`.
3. The backend checks the configured **exact HTTPS GPU hostname**, D1 submission quota and authenticated GPU health (HMAC challenge).
4. The backend issues a signed, short-lived one-use upload grant (120s).
5. The browser sends the image straight to the independent Forge API `/v1/generate` hosted behind HTTPS, not through Vercel's 4.5MB Function limit.
6. The Forge API verifies origin, HMAC grant, nonce replay and exact image digest, and sends the GLB back privately.
7. The studio checks the GLB; no public asset, gift, live avatar or native integration is auto-approved.

## A100 TRELLIS.2 bootstrap (operator terminal; not automated remote access)

```bash
git clone --depth 1 -b feat/vast-a100-forge-bridge-20261029 \\
 https://github.com/spaktok/spaktok-live-web.git /workspace/spaktok-forge
bash /workspace/spaktok-forge/scripts/vast-a100-trellis2.sh preflight
# inspect the upstream Microsoft installation script and licenses first
SPAKTOK_ACCEPT_UPSTREAM_SETUP=yes bash /workspace/spaktok-forge/scripts/vast-a100-trellis2.sh install
# Once dependencies/weights are in place, generate one official example GLB
bash /workspace/spaktok-forge/scripts/vast-a100-trellis2.sh smoke
# Optional higher-detail 1m triangles / 4K texture master, for offline editing:
SPAKTOK_OUTPUT_PROFILE=master bash /workspace/spaktok-forge/scripts/vast-a100-trellis2.sh smoke
# When authorizing the API, provide FORGE_GPU_ALLOWED_ORIGIN from your terminal environment.
# The dedicated server generates a private operator token on first run; do not paste it in chat.
FORGE_GPU_ALLOWED_ORIGIN=https://v0-spaktok-elite-app.vercel.app \\
 bash /workspace/spaktok-forge/scripts/vast-a100-trellis2.sh serve
```

The official TRELLIS.2 CUDA toolchain typically needs CUDA 12.4 and Conda and can take significant install/disk time. Running these commands is **not** assured to finish during a short paid rental. The hardware/Conda preflight must succeed before selecting install. Existing Python not having PyTorch is acceptable; setup installs an isolated torch version. The official Microsoft source is pinned to commit 75fbf0183001ed9876c8dbb35de6b68552ee08bd. Actual model output is not yet tested on this user's GPU.

For TRELLIS.2 the host and Vercel must both use `FORGE_GPU_ENGINE=trellis2` / `SPAKTOK_FORGE_GPU_ENGINE=trellis2` respectively. The web API uses the 250k polygon/2K texture private GLB preview cap. The separate offline master profile exports up to 1m polygons / 4K texture and needs an explicit transfer and optimization for mobile. Neither profile guarantees higher quality than Rodin. The exact bearer token is separate from the compromised Vast provider management API key. Never reuse the Vast API key as the Forge token.

## Needed on Vast.ai (must be performed from an authenticated operator terminal)
1. Confirm one working CUDA A100 and that paid GPU time is supervised. **Destroy** the instance after exporting any useful results: the selected one-hour search duration is not an auto-termination timer.
2. Checkout the feature branch (not main) with `git switch feat/vast-a100-forge-bridge-20261029`; then use `nvidia-smi` and `python services/forge-gpu/gpu_preflight.py` to test CUDA. The published `services/forge-gpu/Dockerfile` for Ampere is **unverified** on this rented host, and may require building dependencies.
3. Complete any Stability AI model registration/licensing/gated weight access. Do not use the community Hunyuan3D-2.1 license as an EU commercial substitute.
4. Start a **separate single-worker** FastAPI service from `services/forge-gpu/server.py` on port 8000, with a unique >=32-character `FORGE_GPU_TOKEN` and exact `FORGE_GPU_ALLOWED_ORIGIN`. Do not expose this token to browsers.
5. Expose **only port 8000** through its **own** TLS-terminated Cloudflare Tunnel. The portal/ComfyUI/Jupyter tunnel must remain separate.
6. Set these **server-only** variables at the Spaktok Next.js host. Keep flags disabled until the engine readiness and test image have been verified:
   ```text
   SPAKTOK_FORGE_GPU_ENABLED=false
   SPAKTOK_FORGE_GPU_DIRECT_ENABLED=false
   SPAKTOK_FORGE_GPU_PROVIDER=vast-quick-tunnel
   SPAKTOK_FORGE_GPU_ENGINE=trellis2
   SPAKTOK_FORGE_GPU_BROWSER_ORIGIN=https://<exact Spaktok web origin>
   SPAKTOK_FORGE_GPU_HOST=<separate forge-api-xxxxx.trycloudflare.com>
   SPAKTOK_FORGE_GPU_URL=https://<same host>/v1/generate
   SPAKTOK_FORGE_GPU_TOKEN=<same secret as FORGE_GPU_TOKEN; server only>
   SPAKTOK_FORGE_GPU_DAILY_LIMIT=1
   ```
7. Run `python -m unittest test_gpu_preflight test_gpu_ticket test_gpu_health -v` in `services/forge-gpu`, plus the TypeScript/Vitest checks and a *real one-job* signed-health/CORS/GLB acceptance test.
8. Only then opt into the flags and one private creator test. Re-disable the flags and terminate the rented instance after the supervised test.

## Security and operational caveats
- Quick tunnels are ephemeral and have no stable origin. Production needs a dedicated persistent named tunnel, secure enrollment and stronger network access.
- HMAC health proves the chosen endpoint knows the operator secret; it does not establish whether an untrusted machine or its provider is safe for private photos.
- The nonce replay cache is process-local, adequate only for this single worker trial. Multiworker production requires a durable replay store.
- D1 submission quotas do not limit idle Vast GPU charges, storage charges, or cloud bills. There is no guaranteed one-hour TTL here.
- No credentials are embedded in this PR. A fresh Vast key should be supplied through a supported secret manager and access-controlled operator automation, never through client JS.
