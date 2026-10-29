#!/usr/bin/env bash
# Safe, opt-in RunPod GPU trial launcher. DRY-RUN by default.
# Does not download or start Stable Fast 3D or read secrets.
# The provider's --terminate-after=1h is the primary billing safeguard.
# You MUST verify the Pod is terminated on the RunPod dashboard.
set -euo pipefail

MODE="${1:---dry-run}"
if [[ "$MODE" != "--dry-run" && "$MODE" != "--apply" ]] || (( $# > 1 )); then
  echo "Usage: RUNPOD_GPU_ID='exact GPU name' RUNPOD_TEMPLATE_ID='reviewed ID' $0 [--dry-run|--apply]" >&2
  exit 2
fi
if [[ -z "${RUNPOD_GPU_ID:-}" || ! "$RUNPOD_GPU_ID" =~ ^[A-Za-z0-9 _.,+-]{5,100}$ ]]; then
  echo "Set RUNPOD_GPU_ID to an exact name from: runpodctl gpu list" >&2
  exit 2
fi
if [[ -z "${RUNPOD_TEMPLATE_ID:-}" || ! "$RUNPOD_TEMPLATE_ID" =~ ^[A-Za-z0-9_-]{3,100}$ ]]; then
  echo "Set RUNPOD_TEMPLATE_ID to a template you verified via runpodctl template search" >&2
  exit 2
fi
GPU_COUNT=1
DISK_GB="${RUNPOD_CONTAINER_DISK_GB:-60}"
if [[ ! "$DISK_GB" =~ ^[0-9]+$ ]] || (( DISK_GB < 30 || DISK_GB > 100 )); then
  echo "Ephemeral RUNPOD_CONTAINER_DISK_GB must be 30-100" >&2
  exit 2
fi
CLOUD_TYPE="${RUNPOD_CLOUD_TYPE:-SECURE}"
if [[ "$CLOUD_TYPE" != "SECURE" && "$CLOUD_TYPE" != "COMMUNITY" ]]; then
  echo "Use SECURE or COMMUNITY cloud, not reserved capacity" >&2
  exit 2
fi
command=(runpodctl pod create
  --name "spaktok-forge-one-hour"
  --template-id "$RUNPOD_TEMPLATE_ID"
  --gpu-id "$RUNPOD_GPU_ID"
  --gpu-count "$GPU_COUNT"
  --compute-type GPU
  --cloud-type "$CLOUD_TYPE"
  --container-disk-in-gb "$DISK_GB"
  --ports "8000/http,8888/http,22/tcp"
  --min-cuda-version 12.8
  --terminate-after 1h
)
echo "TRIAL: one GPU, on-demand, 60 minutes, ephemeral disk, no persistent volume."
echo "RunPod HTTPS proxy access: port 8000/http (GPU API), 8888/http (notebook)."
echo "Host CUDA requirement: >=12.8 for Blackwell; template must ALSO ship matching PyTorch cu128 with sm_120."
echo "IMPORTANT: provider may bill startup, disk, network or model downloads."
echo "Auto-terminate MUST be confirmed in provider UI. Save outputs before deletion."
echo "WARNING: exposed port 8000 is internet-addressable; never run an unauthenticated GPU service."
printf 'Command: '
printf '%q ' "${command[@]}"
printf '\n'
if [[ "$MODE" == "--dry-run" ]]; then
  echo "DRY RUN ONLY: no GPU launched, no charge incurred by this script."
  exit 0
fi
if ! command -v runpodctl >/dev/null 2>&1; then
  echo "runpodctl is not installed: use the official CLI, not a shell token workaround." >&2
  exit 2
fi
if [[ ! -t 0 ]]; then
  echo "Interactive confirmation required; refusing unattended GPU billing." >&2
  exit 2
fi
read -r -p "Type START_ONE_HOUR_TRIAL to launch a PAID GPU Pod: " confirmation
if [[ "$confirmation" != "START_ONE_HOUR_TRIAL" ]]; then
  echo "Cancelled: no GPU created."
  exit 1
fi
"${command[@]}"
echo "Verify auto-terminate and provider billing immediately in Pods."
