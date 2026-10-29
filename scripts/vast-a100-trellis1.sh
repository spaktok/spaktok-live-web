#!/usr/bin/env bash
# Spaktok owner-operated GPU: official Microsoft TRELLIS (DINOv2).
# NO Vast API calls and NO auto-rental, auto-start or auto-destroy.
# Commands: preflight | install | smoke | serve. Manual supervision only.
set -Eeuo pipefail
ACTION=preflight
if [[ $# -gt 0 ]]; then ACTION="$1"; fi
PROJECT=/workspace/spaktok-forge
WORKDIR=/workspace/spaktok-trellis1
TRELLIS="$WORKDIR/TRELLIS"
FORGE="$PROJECT/services/forge-gpu"
# Pinned official upstream checkout (2026-10-27); not an unreviewed HEAD.
TRELLIS_COMMIT=193e0502b5cb3eb5997ec457d5340e95d09b158e

log(){ printf '[Spaktok TRELLIS v1] %s\n' "$*"; }
fail(){ printf '[Spaktok TRELLIS v1] ERROR: %s\n' "$*" >&2; exit 1; }

prepare(){
  [[ -f "$FORGE/trellis1_engine.py" && -f "$FORGE/glb_quality.py" ]] ||
    fail 'Clone the Spaktok feature branch to /workspace/spaktok-forge first.'
  command -v nvidia-smi >/dev/null || fail 'NVIDIA GPU not visible.'
  command -v conda >/dev/null || fail 'Conda is required by the official setup.'
  command -v git >/dev/null || fail 'Git is required.'
  command -v nvcc >/dev/null || fail 'CUDA toolkit/nvcc is required to compile submodules.'
  nvidia-smi --query-gpu=name,memory.total --format=csv,noheader
  nvcc --version | tail -n 4
  log 'No model downloaded or inference performed during preflight.'
}
activate(){
  source "$(conda info --base)/etc/profile.d/conda.sh"
  conda activate trellis
}
install(){
  prepare
  mkdir -p "$WORKDIR"
  if [[ ! -d "$TRELLIS/.git" ]]; then
    log 'Cloning official TRELLIS at a fixed revision.'
    git clone --recursive https://github.com/microsoft/TRELLIS.git "$TRELLIS"
  fi
  cd "$TRELLIS"
  git cat-file -e "$TRELLIS_COMMIT^{commit}" || fail 'Pinned official TRELLIS source unavailable.'
  git checkout --detach "$TRELLIS_COMMIT"
  git submodule update --init --recursive
  source "$(conda info --base)/etc/profile.d/conda.sh"
  if conda env list | awk 'NR>2 {print $1}' | grep -qx trellis; then
    log 'Existing trellis environment: no blind reinstall; diagnose and run smoke first.'
    return
  fi
  # The previous Vast A100 image had nvcc 12.4. Avoid the official
  # --new-env default (cu118) which would mismatch CUDA major during builds.
  # Use cu121 torch2.4.0 so nvcc12.4 is a MINOR mismatch, and the upstream
  # setup.sh knows compatible xformers/kaolin wheels for torch2.4.0+cu121.
  nvcc_line="$(nvcc --version | grep 'release ' || true)"
  [[ "$nvcc_line" == *"release 12."* ]] ||
    fail 'This scripted build expects CUDA toolkit nvcc 12.x; use a reviewed separate setup for 11.x.'
  log 'Creating isolated PyTorch 2.4.0+cu121 Conda environment; monitor paid GPU time.'
  conda create -y -n trellis python=3.10 pip
  conda activate trellis
  python -m pip install torch==2.4.0 torchvision==0.19.0 \
    --index-url https://download.pytorch.org/whl/cu121
  python - <<'PY'
import torch
assert torch.cuda.is_available(), "cuda_missing"
assert torch.version.cuda == "12.1", "wrong_pytorch_cuda"
print("PRECHECK", torch.__version__, torch.version.cuda)
PY
  # Install only the supported official components, never upgrade torch
  # without validating extension ABI and matching GPU architecture.
  source ./setup.sh --basic --xformers --flash-attn \
    --diffoctreerast --spconv --mipgaussian --kaolin --nvdiffrast
  conda activate trellis
  python -m pip install 'fastapi>=0.115,<1' 'uvicorn[standard]>=0.30,<1' \
    'python-multipart>=0.0.9,<1'
  python "$FORGE/gpu_preflight.py"
  log 'Installed. Next run smoke. Model weights and CUDA end-to-end are NOT verified yet.'
}
smoke(){
  prepare
  [[ -d "$TRELLIS" ]] || fail 'Run install first.'
  activate
  export PYTHONPATH="$FORGE:$TRELLIS"
  export SPCONV_ALGO=native
  cd "$TRELLIS"
  # Public Microsoft sample, not a private user's photo.
  python - <<'PY'
from pathlib import Path
from PIL import Image
from trellis1_engine import initialize, generate_glb
source=Path('assets/example_image/T.png')
if not source.is_file():
    raise SystemExit('official_sample_not_found')
initialize()
payload=generate_glb(Image.open(source).convert('RGBA'))
output=Path('/workspace/spaktok-trellis1-preview.glb')
output.write_bytes(payload)
print('CREATED', str(output), 'bytes', len(payload))
PY
  python "$FORGE/glb_quality.py" /workspace/spaktok-trellis1-preview.glb
  log 'Review appearance and real Android performance before public release.'
}
serve(){
  prepare
  [[ -d "$TRELLIS" ]] || fail 'Run install first.'
  origin="$(printenv FORGE_GPU_ALLOWED_ORIGIN || true)"
  [[ "$origin" == https://* ]] || fail 'Set the exact HTTPS FORGE_GPU_ALLOWED_ORIGIN.'
  activate
  export PYTHONPATH="$FORGE:$TRELLIS"
  export SPCONV_ALGO=native
  export FORGE_GPU_ENGINE=trellis1
  token="$(printenv FORGE_GPU_TOKEN || true)"
  if [[ -z "$token" ]]; then
    token_file="$HOME/.config/spaktok/forge-gpu-token"
    mkdir -p "$(dirname "$token_file")"
    chmod 700 "$(dirname "$token_file")"
    if [[ ! -s "$token_file" ]]; then
      (umask 077; python -c 'import secrets;print(secrets.token_hex(40))' > "$token_file")
    fi
    chmod 600 "$token_file"
    token="$(cat "$token_file")"
  fi
  [[ "$token" == ????????????????????????????????* ]] ||
    fail 'FORGE_GPU_TOKEN must have 32+ characters.'
  export FORGE_GPU_TOKEN="$token"
  cd "$TRELLIS"
  log 'Starting private Forge API on 127.0.0.1:8000; never expose Jupyter as API.'
  exec python -m uvicorn server:app --host 127.0.0.1 --port 8000 --workers 1 --no-access-log
}
case "$ACTION" in
  preflight) prepare;;
  install) install;;
  smoke) smoke;;
  serve) serve;;
  *) fail 'Usage: vast-a100-trellis1.sh {preflight|install|smoke|serve}';;
esac
