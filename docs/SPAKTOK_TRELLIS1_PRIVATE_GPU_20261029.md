# Spaktok Private GPU: Microsoft TRELLIS v1 (DINOv2)

Status 2026-10-29: committed on a DRAFT feature branch. No GPU instance
has been rented or started by this code, and end-to-end inference is NOT
yet demonstrated.

## The model and safety boundaries

Official Microsoft model: https://huggingface.co/microsoft/TRELLIS-image-large
Upstream example: https://github.com/microsoft/TRELLIS/blob/main/example.py
Code revision: 193e0502b5cb3eb5997ec457d5340e95d09b158e

The exact built-in image conditioner is dinov2_vitl14_reg, NOT gated
DINOv3. The original TRELLIS model declares MIT; third-party CUDA extensions
may carry separate licenses. No automatic model replacement, no paid inference,
and no Rodin superiority claims without comparison tests.

Forge server routes FORGE_GPU_ENGINE=trellis1 to trellis1_engine.py.
The generator requires the real Gaussian and mesh outputs, uses Microsoft's
official to_glb API, and verifies GLB 2.0 mesh structure.
The existing 8 MB image, 35 MB GLB, authentication, HMAC, origin, daily quota,
and single-worker limits remain in force. Offline unit tests are in
services/forge-gpu/test_trellis1_engine.py.

The previous 15KB environment manifest is NOT a complete TRELLIS installation.
Use a fresh isolated Conda env trellis, do not overwrite old trellis2.
Previously shared provider API keys must be revoked/rotated.

## Run only when the OWNER starts one supervised A100

In the rented Vast terminal, never in a public notebook URL:

    cd /workspace
    git clone --branch feat/vast-a100-forge-bridge-20261029 \
      https://github.com/spaktok/spaktok-live-web.git spaktok-forge
    cd /workspace/spaktok-forge

    bash scripts/vast-a100-trellis1.sh preflight

This checks visible NVIDIA GPU, Conda, compiler, CUDA toolkit. Stop on failure.

Only when ready to watch compilation and hourly costs:

    bash scripts/vast-a100-trellis1.sh install

The currently observed Vast A100 host has nvcc12.9. The script installs NVIDIA's
isolated CUDA Toolkit 12.1.1 in Conda, pins PyTorch 2.4.0+cu121,
and REQUIRES the active nvcc to report CUDA12.1 before building extensions.
The official setup script's exact torch-version matching is normalized for
PyTorch wheels with a +cu121 suffix, and xformers attention is selected instead
of flash-attn to avoid extra compilation risk. CUDA extensions still MUST
be confirmed on the rented A100 before treating this as a working image.

### Repair after partial installation: existing nvdiffrast source

If the official setup prints `fatal: destination path '/tmp/extensions/nvdiffrast' already exists`
after Kaolin installation, **DO NOT re-run install and DO NOT delete the directory**.
The newer Spaktok script accepts `resume` and verifies that the old directory
really is the official NVlabs source before compiling it in the existing
TRELLIS Conda environment. Then it installs only the GPU API dependencies and
performs CUDA and Python import checks, without redoing earlier installs:

    cd /workspace/spaktok-forge
    git pull --ff-only origin feat/vast-a100-forge-bridge-20261029
    set -o pipefail
    bash scripts/vast-a100-trellis1.sh resume 2>&1 | tee -a /workspace/spaktok-trellis1-install.log

On `nvdiffrast directory remote is not the official NVlabs repository` the
script intentionally stops; diagnose provenance before touching the existing
directory. Only proceed to `smoke` when `Python imports passed` appears.

To create a REAL sample from Microsoft's public image:

    bash scripts/vast-a100-trellis1.sh smoke

On success it creates:
    /workspace/spaktok-trellis1-preview.glb

This runs a structural GLB audit, but must also pass human visual tests
for backside geometry, UV textures, shading and native Android review.
Download a real GLB and logs BEFORE destroying GPU; the shell script does NOT
stop, destroy or limit provider billing.

If smoke fails, do NOT start the API, do NOT enable web flags, do NOT
automatically retry or rent another GPU. Inspect the failure first.

## Private API after successful sample validation

Set FORGE_GPU_ALLOWED_ORIGIN to the EXACT https:// front-end origin and
configure a server-side FORGE_GPU_TOKEN at least 32 chars. Never send this
secret in chat or commit it to the repository.

    export FORGE_GPU_ALLOWED_ORIGIN=https://YOUR-EXACT-SPAKTOK-HOST
    bash scripts/vast-a100-trellis1.sh serve

Forge binds 127.0.0.1:8000, --workers 1, --no-access-log. Use a separate
exact-host TLS tunnel to the API port; Jupyter and Vast portal URLs are not
a model API.

After verifying signed health, same operator key, license, and direct GLB
generation, configure the web server ONLY in a private pilot:

    SPAKTOK_FORGE_GPU_ENGINE=trellis1
    SPAKTOK_FORGE_GPU_PROVIDER=vast-quick-tunnel
    SPAKTOK_FORGE_GPU_MODEL_ACCESS=approved
    SPAKTOK_FORGE_GPU_URL=https://EXACT-TLS-API-HOST/v1/generate
    SPAKTOK_FORGE_GPU_HOST=EXACT-TLS-API-HOST
    SPAKTOK_FORGE_GPU_BROWSER_ORIGIN=https://YOUR-EXACT-SPAKTOK-HOST
    SPAKTOK_FORGE_GPU_TOKEN=YOUR-FRESH-SHARED-OPERATOR-SECRET
    SPAKTOK_FORGE_GPU_DAILY_LIMIT=1
    SPAKTOK_FORGE_GPU_ENABLED=true
    SPAKTOK_FORGE_GPU_DIRECT_ENABLED=true

The model access flag is a manual operator declaration about the CHOSEN
engine's model license and weights. It is not a Meta DINOv3 approval.
Until sample and security checks pass, leave BOTH enabled flags false.

## Remaining release blockers

- GitHub Actions reports failure with missing job steps/logs; offline tests
  are authored but are NOT established as passing.
- No real A100 TRELLIS v1 inference, preview or Android device test yet.
- No verified long-lived GPU endpoint, autoscaling or automatic rent shutdown.
- Per-process one-use nonce replay guard is not multi-worker durable.
- R2 private artifact upload, D1 lifecycle and creator review not complete.
- No real rigging, avatar expressions, gifts animation, face tracking, world
  placement or automatic publishing proved by one generated GLB.

The project keeps GPU off and private drafts only until these gates pass.
