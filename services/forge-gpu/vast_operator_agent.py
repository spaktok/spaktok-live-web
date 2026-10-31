#!/usr/bin/env python3
"""Spaktok Vast.ai GPU agent: outbound-only, explicit operator-approved jobs.

Run ON the renter's Vast instance. No SSH server, shell interpolation, command
execution supplied by users, GPU provisioning, implicit inference or retries.
The operator queues allowlisted jobs in Cloudflare D1, and private GLBs are
transferred via R2 through a Cloudflare Worker over HTTPS.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import re
import secrets
import subprocess
import sys
import tempfile
import time
from urllib import error, parse, request

HERE = Path(__file__).resolve().parent
MAX_INPUT = 35 * 1024 * 1024
MAX_IMAGE = 8 * 1024 * 1024
MAX_GLB = 35 * 1024 * 1024
ACTIONS = frozenset({"gpu_info", "preflight", "diagnose_dinov3",
                     "inspect_glb", "finalize_glb", "generate_one"})
HEX64 = re.compile(r"^[a-f0-9]{64}$")
JOB_ID = re.compile(r"^[a-f0-9-]{36}$")
STATE_DIR = Path(os.environ.get("SPAKTOK_VAST_AGENT_STATE",
                                "/workspace/.spaktok-vast-agent"))
CONFIG = STATE_DIR / "device.json"


class OperatorError(Exception):
    pass


class NoRedirect(request.HTTPRedirectHandler):
    def redirect_request(self, req, fp, code, msg, headers, newurl):
        raise OperatorError("unexpected_remote_redirect")


def operator_url(raw: str) -> str:
    parsed = parse.urlsplit(raw)
    host = parsed.hostname or ""
    if (parsed.scheme != "https" or parsed.username or parsed.password
            or parsed.port not in (None, 443) or parsed.path not in ("", "/")
            or parsed.query or parsed.fragment
            or not re.fullmatch(r"[a-z0-9.-]{5,253}", host)
            or not (host.endswith(".workers.dev")
                    or host.endswith(".spaktok.com"))):
        raise OperatorError("operator_must_use_https_cloudflare_worker")
    return "https://" + host


def save_private_config(data: dict) -> None:
    STATE_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    os.chmod(STATE_DIR, 0o700)
    fd = os.open(str(CONFIG), os.O_CREAT | os.O_EXCL | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as out:
        json.dump(data, out)
        out.write("\n")


def read_config() -> dict:
    if not CONFIG.is_file():
        raise OperatorError("device_not_enrolled")
    if CONFIG.stat().st_mode & 0o077:
        raise OperatorError("device_config_permissions_unsafe")
    data = json.loads(CONFIG.read_text(encoding="utf-8"))
    if not (re.fullmatch(r"[a-f0-9]{32}", str(data.get("deviceId", "")))
            and len(str(data.get("token", ""))) >= 48):
        raise OperatorError("device_config_invalid")
    data["url"] = operator_url(data["url"])
    return data


def api(base: str, path: str, *, method: str, body: bytes | None = None,
        device: dict | None = None, headers: dict | None = None,
        max_output: int = 4096, timeout: int = 45) -> bytes:
    if not path.startswith("/v1/agent/") or ".." in path or "//" in path:
        raise OperatorError("bad_agent_path")
    req_headers = {"Accept": "application/json"}
    if body is not None:
        req_headers["Content-Type"] = "application/json"
    if device:
        req_headers["Authorization"] = "Bearer " + device["token"]
        req_headers["x-vast-device-id"] = device["deviceId"]
    if headers:
        req_headers.update(headers)
    req = request.Request(base + path, data=body,
                          headers=req_headers, method=method)
    try:
        with request.build_opener(NoRedirect).open(req, timeout=timeout) as resp:
            raw = resp.read(max_output + 1)
            if len(raw) > max_output:
                raise OperatorError("remote_response_too_large")
            return raw
    except error.HTTPError as exc:
        # Only expose a validated error *code* from our own Worker.
        # Never print response HTML, URLs, headers, or secret tokens.
        reason = "remote_http_" + str(exc.code)
        if exc.headers.get("content-type", "").startswith("application/json"):
            try:
                message = json.loads(exc.read(512))
                error_code = message.get("error") if isinstance(message, dict) else None
                if isinstance(error_code, str) and re.fullmatch(r"[a-z0-9_]{1,50}", error_code):
                    reason += "_" + error_code
            except (ValueError, OSError):
                pass
        raise OperatorError(reason) from None
    except error.URLError:
        raise OperatorError("remote_unreachable") from None


def post_json(base: str, path: str, payload: dict,
              device: dict | None = None) -> dict:
    raw = api(base, path, method="POST",
              body=json.dumps(payload, separators=(",", ":")).encode(),
              device=device)
    obj = json.loads(raw)
    if not isinstance(obj, dict):
        raise OperatorError("remote_response_invalid")
    return obj


def start_poller() -> None:
    """Detach an outbound poller so closing the browser terminal does not stop it."""
    STATE_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    log_path = STATE_DIR / "poll.log"
    fd = os.open(str(log_path), os.O_CREAT | os.O_APPEND | os.O_WRONLY, 0o600)
    try:
        with os.fdopen(fd, "a", encoding="utf-8") as stream:
            proc = subprocess.Popen(
                [sys.executable, str(Path(__file__).resolve()), "poll", "--interval", "30"],
                cwd=HERE, stdin=subprocess.DEVNULL, stdout=stream, stderr=stream,
                start_new_session=True, close_fds=True)
        print("POLLER_STARTED_PID=" + str(proc.pid), flush=True)
    except Exception:
        raise OperatorError("poller_start_failed") from None


def enroll(url: str, *, auto_start: bool = True) -> None:
    url = operator_url(url)
    if CONFIG.exists():
        raise OperatorError("device_already_enrolled_refuse_overwrite")
    device_id = secrets.token_hex(16)
    token = secrets.token_urlsafe(48)
    code = secrets.token_hex(4).upper()
    status = post_json(url, "/v1/agent/enroll", {
        "deviceId": device_id,
        "tokenSha256": hashlib.sha256(token.encode()).hexdigest(),
        "pairCode": code,
    })
    if status.get("pending") is not True or status.get("deviceId") != device_id:
        raise OperatorError("enrollment_not_accepted")
    save_private_config({"deviceId": device_id, "token": token, "url": url})
    print("DEVICE_ID=" + device_id, flush=True)
    print("PAIR_CODE=" + code, flush=True)
    print("ENROLLMENT=PENDING_OPERATOR_APPROVAL", flush=True)
    print("Send ONLY DEVICE_ID and PAIR_CODE; never send device.json", flush=True)
    if auto_start:
        start_poller()


def validate_job(job: dict) -> tuple[str, str]:
    action = job.get("action")
    ident = job.get("id")
    if action not in ACTIONS or not isinstance(ident, str) or not JOB_ID.fullmatch(ident):
        raise OperatorError("invalid_job_or_action")
    source, target = job.get("inputKey"), job.get("outputKey")
    if source is not None and (not isinstance(source, str) or
                               not source.startswith("vast-private/input/") or len(source) > 250):
        raise OperatorError("invalid_input_key")
    if target is not None and (not isinstance(target, str) or
                               not target.startswith("vast-private/output/") or len(target) > 250):
        raise OperatorError("invalid_output_key")
    if action in {"generate_one", "inspect_glb", "finalize_glb"} and not source:
        raise OperatorError("input_required")
    if action in {"generate_one", "finalize_glb"} and not target:
        raise OperatorError("output_required")
    if action in {"gpu_info", "preflight", "diagnose_dinov3"} and (source or target):
        raise OperatorError("unexpected_asset")
    if action in {"generate_one", "diagnose_dinov3"} and job.get("approvedCompute") != 1:
        raise OperatorError("compute_not_approved")
    if action == "generate_one" and job.get("rightsConfirmed") != 1:
        raise OperatorError("rights_not_approved")
    return action, ident


def retrieve_input(device: dict, job: dict) -> bytes:
    data = api(device["url"], "/v1/agent/jobs/" + job["id"] + "/input",
               method="GET", device=device, max_output=MAX_INPUT, timeout=120)
    claimed = job.get("inputSha256")
    if not isinstance(claimed, str) or not HEX64.fullmatch(claimed):
        raise OperatorError("input_hash_unavailable")
    if hashlib.sha256(data).hexdigest() != claimed:
        raise OperatorError("input_hash_mismatch")
    return data


def store_output(device: dict, job: dict, result: bytes) -> None:
    if not 28 <= len(result) <= MAX_GLB or result[:4] != b"glTF":
        raise OperatorError("not_a_glb")
    import glb_quality
    glb_quality.inspect_glb_bytes(result)
    digest = hashlib.sha256(result).hexdigest()
    raw = api(device["url"], "/v1/agent/jobs/" + job["id"] + "/output",
              method="PUT", body=result, device=device, max_output=4096,
              headers={"Content-Type": "model/gltf-binary",
                       "x-content-sha256": digest}, timeout=150)
    state = json.loads(raw)
    if state.get("stored") is not True or state.get("sha256") != digest:
        raise OperatorError("r2_upload_not_confirmed")


def image_filename(blob: bytes) -> str:
    if blob.startswith(b"\x89PNG\r\n\x1a\n"):
        return "source.png"
    if blob.startswith(b"\xff\xd8\xff"):
        return "source.jpg"
    if blob.startswith(b"RIFF") and blob[8:12] == b"WEBP":
        return "source.webp"
    raise OperatorError("unsupported_image_magic")


def run_checked(args: list[str], timeout: int = 180, env: dict | None = None) -> dict:
    try:
        completed = subprocess.run(args, cwd=HERE, capture_output=True,
                                   text=True, timeout=timeout, check=False, env=env)
    except subprocess.TimeoutExpired:
        raise OperatorError("diagnostic_timeout") from None
    if completed.returncode != 0:
        raise OperatorError("diagnostic_failed")
    # Never transmit stdout: dependencies may unexpectedly print paths/tokens.
    return {"passed": True, "exitCode": 0}


def execute(job: dict, device: dict) -> dict:
    action, _ = validate_job(job)
    if action == "gpu_info":
        result = subprocess.run(
            ["nvidia-smi", "--query-gpu=name,memory.total,driver_version",
             "--format=csv,noheader,nounits"],
            cwd=HERE, capture_output=True, text=True, timeout=30, check=False)
        if result.returncode != 0:
            raise OperatorError("nvidia_smi_failed")
        lines = result.stdout.splitlines()
        if not lines:
            raise OperatorError("gpu_not_detected")
        first = [part.strip() for part in lines[0].split(",")]
        if len(first) != 3:
            raise OperatorError("unexpected_gpu_info")
        model_repo = Path("/workspace/TRELLIS.2/trellis2/pipelines/trellis2_image_to_3d.py")
        python_env = Path("/workspace/trellis2-env/bin/python")
        api_ready, api_engine = False, "unknown"
        try:
            with request.urlopen("http://127.0.0.1:8000/health", timeout=2) as resp:
                health = json.load(resp)
            if isinstance(health, dict):
                api_ready = health.get("ready") is True
                claimed_engine = health.get("engine")
                if claimed_engine in {"trellis2", "trellis-v1", "stable-fast-3d"}:
                    api_engine = claimed_engine
        except (OSError, ValueError, json.JSONDecodeError):
            pass
        return {"name": first[0][:100], "memoryMiB": int(first[1]),
                "driver": first[2][:50], "deviceCount": len(lines),
                "trellis2Checkout": model_repo.is_file(),
                "trellis2Environment": python_env.is_file(),
                "localGpuApiReady": api_ready, "localGpuEngine": api_engine}
    if action in {"preflight", "diagnose_dinov3"}:
        model_python = Path("/workspace/trellis2-env/bin/python")
        interpreter = str(model_python) if model_python.is_file() else sys.executable
        if action == "preflight":
            return run_checked([interpreter, str(HERE / "gpu_preflight.py")])
        if not model_python.is_file():
            raise OperatorError("trellis2_environment_missing")
        if not Path("/workspace/TRELLIS.2/trellis2/pipelines/trellis2_image_to_3d.py").is_file():
            raise OperatorError("trellis2_checkout_missing")
        env = os.environ.copy()
        env["CONDA_PREFIX"] = "/workspace/trellis2-env"
        env["PYTHONPATH"] = os.pathsep.join((str(HERE), "/workspace/TRELLIS.2",
                                               env.get("PYTHONPATH", "")))
        if not env.get("HF_HOME") and Path("/workspace/hf-cache").is_dir():
            env["HF_HOME"] = "/workspace/hf-cache"
        return run_checked([interpreter, str(HERE / "diagnose_trellis2_conditioning.py"),
                            "--execute"], timeout=900, env=env)
    data = retrieve_input(device, job)
    if action == "generate_one":
        if not 128 <= len(data) <= MAX_IMAGE:
            raise OperatorError("image_size_not_allowed")
        source_name = image_filename(data)
        from one_image_e2e import post_one_image
        token = os.environ.get("FORGE_GPU_TOKEN", "")
        if len(token) < 32:
            raise OperatorError("local_gpu_server_not_configured")
        result = post_one_image(data, source_name, token)
        store_output(device, job, result)
        return {"produced": True, "bytes": len(result),
                "sha256": hashlib.sha256(result).hexdigest()}
    import glb_quality
    measured = glb_quality.inspect_glb_bytes(data)
    if action == "inspect_glb":
        return {"quality": measured}
    if action == "finalize_glb":
        from glb_mobile_finalize import finalize_mobile_glb
        with tempfile.TemporaryDirectory(prefix="spaktok-vast-") as work:
            src, dst = Path(work) / "input.glb", Path(work) / "output.glb"
            src.write_bytes(data)
            finalize_mobile_glb(src, dst)
            result = dst.read_bytes()
        store_output(device, job, result)
        return {"produced": True, "bytes": len(result),
                "sha256": hashlib.sha256(result).hexdigest()}
    raise OperatorError("unsupported_action")


def handle_job(device: dict, job: dict) -> None:
    ident = str(job.get("id", ""))
    if not JOB_ID.fullmatch(ident):
        raise OperatorError("invalid_job_id")
    try:
        result = execute(job, device)
        payload = {"status": "succeeded", "result": result}
    except Exception as exc:
        # Do not disclose exception details, request content or credentials.
        code = str(exc) if isinstance(exc, OperatorError) else "gpu_job_failed"
        if not re.fullmatch(r"[a-z0-9_]{1,64}", code):
            code = "gpu_job_failed"
        payload = {"status": "failed", "errorCode": code}
    post_json(device["url"], "/v1/agent/jobs/" + ident + "/complete",
              payload, device=device)
    print("JOB=" + ident + " STATUS=" + payload["status"], flush=True)


def poll(*, once: bool, seconds: int) -> None:
    device = read_config()
    while True:
        try:
            status = post_json(device["url"], "/v1/agent/claim", {}, device=device)
            if status.get("paired") is False:
                print("DEVICE_PAIRING=" + str(status.get("status", "pending")), flush=True)
            else:
                job = status.get("job")
                if isinstance(job, dict):
                    handle_job(device, job)
                elif job is not None:
                    raise OperatorError("invalid_job_claim")
        except OperatorError as exc:
            if once:
                raise
            print("POLL_RECONNECT=" + str(exc), flush=True)
        if once:
            return
        time.sleep(seconds)


def main() -> int:
    parser = argparse.ArgumentParser(description="Spaktok private Vast GPU agent")
    sub = parser.add_subparsers(dest="command", required=True)
    pair = sub.add_parser("enroll", help="One-time device pairing; no GPU work")
    pair.add_argument("--worker", required=True, help="HTTPS Cloudflare Worker base URL")
    p = sub.add_parser("poll", help="Outbound polling for operator-approved jobs")
    p.add_argument("--once", action="store_true")
    p.add_argument("--interval", type=int, default=20)
    args = parser.parse_args()
    try:
        if args.command == "enroll":
            enroll(args.worker)
        else:
            if not 10 <= args.interval <= 600:
                raise OperatorError("poll_interval_out_of_range")
            poll(once=args.once, seconds=args.interval)
        return 0
    except (OperatorError, ValueError, OSError) as exc:
        label = str(exc) if isinstance(exc, OperatorError) else "agent_runtime_error"
        print("ERROR=" + label, file=sys.stderr)
        return 2


if __name__ == "__main__":
    raise SystemExit(main())
