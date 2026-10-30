# Spaktok AI → Vast A100 80GB → TRELLIS.2 + DINOv3 → private GLB → Studio

Status on 2026-10-30: **source implementation on GitHub; REAL GPU generation is NOT verified**.

## Restricted BRIA RMBG-2.0 model (403) and the open alternative
The owner's first E2E attempt failed with **403** for `briaai/RMBG-2.0`, not for DINOv3.
The `microsoft/TRELLIS.2-4B/pipeline.json` explicitly selects `rembg_model.name=BiRefNet` and `rembg_model.args.model_name=briaai/RMBG-2.0`.
The **ZhengPeng7/BiRefNet** official Hugging Face model has `license: mit`, pretrained weights, and the same `AutoModelForImageSegmentation` interface. `trellis2_open_rembg.py` safely intercepts only the named upstream BRIA model during pipeline loading, substitutes `ZhengPeng7/BiRefNet` and restores the original `rembg.BiRefNet` class on success or failure. The vendor's model code uses `trust_remote_code=True`; review and pin trusted revisions before production. No BRIA license acceptance or access is necessary for the substitute.

From Vast terminal update the checked-out branch, then check open-model download:

    cd /workspace/spaktok-live-web
    git switch feat/forge-vast-trellis2-adapter-20261029
    git pull --ff-only
    conda activate /workspace/trellis2-env
    export HF_HOME=/workspace/hf-cache
    hf download ZhengPeng7/BiRefNet config.json
    python -m unittest discover -s services/forge-gpu -p test_trellis2_open_rembg.py -v

Then rerun ONE job only after reviewing the previous 403 failure:

    python services/forge-gpu/one_click_vast_a100.py --execute

This still may encounter another unverified runtime error; screenshots confirming GLB are required before claiming success. Official model page: https://huggingface.co/ZhengPeng7/BiRefNet.

Existing Vast.ai instance shown by owner: **58332583**.

## What was verified by user terminal screenshots
- A100 SXM4 80 GB, CUDA 12.4, torch 2.6.0+cu124.
- flash_attn, nvdiffrec_render, o_voxel, cumesh and flex_gemm import successfully.
- TRELLIS.2 pipeline imports successfully (model weights NOT yet confirmed).
- Hugging Face login to DINOv3-approved account and downloading
  facebook/dinov3-vitl16-pretrain-lvd1689m/config.json worked.
- This assistant has GitHub integration, not a Vast.ai terminal/API session;
  it cannot view GPU runtime state or send a request to that GPU directly.

## One-image, end-to-end local GPU test — no hostname or public exposure

Run from the **existing** Vast Jupyter Terminal, in the Python environment
already created by the owner. Do not rent a new GPU.

Step 1: install this draft's test harness from GitHub:

    conda activate /workspace/trellis2-env
    export HF_HOME=/workspace/hf-cache
    cd /workspace
    git clone --depth 1 --single-branch --branch feat/forge-vast-trellis2-adapter-20261029 https://github.com/spaktok/spaktok-live-web.git spaktok-live-web
    python -m pip install 'fastapi>=0.115,<1' 'uvicorn[standard]>=0.30,<1' 'python-multipart>=0.0.9,<1'
    cd spaktok-live-web
    python services/forge-gpu/one_click_vast_a100.py

The final command is DRY-RUN only. It confirms the source exists; no model
inference or GPU image job is sent. The official test image is
/workspace/TRELLIS.2/assets/example_image/T.png.

Step 2: one explicit owner-approved test, making EXACTLY ONE GPU request:

    python services/forge-gpu/one_click_vast_a100.py --execute

What the script does:
1. Starts the existing TRELLIS.2-4B in a locally bound HTTP server on
   127.0.0.1:8000 using a random temporary operator token never printed.
2. Loads published checkpoint and the authorized DINOv3 encoder. Model
   weights may download if not cached; costs and disk apply.
3. Waits until health returns engine=trellis2, ready=true.
4. Sends the official example image through the same GPU /v1/generate
   multipart route used by the browser.
5. Records operator-readable stage JSON (no image data or tokens).
6. Parses returned GLB v2 and requires at least one mesh, writes
   /workspace/spaktok-first.glb privately and prints SHA-256.
7. Shuts down the LOCAL HTTP service. The Vast GPU rental does NOT
   shut down automatically. Do not rerun until the outcome is reviewed.

Pass condition: SPAKTOK_LOCAL_E2E_SUCCESS with model stages including
model_ready, geometry_and_pbr_generated, glb_exported, private_glb_delivered.
This has NOT yet been observed. A file in /workspace can be downloaded via
the user's Vast Jupyter file browser then imported as a GLB in the AI Director.

## Browser image → GPU → private Studio automatic transfer (after deployment)

Already source-coded in this draft, but **NOT deployed/configured**:
- User picks image and rights/compute/transfer consent in Spaktok AI Director.
- Browser computes SHA256 and requests one signed GPU ticket via
  /api/spaktok-forge/gpu-ticket on Spaktok site.
- Same-origin server verifies logged-in user, D1 daily cap and a healthy GPU.
- Browser uploads image DIRECTLY via HTTPS to one approved pinned GPU
  hostname; no Vercel function carries 8MB image/35MB GLB.
- GPU verifies HMAC/size/mime/SHA256/origin/nonce and generates ONE GLB.
- Browser validates GLB and makes a separate UNPUBLISHED output manifest
  for avatar/live/filter/gift/world. It offers a same-browser draft handoff.
- Importing as an animated live avatar/AR/gift needs separate rigging,
  anchors, Android performance validation, animation and monetization review.

Required **private GPU environment** once HTTPS named Cloudflare Tunnel is
configured and an operator-owned hostname routes to localhost:8000:
- SPAKTOK_FORGE_OPERATOR_APPROVED=yes
- FORGE_GPU_TOKEN = random 32+ character secret
- FORGE_GPU_ALLOWED_ORIGIN = exact real Spaktok HTTPS website origin
- HF_HOME=/workspace/hf-cache
- conda activate /workspace/trellis2-env
- bash services/forge-gpu/start-vast-trellis2.sh

Required **private website server environment** (not browser variables):
- SPAKTOK_FORGE_GPU_ENABLED=true
- SPAKTOK_FORGE_GPU_DIRECT_ENABLED=true
- SPAKTOK_FORGE_GPU_PROVIDER=vast
- SPAKTOK_FORGE_GPU_ENGINE=trellis2
- SPAKTOK_FORGE_GPU_DAILY_LIMIT=1
- SPAKTOK_FORGE_GPU_BROWSER_ORIGIN = exact HTTPS website origin
- SPAKTOK_FORGE_GPU_HOST = exact stable HTTPS GPU host
- SPAKTOK_FORGE_GPU_VAST_HOSTNAME = same GPU host
- SPAKTOK_FORGE_GPU_URL = https://OWNER-GPU-HOST/v1/generate
- SPAKTOK_FORGE_GPU_TOKEN = identical private GPU operator token

Website authenticated D1 quota connection and deployment of this draft are
also required. Temporary *.trycloudflare.com URLs are intentionally denied
by browser and server allowlists, and a named tunnel is not yet provisioned.
No raw public Vast port. The existing one-process nonce ledger is suitable
ONLY for a private one-worker trial, not production. Tickets are short-lived,
and retrying may burn quota and GPU costs.

## Monitoring and proof
GPU stdout uses event=spaktok_gpu_stage, and the one-click harness will print
SPAKTOK_LOCAL_E2E_SUCCESS plus sha256 and output size. Server model loading
occurs before /health reports ready. No actual live GPU monitoring from this
chat is available until a supported Vast.ai management connection exists.

Current source:
- services/forge-gpu/trellis2_engine.py (model)
- services/forge-gpu/server.py (operator GPU API)
- services/forge-gpu/one_click_vast_a100.py (one-request harness)
- services/forge-gpu/one_image_e2e.py (GLB validation)
- app/api/spaktok-forge/gpu-ticket/route.ts (auth and quota)
- lib/filter-engine/spaktok-forge-direct-client.ts (browser bridge)
- components/spaktok/spaktok-ai-director.tsx (studio upload)
- lib/filter-engine/spaktok-studio-fanout.ts (destination manifest)

Review Microsoft TRELLIS.2 and Meta DINOv3 terms separately before
commercial publication. Gated-model approval does not waive licensing.
