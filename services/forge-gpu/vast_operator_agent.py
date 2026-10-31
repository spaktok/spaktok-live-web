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
import signal
import fcntl
import time
from urllib import error, parse, request

HERE = Path(__file__).resolve().parent
MAX_INPUT = 35 * 1024 * 1024
MAX_IMAGE = 8 * 1024 * 1024
MAX_GLB = 35 * 1024 * 1024
ACTIONS = frozenset({"gpu_info", "preflight", "diagnose_dinov3",
                     "inspect_glb", "finalize_glb", "generate_one"})
SETUP_ACTIONS = frozenset({"probe_environment",
                           "fetch_trellis2_source", "prepare_trellis2_runtime"})
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
    """Outbound HTTPS transport through curl, as validated on Vast.ai.

    Some Vast network routes return an HTML 403 to urllib's TLS fingerprint.
    A curl POST was verified to reach this Cloudflare Worker (HTTP 422 on
    deliberately invalid JSON). Never place authorization headers or payload
    bytes in process arguments: pipe curl's configuration via stdin and store
    request/response only in a 0700 temporary directory with 0600 files.
    """
    base = operator_url(base)
    if (not path.startswith("/v1/agent/") or ".." in path or "//" in path
            or "?" in path or "#" in path or method not in ("GET", "POST", "PUT")):
        raise OperatorError("bad_agent_path")
    if not isinstance(max_output, int) or max_output < 1 or max_output > MAX_GLB:
        raise OperatorError("invalid_response_limit")
    req_headers = {"Accept": "application/json"}
    if body is not None:
        req_headers["Content-Type"] = "application/json"
    if device:
        req_headers["Authorization"] = "Bearer " + device["token"]
        req_headers["x-vast-device-id"] = device["deviceId"]
    if headers:
        req_headers.update(headers)
    if not all(isinstance(k, str) and isinstance(v, str) and
               re.fullmatch(r"[A-Za-z0-9-]{1,64}", k) and
               not any(ch in v for ch in "\r\n\x00")
               for k, v in req_headers.items()):
        raise OperatorError("unsafe_request_header")
    with tempfile.TemporaryDirectory(prefix="spaktok-vast-https-") as folder:
        private = Path(folder)
        os.chmod(private, 0o700)
        result_file = private / "response"
        config = [
            "url = " + json.dumps(base + path),
            "request = " + json.dumps(method),
            "output = " + json.dumps(str(result_file)),
            "write-out = " + json.dumps("%{http_code}"),
        ]
        for key, value in req_headers.items():
            config.append("header = " + json.dumps(key + ": " + value))
        if body is not None:
            source = private / "request"
            with source.open("xb") as fd:
                fd.write(body)
            os.chmod(source, 0o600)
            config.append("data-binary = " + json.dumps("@" + str(source)))
        try:
            proc = subprocess.run(
                ["curl", "-q", "--silent", "--show-error", "--max-time",
                 str(timeout), "--max-redirs", "0", "--retry", "0",
                 "--config", "-"],
                input=("\n".join(config) + "\n").encode("utf-8"),
                stdout=subprocess.PIPE, stderr=subprocess.PIPE,
                timeout=timeout + 5, check=False,
            )
        except FileNotFoundError:
            raise OperatorError("curl_not_installed") from None
        except subprocess.TimeoutExpired:
            raise OperatorError("remote_timeout") from None
        if proc.returncode != 0:
            raise OperatorError("remote_transport_failed")
        status_text = proc.stdout.decode("ascii", errors="replace").strip()
        if len(status_text) != 3 or not status_text.isdigit():
            raise OperatorError("remote_status_invalid")
        status = int(status_text)
        if not result_file.is_file():
            raise OperatorError("remote_response_missing")
        if result_file.stat().st_size > max_output:
            raise OperatorError("remote_response_too_large")
        raw = result_file.read_bytes()
        if status < 200 or status >= 300:
            label = "remote_http_" + str(status)
            try:
                obj = json.loads(raw[:512])
                code = obj.get("error") if isinstance(obj, dict) else None
                if isinstance(code, str) and re.fullmatch(r"[a-z0-9_]{1,50}", code):
                    label += "_" + code
            except (ValueError, UnicodeError):
                pass
            raise OperatorError(label)
        return raw

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
        from vast_setup_tasks import locate_trellis_python
        model_repo = Path("/workspace/TRELLIS.2/trellis2/pipelines/trellis2_image_to_3d.py")
        python_env = locate_trellis_python()
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
                "trellis2Environment": python_env is not None,
                "localGpuApiReady": api_ready, "localGpuEngine": api_engine,
                "autoTrellisJobLauncher": (HERE / "vast_local_trellis_service.py").is_file()}
    if action in {"preflight", "diagnose_dinov3"}:
        from vast_setup_tasks import locate_trellis_python
        model_python = locate_trellis_python()
        # Preflight always uses the known working system torch, independently
        # of optional TRELLIS conda installation.
        if action == "preflight":
            return run_checked([sys.executable, str(HERE / "gpu_preflight.py")])
        if model_python is None:
            raise OperatorError("trellis2_environment_missing")
        if not Path("/workspace/TRELLIS.2/trellis2/pipelines/trellis2_image_to_3d.py").is_file():
            raise OperatorError("trellis2_checkout_missing")
        env = os.environ.copy()
        env["CONDA_PREFIX"] = str(model_python.parent.parent)
        env["PYTHONPATH"] = os.pathsep.join((str(HERE), "/workspace/TRELLIS.2",
                                               env.get("PYTHONPATH", "")))
        # The GPU owner authenticated via Hugging Face Device OAuth with
        # HF_HOME=/workspace/.hf_home. Reuse that local cache; do not read,
        # forward, or log the stored OAuth credential.
        if not env.get("HF_HOME"):
            for cache in ("/workspace/.hf_home", "/workspace/hf-cache"):
                if Path(cache).is_dir():
                    env["HF_HOME"] = cache
                    break
        return run_checked([str(model_python),
                            str(HERE / "diagnose_trellis2_conditioning.py"),
                            "--execute"], timeout=900, env=env)
    data = retrieve_input(device, job)
    if action == "generate_one":
        if not 128 <= len(data) <= MAX_IMAGE:
            raise OperatorError("image_size_not_allowed")
        source_name = image_filename(data)
        # Only an explicitly approved paid generation job may launch the
        # fixed localhost TRELLIS.2 service. Never start on gpu_info/probe.
        from vast_local_trellis_service import (ensure_local_trellis2,
                                                   LocalServiceError)
        from one_image_e2e import post_one_image
        try:
            token = ensure_local_trellis2()
        except LocalServiceError as exc:
            raise OperatorError(str(exc)) from None
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


def handle_setup_job(device: dict, job: dict) -> None:
    """Only fixed reviewed setup tasks, never arbitrary remote shell."""
    ident = job.get("id")
    action = job.get("action")
    if (not isinstance(ident, str) or not JOB_ID.fullmatch(ident)
            or action not in SETUP_ACTIONS):
        raise OperatorError("invalid_setup_job")
    if action != "probe_environment" and job.get("approvedCompute") != 1:
        raise OperatorError("setup_compute_not_approved")
    try:
        from vast_setup_tasks import execute_setup_task, SetupError
        result = execute_setup_task(action)
        payload = {"status": "succeeded", "result": result}
    except Exception as exc:
        from vast_setup_tasks import SetupError
        label = str(exc) if isinstance(exc, SetupError) else "setup_runtime_failed"
        if not re.fullmatch(r"[a-z0-9_]{1,64}", label):
            label = "setup_runtime_failed"
        payload = {"status": "failed", "errorCode": label}
    post_json(device["url"], "/v1/agent/setup/" + ident + "/complete",
              payload, device=device)
    print("SETUP_JOB=" + ident + " STATUS=" + payload["status"], flush=True)


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
    STATE_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    lock_fd = os.open(str(STATE_DIR / "poll.lock"), os.O_CREAT | os.O_RDWR, 0o600)
    try:
        fcntl.flock(lock_fd, fcntl.LOCK_EX | fcntl.LOCK_NB)
    except BlockingIOError:
        os.close(lock_fd)
        raise OperatorError("poller_already_running")
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
                # Separate operator setup queue; GPU asset jobs are unaffected.
                setup = post_json(device["url"], "/v1/agent/setup/claim",
                                  {}, device=device)
                if setup.get("paired") is True:
                    task = setup.get("job")
                    if isinstance(task, dict):
                        handle_setup_job(device, task)
                    elif task is not None:
                        raise OperatorError("invalid_setup_claim")
        except OperatorError as exc:
            if once:
                raise
            print("POLL_RECONNECT=" + str(exc), flush=True)
        if once:
            return
        time.sleep(seconds)


def upgrade_existing_poller() -> None:
    """Restart the *exact* known agent poller after a reviewed git pull.

    Never kills unrelated Python processes and never changes device token.
    """
    read_config()
    current = os.getpid()
    script_path = str(Path(__file__).resolve())
    stopped = 0
    for item in Path("/proc").iterdir():
        if not item.name.isdigit() or int(item.name) == current:
            continue
        try:
            args = (item / "cmdline").read_bytes().decode("utf-8").split("\x00")
        except (OSError, UnicodeDecodeError):
            continue
        if (script_path in args and "poll" in args
                and len(args) >= 3 and int(item.name) > 1):
            try:
                os.kill(int(item.name), signal.SIGTERM)
                stopped += 1
            except ProcessLookupError:
                pass
    print("PREVIOUS_POLLERS_STOPPED=" + str(stopped), flush=True)
    start_poller()


def main() -> int:
    parser = argparse.ArgumentParser(description="Spaktok private Vast GPU agent")
    sub = parser.add_subparsers(dest="command", required=True)
    pair = sub.add_parser("enroll", help="One-time device pairing; no GPU work")
    pair.add_argument("--worker", required=True, help="HTTPS Cloudflare Worker base URL")
    sub.add_parser("upgrade", help="Restart only the matching agent poller after git pull")
    p = sub.add_parser("poll", help="Outbound polling for operator-approved jobs")
    p.add_argument("--once", action="store_true")
    p.add_argument("--interval", type=int, default=20)
    args = parser.parse_args()
    try:
        if args.command == "enroll":
            enroll(args.worker)
        elif args.command == "upgrade":
            upgrade_existing_poller()
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
