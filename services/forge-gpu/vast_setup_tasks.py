"""Finite, outbound-only Vast.ai TRELLIS.2 setup actions.

No user-supplied command, path, repository or package name is interpreted.
The GPU machine is rented and managed by its owner; these fixed actions do
not create/terminate Vast instances or run paid model inference.
"""
from __future__ import annotations

import json
import os
from pathlib import Path
import shutil
import subprocess
import sys

WORKSPACE = Path("/workspace")
TRELLIS = WORKSPACE / "TRELLIS.2"
FORGE_REPO = WORKSPACE / "spaktok-live-web"
ENV_PYTHON = WORKSPACE / "trellis2-env" / "bin" / "python"
TRELLIS_SHA = "75fbf0183001ed9876c8dbb35de6b68552ee08bd"
TRELLIS_ORIGIN = "https://github.com/microsoft/TRELLIS.2.git"
MIN_DISK_GIB = 35


class SetupError(Exception):
    """Sanitized error codes only; never transmit process logs."""


def _run(args: list[str], *, timeout: int = 120, cwd: Path | None = None,
         capture: bool = True) -> subprocess.CompletedProcess:
    try:
        return subprocess.run(
            args, cwd=cwd or WORKSPACE,
            stdout=subprocess.PIPE if capture else subprocess.DEVNULL,
            stderr=subprocess.PIPE if capture else subprocess.DEVNULL,
            text=True, check=False, timeout=timeout,
            env={**os.environ, "GIT_TERMINAL_PROMPT": "0"},
        )
    except (subprocess.TimeoutExpired, FileNotFoundError) as exc:
        raise SetupError("setup_timeout_or_missing_executable") from None


def _disk() -> dict:
    if not WORKSPACE.is_dir():
        raise SetupError("workspace_missing")
    usage = shutil.disk_usage(WORKSPACE)
    return {"freeGiB": round(usage.free / 1024 ** 3, 1),
            "totalGiB": round(usage.total / 1024 ** 3, 1)}


def _torch() -> dict:
    code = (
        "import torch,json;"
        "print(json.dumps({'version':torch.__version__,"
        "'cuda':torch.version.cuda,'available':torch.cuda.is_available()}))"
    )
    p = _run([sys.executable, "-c", code], timeout=35)
    if p.returncode != 0:
        return {"installed": False}
    try:
        obj = json.loads(p.stdout)
    except (ValueError, TypeError):
        return {"installed": False}
    return {"installed": True,
            "version": str(obj.get("version", ""))[:60],
            "cuda": str(obj.get("cuda", ""))[:30],
            "available": obj.get("available") is True}


def locate_trellis_python() -> Path | None:
    """Resolve the exact Conda env named trellis2, without guessing its prefix.

    Vast PyTorch templates commonly place Conda environments under /venv or
    /opt rather than /workspace. No credentials or raw paths are reported.
    """
    if ENV_PYTHON.is_file():
        return ENV_PYTHON
    if not shutil.which("conda"):
        return None
    try:
        cmd = _run(["conda", "env", "list", "--json"], timeout=25)
    except SetupError:
        return None
    if cmd.returncode != 0:
        return None
    try:
        entries = json.loads(cmd.stdout).get("envs", [])
    except (ValueError, AttributeError, TypeError):
        return None
    if not isinstance(entries, list):
        return None
    for entry in entries:
        if not isinstance(entry, str):
            continue
        prefix = Path(entry)
        if prefix.is_absolute() and prefix.name == "trellis2":
            python = prefix / "bin" / "python"
            if python.is_file():
                return python
    return None


def _torch_in_runtime(python: Path) -> dict:
    code = ("import json,torch;"
            "print(json.dumps({'torch':torch.__version__,"
            "'cuda':torch.version.cuda,'available':torch.cuda.is_available()}))")
    try:
        p = _run([str(python), "-c", code], timeout=45)
    except SetupError:
        return {"installed": False}
    if p.returncode:
        return {"installed": False}
    try:
        info = json.loads(p.stdout)
    except (ValueError, TypeError):
        return {"installed": False}
    return {"installed": True, "version": str(info.get("torch", ""))[:50],
            "cuda": str(info.get("cuda", ""))[:30],
            "available": info.get("available") is True}


def probe_environment() -> dict:
    out = _disk()
    # No account credentials, environment variables or home paths are reported.
    tools = ("conda", "micromamba", "uv", "git", "nvcc", "gcc",
             "cmake", "ninja", "curl", "nvidia-smi")
    out["tools"] = {name: shutil.which(name) is not None for name in tools}
    out["pythonVersion"] = sys.version.split()[0][:20]
    out["torch"] = _torch()
    out["trellisSourcePresent"] = (
        TRELLIS / "trellis2" / "pipelines" / "trellis2_image_to_3d.py").is_file()
    runtime = locate_trellis_python()
    out["trellisEnvironmentPresent"] = runtime is not None
    out["trellisRuntimeLocation"] = (
        "workspace" if runtime == ENV_PYTHON else "conda" if runtime else "missing"
    )
    if runtime is not None:
        out["trellisTorch"] = _torch_in_runtime(runtime)
    out["forgeSourcePresent"] = (FORGE_REPO / "services" / "forge-gpu" /
                                 "vast_operator_agent.py").is_file()
    out["sourcePinned"] = False
    if (TRELLIS / ".git").exists():
        r = _run(["git", "-C", str(TRELLIS), "rev-parse", "HEAD"], timeout=10)
        out["sourcePinned"] = r.returncode == 0 and r.stdout.strip() == TRELLIS_SHA
    return out


def fetch_trellis2_source() -> dict:
    if _disk()["freeGiB"] < MIN_DISK_GIB:
        raise SetupError("insufficient_disk_for_trellis2")
    if not shutil.which("git"):
        raise SetupError("git_not_available")
    if TRELLIS.exists() and not (TRELLIS / ".git").is_dir():
        raise SetupError("source_directory_exists_not_git")
    if TRELLIS.exists():
        current = _run(["git", "-C", str(TRELLIS), "remote", "get-url",
                        "origin"], timeout=10)
        if current.returncode != 0 or current.stdout.strip() != TRELLIS_ORIGIN:
            raise SetupError("source_origin_mismatch")
        dirty = _run(["git", "-C", str(TRELLIS), "status", "--porcelain"],
                     timeout=20)
        if dirty.returncode != 0 or dirty.stdout.strip():
            raise SetupError("source_checkout_dirty")
    else:
        p = _run(["git", "init", str(TRELLIS)], timeout=25)
        if p.returncode != 0:
            raise SetupError("git_init_failed")
        p = _run(["git", "-C", str(TRELLIS), "remote", "add",
                  "origin", TRELLIS_ORIGIN], timeout=10)
        if p.returncode != 0:
            raise SetupError("git_remote_failed")
    # An exact upstream revision: no arbitrary URL, branch or commit input.
    p = _run(["git", "-C", str(TRELLIS), "fetch", "--depth", "1",
              "origin", TRELLIS_SHA], timeout=650)
    if p.returncode != 0:
        raise SetupError("trellis_fetch_failed")
    p = _run(["git", "-C", str(TRELLIS), "checkout", "--detach",
              TRELLIS_SHA], timeout=45)
    if p.returncode != 0:
        raise SetupError("trellis_checkout_failed")
    p = _run(["git", "-C", str(TRELLIS), "submodule", "update",
              "--init", "--recursive", "--depth", "1"], timeout=650)
    if p.returncode != 0:
        raise SetupError("trellis_submodule_failed")
    p = _run(["git", "-C", str(TRELLIS), "rev-parse", "HEAD"], timeout=15)
    if p.returncode != 0 or p.stdout.strip() != TRELLIS_SHA:
        raise SetupError("trellis_revision_mismatch")
    return {"sourceReady": True, "revision": TRELLIS_SHA,
            "modelWeightsDownloaded": False, "inferenceExecuted": False}


def prepare_trellis2_runtime() -> dict:
    """Owner-approved dependency installation, not GPU generation.

    Reuses the repository's pinned setup script. This runs upstream build
    steps only after an operator's explicit approved_compute=1 job grant.
    A local private log is retained for operator diagnostics.
    """
    if _disk()["freeGiB"] < MIN_DISK_GIB:
        raise SetupError("insufficient_disk_for_runtime")
    if shutil.which("conda") is None:
        raise SetupError("conda_unavailable_use_reviewed_installer")
    if not (TRELLIS / ".git").is_dir():
        raise SetupError("trellis_source_missing")
    pin = _run(["git", "-C", str(TRELLIS), "rev-parse", "HEAD"], timeout=15)
    if pin.returncode != 0 or pin.stdout.strip() != TRELLIS_SHA:
        raise SetupError("trellis_source_not_pinned")
    script = FORGE_REPO / "scripts" / "vast-a100-trellis2.sh"
    if not script.is_file():
        raise SetupError("reviewed_setup_script_missing")
    log_dir = WORKSPACE / ".spaktok-vast-agent"
    log_dir.mkdir(mode=0o700, exist_ok=True)
    os.chmod(log_dir, 0o700)
    log = log_dir / "trellis-install.log"
    env = {
        **os.environ,
        "SPAKTOK_DIR": str(FORGE_REPO),
        "SPAKTOK_WORKDIR": str(WORKSPACE),
        "SPAKTOK_ACCEPT_UPSTREAM_SETUP": "yes",
        "MAX_JOBS": "2",
    }
    fd = os.open(str(log), os.O_CREAT | os.O_WRONLY | os.O_TRUNC, 0o600)
    with os.fdopen(fd, "wb") as output:
        try:
            p = subprocess.run(
                ["bash", str(script), "install"], cwd=str(FORGE_REPO),
                stdout=output, stderr=subprocess.STDOUT,
                check=False, timeout=3600, env=env,
            )
        except subprocess.TimeoutExpired:
            raise SetupError("trellis_setup_timeout_review_private_log") from None
    if p.returncode != 0:
        raise SetupError("trellis_setup_failed_review_private_log")
    runtime = locate_trellis_python()
    if runtime is None:
        return {"setupScriptExitedZero": True, "canonicalRuntime": False,
                "runtimeLocated": False, "requiresEnvironmentPathReview": True}
    torch = _torch_in_runtime(runtime)
    return {"setupScriptExitedZero": True, "runtimeLocated": True,
            "canonicalRuntime": runtime == ENV_PYTHON,
            "cudaReady": torch.get("available") is True,
            "trellisTorch": torch,
            "modelWeightsDownloaded": False, "inferenceExecuted": False}


ALLOWED_SETUP = {
    "probe_environment": probe_environment,
    "fetch_trellis2_source": fetch_trellis2_source,
    "prepare_trellis2_runtime": prepare_trellis2_runtime,
}


def execute_setup_task(action: str) -> dict:
    if action not in ALLOWED_SETUP:
        raise SetupError("setup_action_not_allowed")
    return ALLOWED_SETUP[action]()
