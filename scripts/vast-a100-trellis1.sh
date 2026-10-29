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
  df -h /workspace | tail -n 1
  log 'No model downloaded or inference performed during preflight.'
}
activate(){
  source "$(conda info --base)/etc/profile.d/conda.sh"
  conda activate trellis
  # Always favor the CUDA 12.1 compiler installed in the isolated env
  # over the Vast host's CUDA 12.9 toolkit (PyTorch is pinned to cu121).
  [[ -x "$CONDA_PREFIX/bin/nvcc" ]] ||
    fail 'CUDA 12.1 compiler absent in trellis env: install its pinned toolkit first.'
  export CUDA_HOME="$CONDA_PREFIX"
  export PATH="$CUDA_HOME/bin:$PATH"
  local compiler_release
  compiler_release="$(nvcc --version | grep 'release ' || true)"
  [[ "$compiler_release" == *"release 12.1,"* ]] ||
    fail 'CUDA compiler not 12.1: do not compile with host nvcc 12.9.'
}
# CUDA Toolkit 12.1 supports GCC up to major version 12. The Vast host
# defaults to a newer GCC, so select version 12 for ALL C++/CUDA extensions.
# Do not downgrade system GCC or bypass nvcc compatibility checks.
select_cuda_host_compiler(){
  local cc12 cxx12 gcc_major gxx_major
  cc12="$(command -v gcc-12 || true)"
  cxx12="$(command -v g++-12 || true)"
  if [[ -z "$cc12" || -z "$cxx12" ]]; then
    if [[ "$(id -u)" != "0" ]] || ! command -v apt-get >/dev/null; then
      fail 'GCC 12 not available; install gcc-12 and g++-12 with your system package manager as root.'
    fi
    log 'Installing only gcc-12 and g++-12 (no PyTorch/CUDA reinstall).'
    DEBIAN_FRONTEND=noninteractive apt-get update -qq
    DEBIAN_FRONTEND=noninteractive apt-get install -y --no-install-recommends gcc-12 g++-12
    cc12="$(command -v gcc-12 || true)"
    cxx12="$(command -v g++-12 || true)"
  fi
  [[ -n "$cc12" && -n "$cxx12" ]] || fail 'gcc-12/g++-12 installation failed.'
  gcc_major="$("$cc12" -dumpversion | cut -d. -f1)"
  gxx_major="$("$cxx12" -dumpversion | cut -d. -f1)"
  [[ "$gcc_major" == 12 && "$gxx_major" == 12 ]] ||
    fail 'Unexpected host compiler version; need GCC 12 for CUDA 12.1.'
  export CC="$cc12"
  export CXX="$cxx12"
  export CUDAHOSTCXX="$cxx12"
  export NVCC_CCBIN="$cxx12"
  log "CUDA host compiler selected: $CC / $CXX; nvcc: $(command -v nvcc)"
}

# Reuse only an authenticated official source checkout; the previous TRELLIS.2
# test already cloned nvdiffrast into /tmp/extensions and upstream setup.sh
# aborts if git clone is repeated. Do not delete that directory.
finish_nvdiffrast(){
  prepare
  activate
  select_cuda_host_compiler
  local src=/tmp/extensions/nvdiffrast
  if [[ ! -e "$src" ]]; then
    log 'Official nvdiffrast source not found. Cloning it only once.'
    mkdir -p /tmp/extensions
    git clone https://github.com/NVlabs/nvdiffrast.git "$src"
  fi
  [[ -f "$src/setup.py" && -d "$src/.git" ]] ||
    fail 'Existing nvdiffrast directory is incomplete; do NOT overwrite it automatically.'
  local remote
  remote="$(git -C "$src" remote get-url origin 2>/dev/null || true)"
  case "$remote" in
    https://github.com/NVlabs/nvdiffrast|https://github.com/NVlabs/nvdiffrast.git) ;;
    *) fail 'nvdiffrast directory remote is not the official NVlabs repository.';;
  esac
  export TORCH_CUDA_ARCH_LIST=8.0
  export MAX_JOBS=2
  export ATTN_BACKEND=xformers
  log 'Building nvdiffrast in isolated TRELLIS environment without re-cloning.'
  python -m pip install -v --no-build-isolation --no-deps "$src"
  log 'Installing only the Forge API server dependencies.'
  python -m pip install 'fastapi>=0.115,<1' 'uvicorn[standard]>=0.30,<1' \
    'python-multipart>=0.0.9,<1'
  export PYTHONPATH="$FORGE:$TRELLIS"
  python "$FORGE/gpu_preflight.py"
  # Imports only: model weights are not downloaded and no inference is run.
  python - <<'PY'
import nvdiffrast.torch
from trellis.pipelines import TrellisImageTo3DPipeline
print("[Spaktok TRELLIS v1] Python imports passed; environment ready for smoke test.")
PY
  repair_python
  log 'Dependencies verified. Next: smoke. Model output is NOT proven yet.'
}
# Upstream installs unpinned, modern Transformers which may disable Torch 2.4
# entirely ("PyTorch >= 2.6 is required"), even though CUDA imports work.
# TRELLIS v1 was built for the 2024 Transformers generation; avoid changing
# the already compiled torch, CUDA, nvdiffrast, kaolin or xformers stack.
repair_python(){
  activate
  log 'Pinning Transformers 4.46.3 for existing torch 2.4.0+cu121 (no CUDA rebuild).'
  python -m pip install 'transformers==4.46.3'
  check_python_stack
  log 'Python model dependency versions verified; next run smoke.'
}
check_python_stack(){
  activate
  python - <<'PY'
import torch, transformers
from transformers.utils import is_torch_available
print('FORGE_STACK', 'torch='+torch.__version__, 'transformers='+transformers.__version__,
      'transformers_torch_enabled='+str(is_torch_available()),
      'cuda='+str(torch.version.cuda))
if not torch.__version__.startswith('2.4.0+cu121') or torch.version.cuda != '12.1':
    raise SystemExit('Unexpected torch/CUDA version; do not rebuild extensions blindly.')
if transformers.__version__ != '4.46.3' or not is_torch_available():
    raise SystemExit('Transformers 4.46.3 required for Torch 2.4; run repair-python first.')
PY
}

# TRELLIS upstream setup.sh uses spconv-cu120 for all CUDA 12.x builds.
# Pin the exact CUDA 12.1 prebuilt wheel instead, with no compiler rebuild.
# Failing early on a conflicting cumm/spconv family is preferable to corrupting
# the working GPU environment by installing overlapping binary distributions.
check_spconv(){
  activate
  python - <<'PY'
import torch
assert torch.__version__.startswith("2.4.0+cu121") and torch.version.cuda == "12.1", "unexpected_torch_cuda_version"
import spconv.pytorch as spconv
from importlib.metadata import version
print("[Spaktok TRELLIS v1] SPCONV_READY:",
      version("spconv-cu121"), "SparseConv3d:", bool(spconv.SparseConv3d),
      "torch:", torch.__version__, flush=True)
PY
}
repair_spconv(){
  activate
  python - <<'PY'
from importlib.metadata import distributions
installed = sorted((d.metadata.get("Name", ""), d.version)
                   for d in distributions()
                   if d.metadata.get("Name", "").lower().replace("_", "-").startswith(("spconv", "cumm")))
print("[Spaktok TRELLIS v1] Existing SpConv/Cumm packages:", installed, flush=True)
conflicts = [n for n, _ in installed
             if n.lower().replace("_", "-").startswith("spconv") and
                n.lower().replace("_", "-") != "spconv-cu121"]
conflicts += [n for n, _ in installed
              if n.lower().replace("_", "-").startswith("cumm") and
                 n.lower().replace("_", "-") != "cumm-cu121"]
if conflicts:
    raise SystemExit("Conflicting spconv/cumm variants detected: " + ", ".join(conflicts)
                     + ". Stop; do not overwrite binary wheels.")
PY
  log 'Installing only Python 3.10 Linux spconv-cu121==2.3.8 CUDA wheel.'
  python -m pip install --only-binary=:all: 'spconv-cu121==2.3.8'
  check_spconv
  log 'SpConv verified. Next: smoke; no model inference performed in repair.'
}

resume(){
  [[ -d "$TRELLIS" ]] || fail 'TRELLIS source missing: run install first.'
  finish_nvdiffrast
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
  # Upstream setup.sh compares exact version "2.4.0" but the official
  # CUDA PyTorch wheel reports "2.4.0+cu121". Normalize that suffix only
  # in the local pinned source checkout, so it selects the correct
  # xformers and kaolin wheels instead of silently skipping both.
  # chr(43) avoids nested quote removal by the upstream python -c "..." shell.
  # First repair a previous interrupted local attempt, then handle pristine upstream.
  sed -i 's/print(torch.__version__.split("+")\[0\])/print(torch.__version__.split(chr(43))[0])/' setup.sh
  sed -i 's/print(torch.__version__)/print(torch.__version__.split(chr(43))[0])/' setup.sh
  # Validate the exact interpolated Python fragment before running installers.
  grep -Fq 'print(torch.__version__.split(chr(43))[0])' setup.sh ||
    fail 'Failed to normalize upstream PyTorch version syntax.'
  source "$(conda info --base)/etc/profile.d/conda.sh"
  if [[ ! -d "$HOME/.config/spaktok" ]]; then
    mkdir -p "$HOME/.config/spaktok"
    chmod 700 "$HOME/.config/spaktok"
  fi
  # The image has host CUDA 12.9. Install CUDA 12.1.1 into the Conda
  # environment, matching torch 2.4.0+cu121; never compile against
  # the newer host toolkit by accident.
  nvcc_line="$(nvcc --version | grep 'release ' || true)"
  [[ "$nvcc_line" == *"release 12."* ]] ||
    fail 'Expected host NVIDIA CUDA toolkit 12.x; inspect host image.'
  if [[ ! -d "$(conda info --base)/envs/trellis" ]] &&
     ! conda env list | awk 'NR>2 {print $1}' | grep -qx trellis; then
    log 'Creating isolated TRELLIS Python 3.10 environment.'
    conda create -y -n trellis python=3.10 pip
  fi
  conda activate trellis
  if [[ ! -x "$CONDA_PREFIX/bin/nvcc" ]]; then
    log 'Installing CUDA toolkit 12.1.1 in the TRELLIS environment (NVIDIA channel).'
    conda install -y -n trellis -c nvidia/label/cuda-12.1.1 cuda-toolkit=12.1.1
  fi
  activate
  log 'Verified matching CUDA compiler; installing upstream pinned PyTorch 2.4.0+cu121.'
  python -m pip install torch==2.4.0 torchvision==0.19.0 \
    --index-url https://download.pytorch.org/whl/cu121
  python - <<'PY'
import torch
assert torch.cuda.is_available(), "cuda_missing"
assert torch.version.cuda == "12.1", "wrong_pytorch_cuda"
print("PRECHECK", torch.__version__, torch.version.cuda)
PY
  # Microsoft's pipeline supports xformers; this avoids rebuilding
  # flash-attn on a rented GPU with fragile PEP517 build isolation.
  # Re-running after a partial failure is possible but not a guarantee.
  export TORCH_CUDA_ARCH_LIST=8.0
  export MAX_JOBS=2
  export ATTN_BACKEND=xformers
  select_cuda_host_compiler
  source ./setup.sh --basic --xformers \
    --diffoctreerast --mipgaussian --kaolin
  repair_spconv
  # Upstream nvdiffrast clone may already exist from previous GPU sessions.
  # Install it separately without deleting /tmp/extensions.
  finish_nvdiffrast
  # finish_nvdiffrast already pins and verifies Transformers 4.46.3.
  log 'Installed. Next run smoke. Model weights and CUDA end-to-end are NOT verified yet.'
}
smoke(){
  prepare
  [[ -d "$TRELLIS" ]] || fail 'Run install first.'
  activate
  check_python_stack
  check_spconv
  export PYTHONPATH="$FORGE:$TRELLIS"
  export SPCONV_ALGO=native
  export ATTN_BACKEND=xformers
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
  check_python_stack
  check_spconv
  origin="$(printenv FORGE_GPU_ALLOWED_ORIGIN || true)"
  [[ "$origin" == https://* ]] || fail 'Set the exact HTTPS FORGE_GPU_ALLOWED_ORIGIN.'
  activate
  export PYTHONPATH="$FORGE:$TRELLIS"
  export SPCONV_ALGO=native
  export ATTN_BACKEND=xformers
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
  (( ${#token} >= 32 )) ||
    fail 'FORGE_GPU_TOKEN must have 32+ characters.'
  export FORGE_GPU_TOKEN="$token"
  cd "$TRELLIS"
  log 'Starting private Forge API on 127.0.0.1:8000; never expose Jupyter as API.'
  exec python -m uvicorn server:app --host 127.0.0.1 --port 8000 --workers 1 --no-access-log
}
case "$ACTION" in
  preflight) prepare;;
  install) install;;
  resume) resume;;
  repair-python) repair_python;;
  repair-spconv) repair_spconv;;
  smoke) smoke;;
  serve) serve;;
  *) fail 'Usage: vast-a100-trellis1.sh {preflight|install|resume|repair-python|repair-spconv|smoke|serve}';;
esac
