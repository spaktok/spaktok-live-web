#!/usr/bin/env python3
"""One-image owner-controlled end-to-end test of Spaktok GPU HTTP transport.

Run INSIDE existing Vast.ai instance, using localhost only, AFTER the Python
service has loaded TRELLIS.2. This does not expose credentials or buy GPU time.
One invocation makes EXACTLY ONE request and NEVER retries a charged job.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
from pathlib import Path
import secrets
import sys
from urllib import request, error

MAX_IMAGE = 8 * 1024 * 1024
MAX_GLB = 35 * 1024 * 1024
DEFAULT_SOURCE = "/workspace/TRELLIS.2/assets/example_image/T.png"
DEFAULT_OUTPUT = "/workspace/spaktok-first.glb"
ROOT = "http://127.0.0.1:8000"


def inspect_glb(blob: bytes) -> dict:
    if not 28 <= len(blob) <= MAX_GLB:
        raise ValueError("glb_invalid_size")
    if (blob[:4] != b"glTF" or
            int.from_bytes(blob[4:8], "little") != 2 or
            int.from_bytes(blob[8:12], "little") != len(blob)):
        raise ValueError("glb_invalid_header")
    json_size = int.from_bytes(blob[12:16], "little")
    if blob[16:20] != b"JSON" or json_size > len(blob) - 20:
        raise ValueError("glb_missing_json_chunk")
    try:
        info = json.loads(blob[20:20 + json_size].decode("utf-8"))
    except (UnicodeError, ValueError) as exc:
        raise ValueError("glb_malformed_json") from exc
    if info.get("asset", {}).get("version") != "2.0":
        raise ValueError("glb_wrong_version")
    if not info.get("meshes"):
        raise ValueError("glb_no_meshes")
    return {
        "bytes": len(blob),
        "sha256": hashlib.sha256(blob).hexdigest(),
        "meshes": len(info["meshes"]),
        "materials": len(info.get("materials", [])),
        "textures": len(info.get("textures", [])),
    }


def post_one_image(image: bytes, name: str, token: str) -> bytes:
    if not token or len(token) < 32:
        raise ValueError("operator_token_missing")
    if not 128 <= len(image) <= MAX_IMAGE:
        raise ValueError("image_too_large_or_small")
    ext = Path(name).suffix.lower()
    mimes = {".png": "image/png", ".jpg": "image/jpeg",
             ".jpeg": "image/jpeg", ".webp": "image/webp"}
    if ext not in mimes:
        raise ValueError("only_png_jpeg_webp")
    boundary = "spaktok-" + secrets.token_hex(12)
    prefix = (
        f"--{boundary}\r\n"
        f'Content-Disposition: form-data; name="image"; filename="image{ext}"\r\n'
        f"Content-Type: {mimes[ext]}\r\n\r\n"
    ).encode("ascii")
    suffix = f"\r\n--{boundary}--\r\n".encode("ascii")
    form = prefix + image + suffix
    req = request.Request(ROOT + "/v1/generate", data=form, method="POST", headers={
        "Authorization": "Bearer " + token,
        "Content-Type": "multipart/form-data; boundary=" + boundary,
        "Content-Length": str(len(form)),
    })
    try:
        with request.urlopen(req, timeout=240) as response:
            if response.headers.get_content_type() != "model/gltf-binary":
                raise ValueError("wrong_result_content_type")
            declared = int(response.headers.get("Content-Length") or "0")
            if declared > MAX_GLB:
                raise ValueError("oversized_glb")
            blob = response.read(MAX_GLB + 1)
    except error.HTTPError as exc:
        # No headers, grant or secrets logged.
        raise RuntimeError("gpu_http_" + str(exc.code)) from exc
    if len(blob) > MAX_GLB:
        raise ValueError("oversized_glb")
    return blob


def main() -> int:
    parser = argparse.ArgumentParser(description="Spaktok TRELLIS.2 one-image private test")
    parser.add_argument("--image", default=DEFAULT_SOURCE)
    parser.add_argument("--output", default=DEFAULT_OUTPUT)
    parser.add_argument("--execute", action="store_true",
                        help="Explicitly allow ONE paid GPU inference")
    args = parser.parse_args()
    source = Path(args.image).resolve()
    destination = Path(args.output).resolve()
    if not source.is_file():
        print("SOURCE_NOT_FOUND:", source)
        return 2
    if destination.exists():
        print("OUTPUT_ALREADY_EXISTS:", destination)
        return 2
    raw = source.read_bytes()
    print("SOURCE:", source.name, "BYTES:", len(raw), flush=True)
    print("METHOD: Spaktok private localhost HTTP → GPU → GLB")
    print("DESTINATION:", destination)
    if not args.execute:
        print("DRY_RUN_ONLY: No GPU inference performed. Add --execute to run once.")
        return 0
    token = os.getenv("FORGE_GPU_TOKEN", "")
    print("STAGE: upload image to local operator service (one attempt)", flush=True)
    try:
        blob = post_one_image(raw, source.name, token)
        print("STAGE: validate returned GLB", flush=True)
        details = inspect_glb(blob)
        destination.parent.mkdir(parents=True, exist_ok=True)
        # Exclusive creation prevents accidental overwrites during retries.
        with destination.open("xb") as handle:
            os.chmod(destination, 0o600)
            handle.write(blob)
        print("SPAKTOK_LOCAL_E2E_SUCCESS", flush=True)
        print(json.dumps({
            "status": "private_glb_ready",
            "file": str(destination),
            "quality_profile": "mobile-preview",
            "source": "operator_test",
            "targets_after_human_QA": ["avatar", "live", "filter", "gift", "world"],
            "publication": "disabled",
            **details,
        }, indent=2), flush=True)
        print("UPLOAD TO STUDIO: Manually select this GLB in Spaktok AI Director.")
        print("AUTOMATIC BROWSER FANOUT: Only after a named TLS GPU endpoint and app config.")
        return 0
    except Exception as exc:
        print("SPAKTOK_LOCAL_E2E_FAILED:", str(exc), file=sys.stderr)
        print("Never resubmit automatically; inspect GPU logs first.", file=sys.stderr)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
