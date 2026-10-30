#!/usr/bin/env python3
"""One-shot PRIVATE E2E integration test on the user's EXISTING Vast A100.

Spawns localhost-only operator API, waits for model health, sends one reference
image over the real HTTP multipart path, checks/exports GLB, then stops the
localhost service. No cloud deployment or user account changes are made.
Explicit --execute is required. Never retries a failed generation.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import secrets
import signal
import subprocess
import sys
import time
from urllib import request

HERE = Path(__file__).resolve().parent
TRELLIS = Path("/workspace/TRELLIS.2")
ENV = Path("/workspace/trellis2-env")
IMAGE = TRELLIS / "assets/example_image/T.png"
OUTPUT = Path("/workspace/spaktok-first.glb")


def load_health() -> bool:
    try:
        with request.urlopen("http://127.0.0.1:8000/health", timeout=3) as resp:
            body = json.load(resp)
        return body.get("ready") is True and body.get("engine") == "trellis2"
    except Exception:
        return False


def main() -> int:
    parser = argparse.ArgumentParser(description="Spaktok local TRELLIS.2 E2E")
    parser.add_argument("--execute", action="store_true")
    parser.add_argument("--image", default=str(IMAGE))
    parser.add_argument("--output", default=str(OUTPUT))
    args = parser.parse_args()

    image = Path(args.image).resolve()
    output = Path(args.output).resolve()
    print("SPAKTOK VAST A100 -> TRELLIS.2 -> PRIVATE GLB", flush=True)
    print("Image:", image.name, "Output:", output, flush=True)
    if os.getenv("CONDA_PREFIX") != str(ENV):
        print("ERROR: activate /workspace/trellis2-env first", flush=True)
        return 2
    if not (TRELLIS / "trellis2/pipelines/trellis2_image_to_3d.py").is_file():
        print("ERROR: TRELLIS.2 source missing", flush=True)
        return 2
    if not image.is_file() or output.exists():
        print("ERROR: source missing or private output already exists", flush=True)
        return 2
    if not os.getenv("HF_HOME"):
        print("ERROR: set HF_HOME to approved Hugging Face token directory", flush=True)
        return 2
    if not args.execute:
        print("DRY_RUN_ONLY — use --execute for exactly one inference", flush=True)
        return 0

    env = os.environ.copy()
    env["FORGE_GPU_ENGINE"] = "trellis2"
    env["FORGE_GPU_TOKEN"] = secrets.token_urlsafe(48)
    # The operator test uses local HTTP only, NO browser-CORS request.
    env["FORGE_GPU_ALLOWED_ORIGIN"] = "https://studio.spaktok.invalid"
    env["PYTHONPATH"] = os.pathsep.join((str(HERE), str(TRELLIS), env.get("PYTHONPATH","")))
    env["PYTORCH_CUDA_ALLOC_CONF"] = "expandable_segments:True"
    env["CUDA_HOME"] = str(ENV)
    env["TORCH_CUDA_ARCH_LIST"] = "8.0"
    env["PATH"] = str(ENV / "bin") + os.pathsep + env.get("PATH","")
    if load_health():
        print("ERROR: port 8000 in use; refuse to contact unknown API",flush=True)
        return 2
    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "server:app",
         "--host", "127.0.0.1", "--port", "8000",
         "--workers", "1", "--no-access-log"],
        cwd=str(HERE), env=env,
    )
    try:
        print("STAGE: loading TRELLIS.2-4B with approved DINOv3",flush=True)
        deadline = time.monotonic() + 1500
        while time.monotonic() < deadline:
            if proc.poll() is not None:
                print("ERROR: local model API exited; read server logs", flush=True)
                return 3
            if load_health():
                break
            time.sleep(3)
        else:
            print("ERROR: model did not become ready; do not retry automatically",flush=True)
            return 3
        print("STAGE: sending ONE image to localhost GPU and receiving GLB",flush=True)
        smoke = subprocess.run(
            [sys.executable, str(HERE / "one_image_e2e.py"),
             "--image", str(image), "--output", str(output), "--execute"],
            env=env, check=False,
        )
        return smoke.returncode
    finally:
        if proc.poll() is None:
            proc.terminate()
            try:
                proc.wait(timeout=15)
            except subprocess.TimeoutExpired:
                proc.kill()
                proc.wait(timeout=10)
        print("STAGE: local GPU HTTP service closed. GPU rental remains operator-managed.",
              flush=True)


if __name__ == "__main__":
    raise SystemExit(main())
