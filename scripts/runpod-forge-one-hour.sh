#!/usr/bin/env bash
# SAFE RunPod GPU Pod preparation. No paid resource is launched.
# CRITICAL 2026-10-29: RunPod removed --stop-after / --terminate-after
# in runpodctl v2.12.0. Earlier versions accepted but DID NOT enforce
# them; a Pod can keep billing after the requested deadline.
# Source: https://github.com/runpod/runpodctl/releases/tag/v2.12.0
# The only guaranteed cleanup is verified provider-side deletion.
set -euo pipefail

MODE="${1:---dry-run}"
if [[ "$MODE" != "--dry-run" && "$MODE" != "--apply" ]] || (( $# > 1 )); then
  echo "Usage: RUNPOD_GPU_ID='exact GPU name' RUNPOD_TEMPLATE_ID='reviewed ID' $0 [--dry-run|--apply]" >&2
  exit 2
fi
if [[ "$MODE" == "--apply" ]]; then
  echo "BLOCKED: RunPod does not enforce a one-hour pod TTL." >&2
  echo "No GPU has been launched. To prevent unexpected charges, this" >&2
  echo "script does not create paid Pods. Deploy via the provider UI" >&2
  echo "only when you can monitor it and explicitly Terminate at 60min." >&2
  echo "For unattended jobs use a validated external deletion scheduler" >&2
  echo "or an appropriately tested scale-to-zero Serverless endpoint." >&2
  exit 3
fi
GPU_ID_PATTERN='^[A-Za-z0-9 _.,+-]{5,100}
  echo "Set RUNPOD_GPU_ID to an exact name from: runpodctl gpu list" >&2
  exit 2
fi
if [[ -z "${RUNPOD_TEMPLATE_ID:-}" || ! "$RUNPOD_TEMPLATE_ID" =~ ^[A-Za-z0-9_-]{3,100}$ ]]; then
  echo "Set RUNPOD_TEMPLATE_ID to a reviewed PyTorch/CUDA12.8 template ID" >&2
  exit 2
fi
DISK_GB="${RUNPOD_CONTAINER_DISK_GB:-60}"
if [[ ! "$DISK_GB" =~ ^[0-9]+$ ]] || (( DISK_GB < 30 || DISK_GB > 100 )); then
  echo "Ephemeral RUNPOD_CONTAINER_DISK_GB must be 30-100" >&2
  exit 2
fi
CLOUD_TYPE="${RUNPOD_CLOUD_TYPE:-SECURE}"
if [[ "$CLOUD_TYPE" != "SECURE" && "$CLOUD_TYPE" != "COMMUNITY" ]]; then
  echo "Use SECURE or COMMUNITY, never a long-term Reserved contract" >&2
  exit 2
fi
command=(runpodctl pod create
  --name "spaktok-forge-one-hour-manual"
  --template-id "$RUNPOD_TEMPLATE_ID"
  --gpu-id "$RUNPOD_GPU_ID"
  --gpu-count 1
  --compute-type GPU
  --cloud-type "$CLOUD_TYPE"
  --container-disk-in-gb "$DISK_GB"
  --ports "8000/http,8888/http,22/tcp"
  --min-cuda-version 12.8
)
echo "DRY RUN. One GPU; ON-DEMAND; 60GB ephemeral disk by default."
echo "NO automatic one-hour termination exists for Pod create."
echo "Create only when you can monitor billing and terminate via Pods."
echo "The GPU API on port 8000 must enforce tickets; proxy is public."
printf 'Proposed command (DO NOT execute without a cleanup plan): '
printf '%q ' "${command[@]}"
printf '\n'
echo "Required manual cleanup: Pods > Terminate, confirm removed."
echo "NO GPU launched; NO charge incurred by this script."

if [[ -z "${RUNPOD_GPU_ID:-}" || ! "$RUNPOD_GPU_ID" =~ $GPU_ID_PATTERN ]]; then
  echo "Set RUNPOD_GPU_ID to an exact name from: runpodctl gpu list" >&2
  exit 2
fi
if [[ -z "${RUNPOD_TEMPLATE_ID:-}" || ! "$RUNPOD_TEMPLATE_ID" =~ ^[A-Za-z0-9_-]{3,100}$ ]]; then
  echo "Set RUNPOD_TEMPLATE_ID to a reviewed PyTorch/CUDA12.8 template ID" >&2
  exit 2
fi
DISK_GB="${RUNPOD_CONTAINER_DISK_GB:-60}"
if [[ ! "$DISK_GB" =~ ^[0-9]+$ ]] || (( DISK_GB < 30 || DISK_GB > 100 )); then
  echo "Ephemeral RUNPOD_CONTAINER_DISK_GB must be 30-100" >&2
  exit 2
fi
CLOUD_TYPE="${RUNPOD_CLOUD_TYPE:-SECURE}"
if [[ "$CLOUD_TYPE" != "SECURE" && "$CLOUD_TYPE" != "COMMUNITY" ]]; then
  echo "Use SECURE or COMMUNITY, never a long-term Reserved contract" >&2
  exit 2
fi
command=(runpodctl pod create
  --name "spaktok-forge-one-hour-manual"
  --template-id "$RUNPOD_TEMPLATE_ID"
  --gpu-id "$RUNPOD_GPU_ID"
  --gpu-count 1
  --compute-type GPU
  --cloud-type "$CLOUD_TYPE"
  --container-disk-in-gb "$DISK_GB"
  --ports "8000/http,8888/http,22/tcp"
  --min-cuda-version 12.8
)
echo "DRY RUN. One GPU; ON-DEMAND; 60GB ephemeral disk by default."
echo "NO automatic one-hour termination exists for Pod create."
echo "Create only when you can monitor billing and terminate via Pods."
echo "The GPU API on port 8000 must enforce tickets; proxy is public."
printf 'Proposed command (DO NOT execute without a cleanup plan): '
printf '%q ' "${command[@]}"
printf '\n'
echo "Required manual cleanup: Pods > Terminate, confirm removed."
echo "NO GPU launched; NO charge incurred by this script."
