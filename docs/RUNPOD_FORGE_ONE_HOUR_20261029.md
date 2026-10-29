# Spaktok Forge: RunPod one-hour GPU test (29 October 2026)

## Current context and hard rules

The creator's RunPod screenshots show:
- 1 x **RTX PRO 6000 WK, 96GB VRAM**; On-Demand: **$2.59/GPU hour** in the actual current configuration.
- **10 GB container disk**, which is too tight for building CUDA extensions
  and downloading model weights. Increase ephemeral container disk to
  ~60 GB (check final price; this increases storage billing).
- A popup suggesting a **75 GB persistent volume at /workspace**. It
  is optional for a disposable trial. Do NOT create a global or network
  volume simply to satisfy that message.
- A "Reserved" request form listing **12+ months**. Never use that for
  a one-hour proof of concept. Select **On-Demand** only.

**No paid Pod has been launched, configured, inspected or terminated by this
repository. The creator must confirm the actual provider-side state.**

## Critical hardware compatibility

RTX PRO 6000 **Blackwell** has compute capability `sm_120`. The
original `services/forge-gpu/Dockerfile` uses PyTorch **2.4.1 + cu121**;
that CUDA binary is incompatible with Blackwell. Do not use that image on
this GPU; otherwise you may pay while inference fails.

For Blackwell use an image built on **CUDA 12.8+ and torch cu128**
with `sm_120` support, such as the *experimental and unverified*
`services/forge-gpu/Dockerfile.blackwell` based on torch2.8/cu128.
The RunPod PyTorch2.8/CUDA12.8 template in the screenshot is a sensible
starting point for a **hardware preflight**, NOT by itself a working
Stable Fast 3D endpoint.

Run a preflight BEFORE model downloads, using the public repository:

```bash
nvidia-smi
python - <<'PY'
import torch
print("torch:", torch.__version__, "CUDA build:", torch.version.cuda)
print("GPU:", torch.cuda.get_device_name(0))
print("capability:", torch.cuda.get_device_capability(0))
print("SM120:", "sm_120" in torch.cuda.get_arch_list())
print("kernel:", (torch.ones(1, device="cuda") + 1).item())
PY
git clone https://github.com/spaktok/spaktok-live-web.git
cd spaktok-live-web
python services/forge-gpu/gpu_preflight.py
```

The preflight returns JSON with `ok: true` when the basic CUDA test works.
**This does NOT certify the custom SF3D CUDA extensions, actual inference,
image security, model rights, or Rodin-level quality.** CUDA PyTorch tests
require an actual running GPU and therefore can incur GPU billing.

## Recommended one-hour lifecycle

### Safer: provider-side automatic termination at CREATE time

RunPod's documented `runpodctl pod create` supports
`--terminate-after 1h` (permanently delete Pod) and
`--stop-after 1h` (stop GPU but keep storage). For a disposable
one-hour trial choose **terminate**, then back up any required files
*before* it destroys the Pod.

From a trusted machine with official `runpodctl` already configured
and an approved reviewed PyTorch/CUDA12.8 template:

```bash
runpodctl gpu list
runpodctl template search
export RUNPOD_GPU_ID='EXACT_NAME_FROM_GPU_LIST'
export RUNPOD_TEMPLATE_ID='REVIEWED_PYTORCH_TEMPLATE_ID'
bash scripts/runpod-forge-one-hour.sh --dry-run
# ONLY after checking GPU price, available credit and provider terms:
bash scripts/runpod-forge-one-hour.sh --apply
```

The shell script **defaults to a dry run**; `--apply` requires an
interactive typed confirmation. It enforces one GPU, `--terminate-after
1h`, 60GB ephemeral container storage and zero persistent Pod volumes.
It does not create a model endpoint or configure Vercel secrets.

### If using the Android browser's "Deploy a Pod" screen

1. GPU count: **1**; GPU: the RTX PRO 6000 WK actually available.
2. Instance: **On-Demand**; reject **Reserved**.
3. Container disk: consider **60GB** ephemeral (10GB currently selected
   is not sufficient for reliable CUDA source builds + weights).
4. Avoid persistent **Global Network Volume**, **Network Volume** or
   separate `/workspace` volume for this short-lived test.
5. Verify whether the current RunPod UI offers **auto-terminate after
   60 minutes** for a *new Pod*. The screenshot does NOT show this
   control. **If not confirmed, do not assume the web UI will terminate
   the Pod automatically.** Use the reviewed CLI creation command
   instead or set a manual timer and be prepared to terminate manually.
6. Before clicking **Deploy**, check the final rate including storage,
   and ensure billing credit is sufficient without autorenew surprises.
7. Once deployed, visit **Pods** and verify name, running time and
   GPU. Run the quick preflight before attempting SF3D installation.
8. At completion visit **Pods → Terminate** and verify the Pod
   *and any separately created volumes* are absent. **Stop** alone
   can leave persistent storage charges; terminal `sleep 3600`
   is NOT a provider-enforced termination guarantee.

### Pricing boundary

At the screenshot's $2.59 GPU hourly rate, **60 minutes of billed
GPU use ≈ $2.59**, *plus storage/possible transfer/startup overhead*.
Do not present it as a fixed $2.59 charge, since overhead and any
unintended continuing volume can exceed the estimate.

## Host and application connection: disabled until verified

Only after a real model API passes end-to-end:
- Pinned licensed Stable Fast 3D or separately validated TRELLIS.2.
  Accept current upstream licenses, gated model access and EU processing.
- Exact HTTPS host `<POD_ID>-8000.proxy.runpod.net` if port8000 is
  explicitly exposed by the reviewed template. The service
  `/v1/generate` must demand a server-only bearer >=32 characters.
- Server-only Vercel variables as listed in
  `docs/SPAKTOK_FORGE_LOW_COST_3D_20261028.md`.
- **Keep `SPAKTOK_FORGE_GPU_ENABLED=false`** until authorized,
  authenticated smoke tests validate the actual GLB and GPU spend cap.
- Do NOT put `FORGE_GPU_TOKEN`, `HF_TOKEN`, RunPod API keys, bank
  details or model image URLs in GitHub commits, chat screenshots,
  public logs or Android app bundles.
- Photo uploads require creator-approved rights, transfer and GPU
  cost separately. No automatic public distribution.

## References

- RunPod CLI `pod create`, `--terminate-after 1h`, storage:
  https://docs.runpod.io/runpodctl/reference/runpodctl-remove-pods
- NVIDIA compute capability: https://developer.nvidia.com/cuda/gpus
- PyTorch's Blackwell support (torch >=2.7/cu128):
  https://github.com/pytorch/pytorch/issues/157549
- NVIDIA CUDA 12.8.1 dev image:
  https://developer.nvidia.com/cuda/cuda-x-libraries/cudnn
