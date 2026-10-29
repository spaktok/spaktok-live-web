#!/usr/bin/env bash
# Runs on an ALREADY RENTED Vast.ai instance, with official TRELLIS.2 installed.
# Does not create, resize, start, stop or terminate rented instances.
set -euo pipefail
umask 077

if [[ "${SPAKTOK_FORGE_OPERATOR_APPROVED:-}" != "yes" ]]; then
  echo >&2 "operator_approval_required (SPAKTOK_FORGE_OPERATOR_APPROVED=yes)"
  exit 2
fi
if [[ "${#FORGE_GPU_TOKEN:-0}" -lt 32 ]]; then
  echo >&2 "FORGE_GPU_TOKEN must be >=32 characters (secret never printed)"
  exit 2
fi
if [[ ! "${FORGE_GPU_ALLOWED_ORIGIN:-}" =~ ^https:// ]]; then
  echo >&2 "FORGE_GPU_ALLOWED_ORIGIN must be the exact HTTPS creator origin"
  exit 2
fi
if [[ -z "${TRELLIS2_REPO_DIR:-}" || ! -d "${TRELLIS2_REPO_DIR}/trellis2" ]]; then
  echo >&2 "TRELLIS2_REPO_DIR must point to the installed official TRELLIS.2 checkout"
  exit 2
fi

HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
export PYTHONPATH="${HERE}:${TRELLIS2_REPO_DIR}:${PYTHONPATH:-}"
export FORGE_GPU_ENGINE=trellis2

# Fail closed before downloading multi-gigabyte weights.
python "${HERE}/gpu_preflight.py"
python -m unittest discover -s "${HERE}" -p 'test_trellis2_engine.py' -q
# Listen locally; Cloudflare Tunnel maps a TLS hostname to localhost:8000.
# User-provided prompts and images are not passed to a general shell executor.
cd "${HERE}"
exec python -m uvicorn server:app --host 127.0.0.1 --port 8000 --workers 1 --no-access-log
