#!/usr/bin/env bash
# Spaktok A100 test: official Microsoft TRELLIS.2, one GPU.
# Supervised rental only: this does NOT auto-stop/destroy the Vast instance.
set -Eeuo pipefail
ACTION="${1:-preflight}"
HOME_BASE="${SPAKTOK_WORKDIR:-/workspace/spaktok-trellis2}"
PROJECT="${SPAKTOK_DIR:-/workspace/spaktok-forge}"
TRELLIS="$HOME_BASE/TRELLIS.2"
FORGE="$PROJECT/services/forge-gpu"
TRELLIS_COMMIT=75fbf0183001ed9876c8dbb35de6b68552ee08bd

log(){ printf '[Spaktok A100] %s\n' "$*"; }
fail(){ printf '[Spaktok A100] ERROR: %s\n' "$*" >&2; exit 1; }
mkdir -p "$HOME_BASE"
check(){
  [[ -f "$FORGE/gpu_preflight.py" ]] || fail 'Clone the Spaktok feature branch under /workspace/spaktok-forge first.'
  command -v nvidia-smi >/dev/null || fail 'GPU not visible.'
  nvidia-smi --query-gpu=name,memory.total,memory.free --format=csv,noheader
  command -v nvcc >/dev/null || fail 'CUDA compiler nvcc missing; select CUDA developer environment.'
  command -v git >/dev/null || fail 'git missing.'
  gb="$(df -Pk "$HOME_BASE" | awk 'END{printf "%d",$4/1024/1024}')"
  log "Free disk: ${gb}GB"
  (( gb >= 35 )) || fail 'Need at least 35GB free for source, extensions and weights.'
}
preflight(){
  check
  log 'Checking existing PyTorch/CUDA. An absent torch package is NOT a reason to skip installing TRELLIS.2.'
  if python3 "$FORGE/gpu_preflight.py"; then
    log 'Existing Python CUDA is operational.'
  else
    log 'Existing Python is not configured for CUDA; official setup creates isolated conda trellis2 with its own torch.'
  fi
  activate
  log 'Conda is available. Hardware checks passed; setup is NOT yet installed.'
}
activate(){
  command -v conda >/dev/null || fail 'Conda missing. Official TRELLIS.2 install requires Conda.'
  base="$(conda info --base)"
  [[ -f "$base/etc/profile.d/conda.sh" ]] || fail 'conda.sh missing.'
  # shellcheck disable=SC1090
  source "$base/etc/profile.d/conda.sh"
}
prepare_source(){
  check
  activate
  if [[ ! -d "$TRELLIS/.git" ]];then
    log 'Clone official Microsoft TRELLIS.2 with submodules.'
    git clone --recursive https://github.com/microsoft/TRELLIS.2.git "$TRELLIS"
  fi
  cd "$TRELLIS"
  git checkout --detach "$TRELLIS_COMMIT"
  git submodule update --init --recursive
  [[ "${SPAKTOK_ACCEPT_UPSTREAM_SETUP:-}" == yes ]] || fail 'Review upstream setup.sh and set SPAKTOK_ACCEPT_UPSTREAM_SETUP=yes.'
}
ensure_torch(){
  conda activate trellis2
  python - <<'PY'
import torch
print("TRELLIS conda PyTorch:", torch.__version__, "CUDA:", torch.version.cuda)
assert torch.cuda.is_available(), "TRELLIS conda CUDA unavailable"
PY
}
repair_flash(){
  prepare_source
  ensure_torch
  log 'Install flash-attn in the existing trellis2 conda environment WITHOUT PEP517 build isolation.'
  log 'This can build CUDA extensions for several minutes: supervise billing.'
  python -m pip install --no-build-isolation 'flash-attn==2.7.3'
}
resume(){
  repair_flash
  log 'Continue remaining official TRELLIS.2 CUDA extensions (NO --new-env; preserves existing torch).'
  cd "$TRELLIS"
  set +u
  # shellcheck disable=SC1091
  source ./setup.sh --nvdiffrast --nvdiffrec --cumesh --o-voxel --flexgemm
  set -u
  conda activate trellis2
  python3 "$FORGE/gpu_preflight.py" || fail 'CUDA verification failed in trellis2 conda environment.'
  python -m pip install 'fastapi>=0.115,<1' 'uvicorn>=0.30,<1' 'python-multipart>=0.0.9,<1'
  log 'Dependencies ready. Model weights and GPU inference are still unverified.'
}
install(){
  prepare_source
  if conda env list --json | python3 -c 'import json,sys;print(any(p.endswith("/trellis2") for p in json.load(sys.stdin)["envs"]))' | grep -qx True;then
    log 'Reusing previously created trellis2 conda environment.'
  else
    log 'Creating the official isolated conda environment; no flash-attn until torch is installed.'
    cd "$TRELLIS"
    set +u
    # shellcheck disable=SC1091
    source ./setup.sh --new-env --basic
    set -u
  fi
  resume
}
serve(){
  activate
  conda activate trellis2
  [[ -d "$TRELLIS" ]] || fail 'Run install first.'
  [[ -f "$FORGE/trellis2_engine.py" ]] || fail 'Spaktok TRELLIS.2 engine missing.'
  [[ "${FORGE_GPU_ALLOWED_ORIGIN:-}" == https://* ]] || fail 'Set exact HTTPS FORGE_GPU_ALLOWED_ORIGIN.'
  mkdir -p "$HOME/.config/spaktok";chmod 700 "$HOME/.config/spaktok"
  token_file="$HOME/.config/spaktok/forge-gpu-token"
  if [[ ! -s "$token_file" ]];then
    (umask 077;python -c 'import secrets;print(secrets.token_hex(40))' > "$token_file")
  fi
  chmod 600 "$token_file"
  export FORGE_GPU_TOKEN="$(cat "$token_file")"
  export FORGE_GPU_ENGINE=trellis2
  export PYTHONPATH="$FORGE:$TRELLIS${PYTHONPATH:+:$PYTHONPATH}"
  cd "$TRELLIS"
  log 'Starting Forge API on localhost:8000. Use a SEPARATE TLS tunnel; never the Jupyter portal tunnel.'
  exec python -m uvicorn server:app --host 127.0.0.1 --port 8000 --workers 1 --no-access-log
}
smoke(){
  activate; conda activate trellis2
  [[ -d "$TRELLIS" ]] || fail 'Run install first.'
  export PYTHONPATH="$FORGE:$TRELLIS${PYTHONPATH:+:$PYTHONPATH}"
  cd "$TRELLIS"
  python - <<'PY'
from pathlib import Path
from PIL import Image
from trellis2_engine import initialize, generate_glb
image=Path("assets/example_image/T.png")
if not image.exists(): raise SystemExit("Official sample image missing")
initialize()
import os
profile=os.environ.get("SPAKTOK_OUTPUT_PROFILE","preview")
payload=generate_glb(Image.open(image).convert("RGBA"),profile)
out=Path("/workspace/spaktok-trellis2-"+profile+".glb")
out.write_bytes(payload)
print("CREATED",out,"bytes",len(payload))
PY
  python "$FORGE/glb_quality.py" "/workspace/spaktok-trellis2-${SPAKTOK_OUTPUT_PROFILE:-preview}.glb"
}
case "$ACTION" in
 preflight) preflight;;
 install) install;;
 repair-flash) repair_flash;;
 resume) resume;;
 serve) serve;;
 smoke) smoke;;
 *) fail 'Usage: vast-a100-trellis2.sh {preflight|install|repair-flash|resume|smoke|serve}';;
esac
