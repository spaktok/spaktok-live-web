#!/usr/bin/env bash
# Existing Vast.ai A100 80GB only; does not provision compute or fetch source.
# Start only after owner explicitly authorizes this private trial.
set -euo pipefail
umask 077
if [[ "${SPAKTOK_FORGE_OPERATOR_APPROVED:-}" != yes ]]; then
  echo >&2 "operator_approval_required"; exit 2
fi
secret="${FORGE_GPU_TOKEN:-}"
if [[ "${#secret}" -lt 32 ]]; then
  echo >&2 "FORGE_GPU_TOKEN_must_be_at_least_32_characters"; exit 2
fi
if [[ ! "${FORGE_GPU_ALLOWED_ORIGIN:-}" =~ ^https://[a-zA-Z0-9.-]+$ ]]; then
  echo >&2 "FORGE_GPU_ALLOWED_ORIGIN_must_be_exact_https_origin"; exit 2
fi
if [[ -z "${HF_HOME:-}" || ! -d "${HF_HOME}" ]]; then
  echo >&2 "HF_HOME_not_configured_or_missing"; exit 2
fi
if [[ "${CONDA_PREFIX:-}" != "/workspace/trellis2-env" ]]; then
  echo >&2 "activate_existing_trellis2-env_first"; exit 2
fi
if [[ ! -f /workspace/TRELLIS.2/trellis2/pipelines/trellis2_image_to_3d.py ]]; then
  echo >&2 "TRELLIS2_checkout_missing"; exit 2
fi
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export FORGE_GPU_ENGINE=trellis2
export PYTHONPATH="${HERE}:/workspace/TRELLIS.2:${PYTHONPATH:-}"
export CUDA_HOME="${CONDA_PREFIX}"
export PATH="${CUDA_HOME}/bin:${PATH}"
export PYTORCH_CUDA_ALLOC_CONF=expandable_segments:True
export TORCH_CUDA_ARCH_LIST=8.0
export MAX_JOBS=4
python "${HERE}/gpu_preflight.py"
python -m unittest discover -s "${HERE}" -p 'test_gpu_ticket.py' -q
python -m unittest discover -s "${HERE}" -p 'test_trellis2_engine.py' -q
python -c "import flash_attn,nvdiffrec_render,o_voxel; from trellis2.pipelines import Trellis2ImageTo3DPipeline; print('SPAKTOK_TRELLIS2_IMPORT_OK')"
cd "${HERE}"
# localhost only. Cloudflare named Tunnel must route localhost:8000;
# never expose a raw Vast.ai port or use an untrusted quick-tunnel link.
exec python -m uvicorn server:app --host 127.0.0.1 --port 8000 --workers 1 --no-access-log
