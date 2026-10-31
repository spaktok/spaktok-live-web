#!/usr/bin/env python3
"""Start only Spaktok's reviewed localhost TRELLIS.2 inference service.

Called exclusively by an already validated, rights-confirmed generate_one job
on the owner's pre-paired Vast.ai GPU. There is NO arbitrary shell execution,
no public network socket, no GPU provisioning, no command supplied remotely.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import secrets
import subprocess
import time
from urllib import request, error

from vast_setup_tasks import locate_trellis_python, TRELLIS, TRELLIS_SHA, FORGE_REPO
STATE_DIR = Path(os.environ.get("SPAKTOK_VAST_AGENT_STATE", "/workspace/.spaktok-vast-agent"))


class LocalServiceError(Exception):
    """Sanitized, local-only service errors translated by the agent."""

HEALTH = "http://127.0.0.1:8000/health"
TOKEN_FILE = STATE_DIR / "forge-gpu-local-token"
LOG_FILE = STATE_DIR / "trellis2-service.log"
MAX_START_SECONDS = 1200


def local_health() -> tuple[bool, bool]:
    """(ready, occupied): occupied includes wrong backend or booting service."""
    try:
        with request.urlopen(HEALTH, timeout=3) as response:
            if response.status != 200:
                return False, True
            raw = response.read(2048)
            obj = json.loads(raw)
        if not isinstance(obj, dict):
            return False, True
        engine = obj.get("engine")
        if engine != "trellis2":
            raise LocalServiceError("localhost_gpu_port_wrong_engine")
        return obj.get("ready") is True, True
    except LocalServiceError:
        raise
    except error.HTTPError:
        return False, True
    except (OSError, ValueError, json.JSONDecodeError):
        return False, False


def local_token() -> str:
    STATE_DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    if TOKEN_FILE.exists():
        if TOKEN_FILE.is_symlink() or TOKEN_FILE.stat().st_mode & 0o077:
            raise LocalServiceError("local_gpu_token_permissions_unsafe")
        token = TOKEN_FILE.read_text(encoding="utf-8").strip()
        if len(token) < 32 or len(token) > 256:
            raise LocalServiceError("local_gpu_token_invalid")
        return token
    token = secrets.token_urlsafe(48)
    flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0)
    fd = os.open(TOKEN_FILE, flags, 0o600)
    with os.fdopen(fd, "w", encoding="utf-8") as output:
        output.write(token + "\n")
    return token


def check_source() -> Path:
    python = locate_trellis_python()
    if python is None:
        raise LocalServiceError("trellis2_environment_missing")
    source = TRELLIS / "trellis2" / "pipelines" / "trellis2_image_to_3d.py"
    if not source.is_file():
        raise LocalServiceError("trellis2_checkout_missing")
    result = subprocess.run(["git", "-C", str(TRELLIS), "rev-parse", "HEAD"],
                            capture_output=True, text=True, timeout=15,
                            check=False)
    if result.returncode != 0 or result.stdout.strip() != TRELLIS_SHA:
        raise LocalServiceError("trellis2_checkout_not_pinned")
    return python


def process_environment(python: Path, token: str) -> dict:
    env = os.environ.copy()
    env["FORGE_GPU_TOKEN"] = token
    env["FORGE_GPU_ENGINE"] = "trellis2"
    env["CONDA_PREFIX"] = str(python.parent.parent)
    env["CUDA_HOME"] = str(python.parent.parent)
    env["PATH"] = str(python.parent) + os.pathsep + env.get("PATH", "")
    env["PYTHONPATH"] = os.pathsep.join((str(FORGE_REPO / "services/forge-gpu"),
                                         str(TRELLIS), env.get("PYTHONPATH", "")))
    env["TORCH_CUDA_ARCH_LIST"] = "8.0"
    env["MAX_JOBS"] = "2"
    env["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"
    if not env.get("HF_HOME"):
        approved_cache = Path("/workspace/.hf_home")
        if approved_cache.is_dir():
            env["HF_HOME"] = str(approved_cache)
    if not env.get("HF_HOME") or not Path(env["HF_HOME"]).is_dir():
        raise LocalServiceError("huggingface_device_cache_missing")
    return env


def ensure_local_trellis2() -> str:
    """Return private local bearer after TRELLIS.2 health is ready.

    A specific generate_one job with approved_compute=1 and rights_confirmed=1
    must be validated by the caller before this function is used.
    """
    ready, occupied = local_health()
    if occupied and not ready:
        raise LocalServiceError("localhost_gpu_port_occupied_or_booting")
    # Even if already ready, fail if this operator does not possess the
    # original locally-created GPU server token.
    if ready:
        if not TOKEN_FILE.is_file():
            raise LocalServiceError("existing_gpu_server_unmanaged")
        return local_token()
    python = check_source()
    token = local_token()
    env = process_environment(python, token)
    STATE_DIR.mkdir(mode=0o700, parents=True, exist_ok=True)
    os.chmod(STATE_DIR, 0o700)
    fd = os.open(LOG_FILE, os.O_CREAT | os.O_APPEND | os.O_WRONLY, 0o600)
    with os.fdopen(fd, "ab") as output:
        try:
            child = subprocess.Popen(
                [str(python), "-m", "uvicorn", "server:app",
                 "--host", "127.0.0.1", "--port", "8000", "--workers", "1",
                 "--no-access-log"],
                cwd=FORGE_REPO / "services" / "forge-gpu",
                env=env, stdin=subprocess.DEVNULL, stdout=output, stderr=output,
                start_new_session=True, close_fds=True,
            )
        except OSError:
            raise LocalServiceError("trellis_service_launch_failed") from None
    started = time.monotonic()
    while time.monotonic() - started < MAX_START_SECONDS:
        ready, occupied = local_health()
        if ready:
            return token
        if child.poll() is not None:
            raise LocalServiceError("trellis_service_exited_review_private_log")
        time.sleep(5)
    raise LocalServiceError("trellis_service_start_timeout_review_private_log")
