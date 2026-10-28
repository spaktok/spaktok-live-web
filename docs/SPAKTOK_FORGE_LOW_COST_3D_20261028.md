# Spaktok Forge — economical image-to-3D

## Reality and scope

**Live without GPU:** Both /spaktok-word and /reality-studio have Forge.
The browser-local **2.5D Relief** route creates genuine textured, closed
three-dimensional GLB geometry; a photographic 360-degree mesh is NOT possible
from this deterministic process. Source images stay inside the browser.

**Optional, OFF by default:** A self-hosted Stable Fast 3D API performs true
image-to-3D reconstruction on a separately rented or owned NVIDIA GPU. The
Next.js route /api/spaktok-forge/gpu accepts an authenticated one-job-per-day
request, forwards only to a pinned HTTPS host, and returns audited private GLB
without permanent object storage. It cannot perform inference on Cloudflare
Workers CPU or Vercel Next.js alone. Paid compute cannot start without operator
configuration AND creator approval.

## License and model choices (review current terms before commercial launch)

- **Stable Fast 3D (SF3D)**: Stability AI Community License. Commercial users
  must register; the community terms cover organizations below $1M annual
  revenue, beyond which a separate enterprise license is required. Preserve
  required attribution and follow all current conditions.
  https://github.com/Stability-AI/stable-fast-3d
  https://stability.ai/license
- **TRELLIS.2**: MIT model/code, subject to separate component licenses
  (e.g. differentiable renderers). High-quality upgrade candidate. Its
  published H100 speed does not generalize to cheap GPUs.
  https://github.com/microsoft/TRELLIS.2
- **Do not deploy Tencent Hunyuan3D-2.1 community model in EU markets**
  without separate legal permission: its published license explicitly
  excludes EU/UK/South Korea.
  https://github.com/Tencent-Hunyuan/Hunyuan3D-2.1/blob/main/LICENSE

## Deploy optional GPU backend (operator-only)

1. Obtain required Stable Fast 3D license/registration and model access.
2. Provision NVIDIA CUDA GPU with adequate VRAM in a secure environment.
   Start with one worker; avoid idle always-on GPUs. Select a host with
   ephemeral encrypted storage, TLS, and adjustable spend limits.
3. Build the pinned Docker image using CUDA developer tools and the pinned
   upstream Stable Fast 3D repository:
   ```bash
   docker build -f services/forge-gpu/Dockerfile -t spaktok-forge-gpu:alpha .
   ```
   This CUDA build has **not yet been tested on a real NVIDIA GPU**; model
   access is gated and dependency/driver compatibility may require changes.
4. Run on an operator-owned Nvidia CUDA machine with the license-approved
   Hugging Face token and a separate >=32-character `FORGE_GPU_TOKEN`:
   ```bash
   docker run --gpus all --rm --name forge-gpu \
     -p 8000:8000 \
     -e HF_TOKEN="<approved-secret>" \
     -e FORGE_GPU_TOKEN="<generated-operator-only-secret>" \
     spaktok-forge-gpu:alpha
   ```
   Never put actual token values in GitHub, shell history, app bundles, logs
   or documentation. In production use a secret manager and private network.
   Only expose the service via a TLS-terminated authenticated proxy.
   A Pod with HTTP port 8000 exposed typically has a Runpod HTTPS hostname
   such as `<pod-id>-8000.proxy.runpod.net`; set the exact host allowlist,
   and plan operator-controlled stop/terminate timers to prevent idle charges.
5. Apply the D1 migration `migrations/native/0006_forge_gpu_daily_claims.sql`
   to the native auth D1 database. In the Spaktok live Cloudflare account
   the empty table was installed 2026-10-28. No GPU jobs were submitted.
6. Configure **server-only** secrets on the Vercel project:
   ```text
   SPAKTOK_FORGE_GPU_ENABLED=true
   SPAKTOK_FORGE_GPU_DAILY_LIMIT=2
   SPAKTOK_FORGE_GPU_URL=https://<EXACT_HOST>/v1/generate
   SPAKTOK_FORGE_GPU_HOST=<EXACT_HOST>
   SPAKTOK_FORGE_GPU_TOKEN=<SAME_SECRET_AS_GPU_HOST>
   ```
   The URL must be HTTPS, have no custom port/query, have path
   /v1/generate, and match the allowlisted hostname exactly.
   `SPAKTOK_FORGE_GPU_DAILY_LIMIT` has no default and is required: select
   a strict integer from 1–200. It limits global reserved jobs **per UTC day**
   across all users. The server enforces the global cap and per-owner
   one-job/day uniqueness in one atomic D1 SQL insert. A failed GPU attempt
   retains its reservation; there are no implicit retries that could double
   charges. Until fully verified, leave SPAKTOK_FORGE_GPU_ENABLED=false.
7. Authenticate in Spaktok, approve image rights and GPU processing, upload
   PNG/JPEG/WebP <=8MB, then generate. One *reserved* GPU job per user per
   UTC day; failed upstream requests still consume this day's reservation
   to prevent accidental repeat charges. On a 503/timeout, check GPU server
   and D1 ledger before triggering any manual retry.
8. To protect the company, put a real monthly USD budget/auto-shutdown at
   GPU provider level. The D1 cap controls submission frequency, NOT GPU
   idle charges or cloud invoice ceilings. Do not turn on service for every
   user until billing controls, auth, logs and privacy review pass.
9. The source image is processed by the GPU service. Multipart decoding may
   temporarily spool image bytes on the GPU host; configure encrypted
   ephemeral disk and no access body logging. No user image is permanently
   stored by the provided code. GDPR basis/retention/processor contracts
   still need review before broad release.

## Example compute cost, NOT a quote

RunPod lists approximately **$0.69/GPU-hour** for certain 24GB
serverless GPUs (October 2026 listing). Pure GPU metering for 60 seconds
would be about $0.0115, **excluding** container startup, download, idle
time, network, image preprocessing, storage, fees and failed attempts.
Always validate real end-to-end billed cost. A 24/7 GPU at the same hourly
rate would cost about $496.80/30-day month, so scale to zero when idle
where the platform supports it. Typical SF3D generation times refer to a
warm GPU with model already loaded — not the full hosted job cost.

https://www.runpod.io/pricing

## Acceptance criteria before enabling 360° broadly

- Successful end-to-end job with valid GLB (UV, normals, PBR) and all required
  creator consents, with a tracked actual provider bill and no leaked secrets.
- 20+ varied licensed source images compared against licensed Rodin outputs
  by blinded visual inspection; measure silhouette, back-side geometry,
  materials, anatomy, texture quality and input similarity.
- For filter/live: <150k indexed triangles where practical, mobile texture
  budget, measured thermals/FPS on Android device, and authored morph targets
  for avatars (none are automatically supplied by SF3D).
- No automatic claim that image-to-3D output is production-rigged, unique,
  legally owned or better than Rodin without this evaluation.

## Files

- `lib/filter-engine/spaktok-forge-relief.ts`: deterministic local geometry
- `components/spaktok/spaktok-forge.tsx`: preview/export and gated GPU path
- `app/api/spaktok-forge/gpu/route.ts`: private authenticated inference proxy
- `services/forge-gpu/server.py`: optional Python inference service
- `services/forge-gpu/Dockerfile`: pinned CUDA inference container
- `lib/server/spaktok-forge-budget.ts`: global one-day operator spend gate
- `lib/server/spaktok-forge-budget.test.ts`: cap and reservation tests
- `migrations/native/0006_forge_gpu_daily_claims.sql`: one job/user/day
- `lib/filter-engine/spaktok-forge-relief.test.ts`: regression tests
