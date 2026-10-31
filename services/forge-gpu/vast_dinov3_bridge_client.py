#!/usr/bin/env python3
"""Download the one owner-approved DINOv3 checkpoint through Cloudflare.

Hugging Face token remains in a Cloudflare Worker secret. Uses only an existing
paired Vast agent credential and a short-lived operator-approved D1 grant.
No general file transfer, no command execution, no external model repositories.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import shutil
import struct

from vast_operator_agent import api, read_config, OperatorError

BRIDGE = "https://spaktok-dinov3-bridge.spaktok.workers.dev"
MODEL = "facebook/dinov3-vitl16-pretrain-lvd1689m"
DIR = Path("/workspace/.spaktok-models/dinov3-vitl16-pretrain-lvd1689m")
FILES = {
    "config.json": 745,
    "preprocessor_config.json": 585,
    "LICENSE.md": 7503,
    "model.safetensors": 1212559808,
}
CHUNK_SIZE = 8 * 1024 * 1024
MIN_FREE_BYTES = 6 * 1024 * 1024 * 1024


def status() -> dict:
    existing = {}
    for name, length in FILES.items():
        f = DIR / name
        existing[name] = f.is_file() and not f.is_symlink() and f.stat().st_size == length
    return {"model": MODEL, "readyFiles": existing, "allPresent": all(existing.values())}


def verify_safetensors_header(path: Path) -> None:
    with path.open("rb") as f:
        head = f.read(8)
        if len(head) != 8:
            raise OperatorError("safetensors_missing_header")
        n = struct.unpack("<Q", head)[0]
        if n < 16 or n > 64 * 1024 * 1024:
            raise OperatorError("safetensors_invalid_header_size")
        obj = json.loads(f.read(n))
        if not isinstance(obj, dict) or len(obj) < 4:
            raise OperatorError("safetensors_invalid_metadata")


def download_one(name: str, length: int, device: dict) -> dict:
    if name not in FILES or FILES[name] != length:
        raise OperatorError("checkpoint_file_not_allowed")
    dest = DIR / name
    if dest.exists():
        if dest.is_symlink():
            raise OperatorError("checkpoint_symlink_refused")
        if dest.is_file() and dest.stat().st_size == length:
            if name == "model.safetensors":
                verify_safetensors_header(dest)
            return {"name": name, "bytes": length, "existing": True}
        raise OperatorError("checkpoint_existing_file_mismatch")
    partial = DIR / (name + ".partial")
    flags = os.O_CREAT | os.O_EXCL | os.O_WRONLY | getattr(os, "O_NOFOLLOW", 0)
    try:
        fd = os.open(partial, flags, 0o600)
    except FileExistsError:
        raise OperatorError("checkpoint_partial_exists_review_first") from None
    digest = hashlib.sha256()
    total = 0
    try:
        with os.fdopen(fd, "wb") as out:
            for start in range(0, length, CHUNK_SIZE):
                end = min(length - 1, start + CHUNK_SIZE - 1)
                data = api(BRIDGE, "/v1/agent/dinov3/file/" + name,
                           method="GET", device=device,
                           headers={"Range": "bytes=" + str(start) + "-" + str(end)},
                           max_output=CHUNK_SIZE, timeout=180)
                if len(data) != end - start + 1:
                    raise OperatorError("checkpoint_chunk_size_mismatch")
                digest.update(data)
                out.write(data)
                total += len(data)
            out.flush()
            os.fsync(out.fileno())
        if total != length:
            raise OperatorError("checkpoint_size_mismatch")
        if name == "model.safetensors":
            verify_safetensors_header(partial)
        os.replace(partial, dest)
        return {"name": name, "bytes": total, "sha256": digest.hexdigest(),
                "existing": False}
    finally:
        if partial.exists():
            partial.unlink()


def sync() -> dict:
    device = read_config()
    response = json.loads(api(BRIDGE, "/v1/agent/dinov3/status",
                              method="GET", device=device))
    if response.get("granted") is not True:
        raise OperatorError("dinov3_device_grant_required")
    if response.get("tokenConfigured") is not True:
        raise OperatorError("dinov3_cloudflare_secret_required")
    if response.get("model") != MODEL:
        raise OperatorError("dinov3_model_mismatch")
    if shutil.disk_usage("/workspace").free < MIN_FREE_BYTES:
        raise OperatorError("insufficient_disk_for_dinov3")
    DIR.mkdir(parents=True, exist_ok=True, mode=0o700)
    if DIR.is_symlink():
        raise OperatorError("model_dir_symlink_refused")
    os.chmod(DIR, 0o700)
    completed = []
    for name, size in FILES.items():
        completed.append(download_one(name, size, device))
        # Do not print credentials or download URLs; only asset metadata.
        print("CHECKPOINT_FILE=" + name + " BYTES=" + str(size), flush=True)
    return {"model": MODEL, "files": completed, "ready": True,
            "next": "validate_model_loading_in_trellis_conda"}


def main():
    parser = argparse.ArgumentParser(description="Private Spaktok DINOv3 model transfer")
    parser.add_argument("action", choices=("status", "download"))
    args = parser.parse_args()
    try:
        result = status() if args.action == "status" else sync()
        print(json.dumps(result, separators=(",", ":")))
    except (OperatorError, OSError, ValueError, json.JSONDecodeError) as exc:
        # Do not print server responses or secret-bearing exception objects.
        code = str(exc) if isinstance(exc, OperatorError) else "checkpoint_sync_failed"
        print(json.dumps({"error": code if len(code) < 80 else "checkpoint_sync_failed"}))
        raise SystemExit(2) from None


if __name__ == "__main__":
    main()
