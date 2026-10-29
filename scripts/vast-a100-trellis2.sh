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
  log 'Install flash-attn build prerequisites into the active trellis2 environment.'
  python -m pip install 'psutil>=5.9,<8' 'packaging>=23,<27' 'ninja>=1.11,<2' 'wheel>=0.42,<1' 'setuptools>=69,<82'
  python - <<'PY'
import torch, psutil, packaging, ninja
print("TRELLIS flash-attn prerequisites available; torch:", torch.__version__)
PY
  log 'Build flash-attn WITHOUT PEP517 isolation; can run several minutes on paid GPU.'
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
locate_cusparse_header(){
  # Prefer the CUDA headers provided with the active PyTorch build (cu124),
  # then compatible Conda/system CUDA toolkit layouts.
  local root candidate
  local -a roots=(
    "$CONDA_PREFIX/lib/python3.10/site-packages/nvidia/cusparse/include"
    "$CONDA_PREFIX/targets/x86_64-linux/include"
    "$CONDA_PREFIX/include"
    "/usr/local/cuda-12.4/targets/x86_64-linux/include"
    "/usr/local/cuda-12.4/include"
    "/usr/local/cuda/targets/x86_64-linux/include"
    "/usr/local/cuda/include"
    "/usr/local/cuda-12.9/targets/x86_64-linux/include"
    "/usr/local/cuda-12.9/include"
  )
  for root in "${roots[@]}"; do
    if [[ -f "$root/cusparse.h" ]];then
      printf '%s\n' "$root"
      return 0
    fi
  done
  candidate="$(find "$CONDA_PREFIX" /usr/local/cuda-12.9 /usr/local/cuda-12.4 \
    -type f -name cusparse.h -print -quit 2>/dev/null || true)"
  if [[ -n "$candidate" ]];then
    dirname "$candidate"
    return 0
  fi
  return 1
}
ensure_cusparse_dev_headers(){
  local header_dir
  header_dir="$(locate_cusparse_header)" || true
  if [[ -z "$header_dir" ]];then
    log 'cuSPARSE headers missing from the active environment. Installing matching 12.4 development headers only.'
    # PyTorch in this environment is built with cu124.
    conda install -y -n trellis2 -c nvidia/label/cuda-12.4.1 libcusparse-dev || fail 'Could not install CUDA 12.4 cuSPARSE development headers.'
    header_dir="$(locate_cusparse_header)" || fail 'cusparse.h still not found after installing libcusparse-dev.'
  fi
  log "Using cuSPARSE headers from: $header_dir"
  export CPATH="$header_dir${CPATH:+:$CPATH}"
  export CPLUS_INCLUDE_PATH="$header_dir${CPLUS_INCLUDE_PATH:+:$CPLUS_INCLUDE_PATH}"
  [[ -f "$header_dir/cusparse.h" ]] || fail 'cuSPARSE header path unexpectedly missing.'
}
diagnose_nvdiffrast(){
  activate
  conda activate trellis2
  log 'Focused nvdiffrast build diagnostic: does not reinstall whole TRELLIS.2.'
  [[ -f /tmp/extensions/nvdiffrast/setup.py ]] || fail 'nvdiffrast checkout missing; inspect prior official installation first.'
  python - <<'PY'
import torch
print("torch:",torch.__version__,"cuda:",torch.version.cuda)
print("GPU:",torch.cuda.get_device_name(0),"capability:",torch.cuda.get_device_capability(0))
PY
  nvcc --version | tail -n 4
  gcc --version | head -n 1
  export MAX_JOBS="${MAX_JOBS:-2}"
  export TORCH_CUDA_ARCH_LIST=8.0
  ensure_cusparse_dev_headers
  log 'Saving full verbose compiler output to /workspace/nvdiffrast-build.log'
  set +e
  python -m pip install -v --no-build-isolation /tmp/extensions/nvdiffrast > /workspace/nvdiffrast-build.log 2>&1
  status=$?
  set -e
  if (( status != 0 ));then
    log "nvdiffrast build failed (exit $status); showing last compiler errors"
    grep -n -i -E 'FAILED:|fatal error:|error:|nvcc fatal|unsupported GNU|killed|undefined reference|not found|No such file' /workspace/nvdiffrast-build.log | tail -n 40 || true
    log 'For full context, use: tail -n 80 /workspace/nvdiffrast-build.log'
    return "$status"
  fi
  log 'nvdiffrast successfully installed. Other TRELLIS.2 extensions still need verification.'
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
 diagnose-nvdiffrast) diagnose_nvdiffrast;;
 install) install;;
 repair-flash) repair_flash;;
 resume) resume;;
 serve) serve;;
 smoke) smoke;;
 *) fail 'Usage: vast-a100-trellis2.sh {preflight|diagnose-nvdiffrast|install|repair-flash|resume|smoke|serve}';;
esac
