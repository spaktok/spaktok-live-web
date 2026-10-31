#!/usr/bin/env bash
# One-time enrollment of a renter-owned Vast.ai machine to the Spaktok Worker.
# Does not rent GPUs, install CUDA/model weights, expose ports, or run inference.
set -euo pipefail
umask 077

ROOT="/workspace/spaktok-live-web"
WORKER="https://spaktok-vast-operator.spaktok.workers.dev"

command -v git >/dev/null || { echo "ERROR: install_git_before_pairing" >&2; exit 2; }
command -v python3 >/dev/null || { echo "ERROR: python3_required" >&2; exit 2; }
if [[ -e "$ROOT/.git" ]]; then
  echo "Existing checkout found. Verifying origin and using fast-forward only."
  origin="$(git -C "$ROOT" remote get-url origin)"
  case "$origin" in
    https://github.com/spaktok/spaktok-live-web.git|https://github.com/spaktok/spaktok-live-web) ;;
    *) echo "ERROR: unexpected_repository_origin" >&2; exit 3;;
  esac
  git -C "$ROOT" fetch --depth=1 origin main
  if [[ "$(git -C "$ROOT" branch --show-current)" != "main" ]]; then
    echo "ERROR: expected_main_branch; do_not_overwrite_checkout" >&2;exit 3
  fi
  git -C "$ROOT" merge --ff-only origin/main
elif [[ ! -e "$ROOT" ]];then
  git clone --depth=1 --branch main https://github.com/spaktok/spaktok-live-web.git "$ROOT"
else
  echo "ERROR: checkout_directory_exists_without_git" >&2;exit 3
fi

test -f "$ROOT/services/forge-gpu/vast_operator_agent.py" ||
  { echo "ERROR: missing_vast_operator_agent" >&2;exit 3; }

echo "CPU_ONLY_OPERATOR_CONTRACT_TESTS"
python3 -m unittest discover -s "$ROOT/services/forge-gpu" -p test_vast_operator_agent.py -q
echo "PAIRING_DEVICE_TO_PRIVATE_WORKER"
echo "This performs no GPU inference. The operator must verify and approve device."
python3 "$ROOT/services/forge-gpu/vast_operator_agent.py" enroll --worker "$WORKER"

# Start outbound polling automatically; the agent does not run paid work
# until the operator separately approves a specific D1 compute job.
LOG_DIR="/workspace/.spaktok-vast-agent"
mkdir -p "$LOG_DIR"
chmod 700 "$LOG_DIR"
command -v nohup >/dev/null || { echo "ERROR: nohup_missing" >&2; exit 2; }
nohup python3 -u "$ROOT/services/forge-gpu/vast_operator_agent.py" poll --interval 20 \
  </dev/null >"$LOG_DIR/agent.log" 2>&1 &
pid=$!
(umask 077; echo "$pid" >"$LOG_DIR/agent.pid")
echo "AGENT_POLLING=STARTED"
echo "AGENT_PID=$pid"
echo "SEND_DEVICE_ID_AND_PAIR_CODE_ONLY; NEVER_SEND_DEVICE_TOKEN_OR_CONFIG"
