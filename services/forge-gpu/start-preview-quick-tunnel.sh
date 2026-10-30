#!/usr/bin/env bash
# One-shot operator-only GPU E2E preview on an EXISTING Vast machine.
# Explicit --run is required. NOT a production public endpoint.
# Never checks secrets into git or sends them to ChatGPT.
set -euo pipefail
umask 077
if [[ "${1:-}" == --preflight ]]; then
  echo "SPAKTOK_PREVIEW_PREFLIGHT — NO GPU INFERENCE"
  echo "INSTANCE: Vast rental may continue billing even without inference"
  if [[ "${CONDA_PREFIX:-}" == /workspace/trellis2-env ]];then echo "CONDA=OK";else echo "CONDA=MISSING";fi
  if [[ -f /workspace/TRELLIS.2/trellis2/pipelines/trellis2_image_to_3d.py ]];then echo "TRELLIS2_SOURCE=OK";else echo "TRELLIS2_SOURCE=MISSING";fi
  if [[ -n "${HF_HOME:-}" && -d "${HF_HOME}" ]];then echo "HF_HOME=OK";else echo "HF_HOME=MISSING";fi
  if [[ "${FORGE_GPU_ALLOWED_ORIGIN:-}" =~ ^https://[a-zA-Z0-9.-]+\.vercel\.app$ ]];then
    echo "BROWSER_ORIGIN=VALID_PREVIEW_FORMAT"
  else echo "BROWSER_ORIGIN=MISSING_OR_INVALID";fi
  if command -v cloudflared >/dev/null 2>&1;then
    echo "CLOUDFLARED=OK"
  else
    echo "CLOUDFLARED=MISSING"
    echo "Install only the official Cloudflare client: https://developers.cloudflare.com/tunnel/downloads/"
  fi
  if command -v curl >/dev/null 2>&1;then echo "CURL=OK";else echo "CURL=MISSING";fi
  if [[ -f /workspace/spaktok-first.glb ]];then echo "PRIOR_SUCCESSFUL_GLB=PRESENT";else echo "PRIOR_SUCCESSFUL_GLB=NOT_ON_INSTANCE";fi
  if command -v nvidia-smi >/dev/null 2>&1;then
    nvidia-smi --query-gpu=name,memory.total --format=csv,noheader 2>/dev/null ||
     echo "GPU_INFO=NOT_AVAILABLE"
  else echo "NVIDIA_SMI=NOT_AVAILABLE";fi
  echo "NO_TOKENS_PRINTED; NO_MODEL_LOADED; NO_FILES_UPLOADED"
  exit 0
fi
if [[ "${1:-}" != --run ]]; then
  echo "DRY_RUN_ONLY; use --run explicitly for rented GPU inference service"
  exit 0
fi
if [[ "${CONDA_PREFIX:-}" != /workspace/trellis2-env ]]; then
  echo >&2 "activate /workspace/trellis2-env first";exit 2
fi
if [[ ! "${FORGE_GPU_ALLOWED_ORIGIN:-}" =~ ^https://[a-zA-Z0-9.-]+\.vercel\.app$ ]]; then
  echo >&2 "set FORGE_GPU_ALLOWED_ORIGIN to exact Vercel preview origin"; exit 2
fi
if [[ -z "${HF_HOME:-}" || ! -d "${HF_HOME}" ]]; then
  echo >&2 "set HF_HOME to the existing /workspace/hf-cache";exit 2
fi
if ! command -v cloudflared >/dev/null 2>&1; then
  echo >&2 "cloudflared not installed; install official Cloudflare binary before starting GPU"
  exit 2
fi
if ! command -v curl >/dev/null 2>&1; then
  echo >&2 "curl is required for the local-only readiness preflight"
  exit 2
fi
if curl -fsS --max-time 2 http://127.0.0.1:8000/health >/dev/null 2>&1; then
  echo >&2 "port_8000_in_use; do not risk connecting to unrelated process"
  exit 2
fi
if [[ -z "${FORGE_GPU_TOKEN:-}" ]]; then
  export FORGE_GPU_TOKEN="$(python -c 'import secrets;print(secrets.token_urlsafe(48))')"
fi
if [[ "${#FORGE_GPU_TOKEN}" -lt 32 ]]; then
  echo >&2 "FORGE_GPU_TOKEN too short";exit 2
fi
export SPAKTOK_FORGE_OPERATOR_APPROVED=yes
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TOKEN_FILE=/workspace/spaktok-preview-gpu-token.txt
LOG_FILE=/workspace/spaktok-preview-gpu-service.log
printf '%s' "${FORGE_GPU_TOKEN}" > "${TOKEN_FILE}"
chmod 600 "${TOKEN_FILE}"
: > "${LOG_FILE}"
chmod 600 "${LOG_FILE}"
server_pid=''
cleanup(){
  if [[ -n "${server_pid}" ]]; then
    kill "${server_pid}" 2>/dev/null || true
    wait "${server_pid}" 2>/dev/null || true
  fi
  rm -f "${TOKEN_FILE}"
  echo "Preview tunnel/service stopped. Vast rental must still be stopped manually."
}
trap cleanup EXIT
bash "${HERE}/start-vast-trellis2.sh" >"${LOG_FILE}" 2>&1 &
server_pid=$!
echo "Loading TRELLIS.2 once; follow safe stage logs: tail -f ${LOG_FILE}"
found=0
for _ in $(seq 1 420);do
  if ! kill -0 "${server_pid}" 2>/dev/null;then
    echo >&2 "GPU service terminated; inspect ${LOG_FILE}";exit 3
  fi
  if curl -fsS --max-time 3 http://127.0.0.1:8000/health |
    grep -q '"ready":true';then
      found=1;break
  fi
  sleep 2
done
if [[ "${found}" != 1 ]];then
  echo >&2 "GPU readiness timeout; inspect log without restarting GPU";exit 3
fi
echo "GPU_READY; operator token saved privately at ${TOKEN_FILE}"
echo "COPY THE TOKEN DIRECTLY INTO VERCEL PREVIEW SECRET SETTINGS; NEVER POST IT IN CHAT."
echo "SPAKTOK_FORGE_GPU_QUICK_TUNNEL_EXPIRES_AT=$(($(date -u +%s)+3300))"
echo "EXACT_ORIGIN=${FORGE_GPU_ALLOWED_ORIGIN}"
echo "Starting Cloudflare temporary HTTPS tunnel for <=55min"
echo "Copy the generated random hostname into Vercel Preview (never production)."
# Cloudflare prints its ephemeral URL to stderr/terminal.
# The one-process server is only reachable via localhost ingress.
timeout --signal=INT 3300s cloudflared tunnel --url http://127.0.0.1:8000
