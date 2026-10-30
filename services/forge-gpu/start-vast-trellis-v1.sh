#!/usr/bin/env bash
# Start ORIGINAL Microsoft TRELLIS on the renter's EXISTING Vast.ai A100.
# Never rent GPU, run arbitrary shell commands from users, or expose raw ports.
set -euo pipefail
umask 077

if [[ "${SPAKTOK_FORGE_OPERATOR_APPROVED:-}" != "yes" ]]; then
  echo >&2 "operator_approval_required"; exit 2
fi
secret="${FORGE_GPU_TOKEN:-}"
if [[ "${#secret}" -lt 32 ]]; then
  echo >&2 "gpu_secret_missing_or_short"; exit 2
fi
origin="${FORGE_GPU_ALLOWED_ORIGIN:-}"
if [[ ! "${origin}" =~ ^https://[^/]+$ ]]; then
  echo >&2 "gpu_exact_https_origin_required"; exit 2
fi
repo="${TRELLIS_V1_REPO_DIR:-}"
if [[ -z "${repo}" || ! -f "${repo}/trellis/pipelines/trellis_image_to_3d.py" ]]; then
  echo >&2 "original_trellis_checkout_required"; exit 2
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PYTHONPATH="${HERE}:${repo}:${PYTHONPATH:-}"
export FORGE_GPU_ENGINE=trellis-v1
export SPCONV_ALGO=native
python "${HERE}/gpu_preflight.py"
python -m unittest discover -s "${HERE}" -p 'test_trellis_v1_engine.py' -q
cd "${HERE}"
exec python -m uvicorn server:app --host 127.0.0.1 --port 8000 --workers 1 --no-access-log
