# Spaktok Forge: NO DINOv3 (Original TRELLIS on existing Vast.ai A100)

## Owner choice
2026-10-30: creator explicitly declined DINOv3. Accordingly:
- Do not request access to Meta DINOv3 or download its gated weights.
- Do not load TRELLIS.2 or modify its pretrained image encoder. Original
  Microsoft TRELLIS (2024, `microsoft/TRELLIS-image-large`) is a
  **different model**, trained to use public PyTorch Hub DINOv2 backbones.
- The current Vast GPU admission selector only accepts
  `SPAKTOK_FORGE_GPU_PROVIDER=vast` with
  `SPAKTOK_FORGE_GPU_ENGINE=trellis-v1` for the creator.
- Keep GPU-enabled feature flags OFF until manual real-hardware validation.
- No extra GPUs, automatic rental, secrets or cloud changes have been made.

Official reference: https://github.com/microsoft/TRELLIS
Public model: https://huggingface.co/microsoft/TRELLIS-image-large
Image encoder implementation:
https://github.com/microsoft/TRELLIS/blob/main/trellis/pipelines/trellis_image_to_3d.py

## Current GPU environment and compatibility warning
The observed instance is **A100-SXM4-40GB** with 113GB container disk,
CUDA toolkit 12.8 and existing `/workspace/trellis2-env` torch 2.6+cu124.
The original TRELLIS was tested on CUDA toolkits **11.8 / 12.2**,
requires >=16GB GPU, and its standard installer selects PyTorch
2.4.0/cu118. These compiled versions are **not guaranteed compatible**
with this Vast image/toolkit; native extension builds can fail.
Do NOT run the original `setup.sh` inside the existing
`trellis2-env`, and do NOT execute a repeated full install blindly.

## Safe immediate diagnostics (no paid model download)
```bash
cd /workspace
if [ ! -d TRELLIS ]; then
  git clone --recurse-submodules https://github.com/microsoft/TRELLIS.git
fi
df -h /workspace
command -v nvcc
nvcc --version
conda info --envs
```
Prepare and validate a **separate** Python/CUDA environment for original
TRELLIS using pinned packages compatible with your toolkit. The official
installation command is documented in the project's README; don't run
it until the compiler/torch plan is confirmed for the rented A100.

## Bridge that was implemented
The following are now source-coded in the draft GitHub PR:
- `trellis_v1_engine.py`: loads original `TRELLIS-image-large` once,
  verifies VRAM, creates mesh plus Gaussian representations and calls
  original TRELLIS `postprocessing_utils.to_glb`.
- `server.py`: bounded API for `FORGE_GPU_ENGINE=trellis-v1`.
- `start-vast-trellis-v1.sh`: safe single-worker, localhost-only API
  startup, with explicit operator approval, origin and secret validation.
- `spaktok-forge-gpu-plan.ts`: maps description/destinations to
  private output profiles, never arbitrary shell commands.
- `spaktok-forge-direct-client.ts`: origin-pinned Vast HTTPS transport
  for one signed image request; checks GLB response and size.
- AI Director private fanout: one GLB becomes separate *drafts* for
  avatar, live, AR, gifts and world; does not perform rigging, native
  sync, public publishing or guaranteed full PBR.
- The current signed tickets remain short-lived and one-use in a
  single-worker trial; a durable global nonce ledger is required for
  production scaling.

## Local-only API startup AFTER actual original TRELLIS install
Never paste real tokens in chat, PRs, screenshots or shell history.
Set environment in a private secret manager and ensure the active
Python interpreter can import original TRELLIS:
```bash
python -c "from trellis.pipelines import TrellisImageTo3DPipeline; print('ORIGINAL TRELLIS IMPORT OK')"
python -m pip install 'fastapi>=0.115,<1' 'uvicorn[standard]>=0.30,<1' 'python-multipart>=0.0.9,<1'
# Configure FORGE_GPU_TOKEN and FORGE_GPU_ALLOWED_ORIGIN privately.
# TRELLIS_V1_REPO_DIR=/workspace/TRELLIS
# SPAKTOK_FORGE_OPERATOR_APPROVED=yes
# From Spaktok repository root:
bash services/forge-gpu/start-vast-trellis-v1.sh
```
Only when the actual model is loaded should
`curl http://127.0.0.1:8000/health` return
`{"ready":true,"engine":"trellis-v1"}`.

## Paid/billing and production safety
Existing A100 billing can continue even while idle. Always review the
Vast dashboard and stop/terminate when not needed. An authenticated
stable tunnel on an owner-controlled HTTPS hostname is still required.
Existing Cloudflare account did not expose a DNS zone to us during
inspection; no named tunnel was created. The previous temporary
`trycloudflare.com` tunnel is intentionally *not* admitted for
production GPU requests. Output from original TRELLIS is textured
GLB baked from Gaussian+mesh; full TRELLIS.2 PBR quality cannot be
claimed. Keep publication, Android delivery and R2 cloud storage
disabled until separate implementation and validation.
