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

### Repair CUDA 12.1 / GCC host compiler incompatibility

The owner's A100 reported nvdiffrast compile error from CUDA 12.1
host_config.h: "gcc versions later than 12 are not supported". This means
the host compiler is too new, **not** a broken NVIDIA A100, failed Torch install,
or a gated DINOv3 checkpoint.

`scripts/vast-a100-trellis1.sh resume` now checks for GCC/G++ 12, installs
ONLY these packages with apt when running as root if they are missing, sets
CC/CXX/CUDAHOSTCXX/NVCC_CCBIN to the GCC12 binaries, and compiles the existing
verified nvdiffrast source under the isolated CUDA 12.1 environment. It does
NOT reinstall CUDA, PyTorch or Kaolin and does NOT pass the dangerous
`--allow-unsupported-compiler` flag.

Suggested restart after updating the repo:

    cd /workspace/spaktok-forge
    git pull --ff-only origin feat/vast-a100-forge-bridge-20261029
    bash -n scripts/vast-a100-trellis1.sh
    set -o pipefail
    bash scripts/vast-a100-trellis1.sh resume 2>&1 | tee -a /workspace/spaktok-trellis1-install.log

Stop and inspect the **first** compiler error if a new failure appears.
Do not rerun expensive builds blindly or enable creator API yet.

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

### Torch/Transformers mismatch discovered after CUDA + import success

The screenshot on the real A100 showed:
- GPU preflight OK: NVIDIA A100 sm_80, PyTorch 2.4.0+cu121, toolkit 12.1.
- nvdiffrast, Kaolin and Forge Python imports passed.
- A newer Transformers version printed **"Disabling PyTorch because PyTorch >= 2.6 is required but found 2.4.0"**.

This is a Python package compatibility warning, NOT a reason to upgrade Torch,
which would invalidate already compiled CUDA extensions.

Run **only** the lightweight isolated Python dependency repair; it pins
Transformers 4.46.3 (compatible with Torch 2.4) and checks the PyTorch
backend remains enabled. It does not rebuild CUDA/torch/nvdiffrast:

    cd /workspace/spaktok-forge
    git pull --ff-only origin feat/vast-a100-forge-bridge-20261029
    bash -n scripts/vast-a100-trellis1.sh
    bash scripts/vast-a100-trellis1.sh repair-python

Expected: FORGE_STACK prints torch=2.4.0+cu121, transformers=4.46.3,
transformers_torch_enabled=True, cuda=12.1.

Only then perform the paid *real* image-to-GLB test with one Microsoft sample:

    bash scripts/vast-a100-trellis1.sh smoke

Do not claim a real GLB exists until the file appears AND the GLB quality
audit passes. A Warp CUDA toolkit version shown in logs is separate from
the PyTorch build and still requires validation in an actual model run.

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
