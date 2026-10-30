#!/usr/bin/env python3
"""Owner-operated, one-shot transfer of verified Spaktok GPU GLB into PRIVATE Cloudflare R2.

Reads the existing GLB from Vast.ai and uploads to the existing Spaktok account
ONLY when operator explicitly approves. Prompts for a temporary scoped Cloudflare
REST API Bearer token without echoing it or saving it to disk/shell history.
NO S3 Access Key ID/Secret Access Key token; no public link.
Create a temporary Cloudflare custom API token with Account > Workers R2
Storage > Edit permission, restricted to the Spaktok account, then revoke
after verification. This account-wide permission is broader than one bucket.
"""
from __future__ import annotations

from getpass import getpass
from pathlib import Path
import hashlib
import json
import sys
import urllib.request
import urllib.error

ACCOUNT = "b62ed7e1cf0e1dc886f363573bad4bdb"
BUCKET = "spaktok-private-drafts"
OBJECT = "studio/private/pilot-20261030/33be391ce222f90d00316b26b5ff6c3f21b30f230122d8e87f94b26992f619aa.glb"
MANIFEST = "studio/private/pilot-20261030/manifest.json"
SOURCE = Path("/workspace/spaktok-first.glb")
EXPECTED_SHA256 = "33be391ce222f90d00316b26b5ff6c3f21b30f230122d8e87f94b26992f619aa"
EXPECTED_SIZE = 5343540
TARGETS = ("avatar", "live", "filter", "gift", "world")


def upload(key: str, data: bytes, content_type: str, token: str) -> None:
    url = ("https://api.cloudflare.com/client/v4/accounts/" + ACCOUNT +
           "/r2/buckets/" + BUCKET + "/objects/" + key)
    # Cloudflare REST R2 Upload Object endpoint advertises
    # application/octet-stream as its binary request type.
    # The object's intended MIME type is recorded in our private manifest.
    req = urllib.request.Request(
        url, data=data, method="PUT",
        headers={"Authorization": "Bearer " + token,
                 "Content-Type": "application/octet-stream",
                 "Accept": "application/json",
                 "Content-Length": str(len(data))},
    )
    try:
        with urllib.request.urlopen(req, timeout=120) as response:
            result = json.loads(response.read(65536))
        if not result.get("success"):
            raise RuntimeError("cloudflare_upload_not_successful")
        returned = result.get("result") or {}
        if (returned.get("key") != key or
                str(returned.get("size")) != str(len(data))):
            raise RuntimeError("cloudflare_uploaded_metadata_mismatch_check_r2")
    except urllib.error.HTTPError as exc:
        # Only log Cloudflare's numeric error codes and sanitized messages.
        # Never echo request headers, access tokens or arbitrary HTML.
        errors = []
        try:
            detail = json.loads(exc.read(8192))
            for item in (detail.get("errors") or [])[:3]:
                if isinstance(item, dict):
                    code = item.get("code")
                    message = str(item.get("message", ""))[:160]
                    message = message.replace(token, "[REDACTED]")
                    if isinstance(code, int):
                        errors.append(f"{code}: {message}")
        except (ValueError, UnicodeError, OSError, AttributeError):
            pass
        suffix = " / ".join(errors) if errors else "no_safe_error_detail"
        raise RuntimeError(
            f"cloudflare_r2_upload_http_{exc.code}; cf_errors={suffix}"
        ) from None


def main() -> int:
    if len(sys.argv) != 2 or sys.argv[1] != "--upload-private":
        print("DRY_RUN: no upload. Run with --upload-private after reviewing source.")
        return 0
    if not SOURCE.is_file():
        print("ERROR: private first GLB not found on Vast instance")
        return 2
    data = SOURCE.read_bytes()
    digest = hashlib.sha256(data).hexdigest()
    if len(data) != EXPECTED_SIZE or digest != EXPECTED_SHA256:
        print("ERROR: GLB size or SHA256 does not match verified GPU result")
        return 2
    if (data[:4] != b"glTF" or
            int.from_bytes(data[4:8], "little") != 2 or
            int.from_bytes(data[8:12], "little") != len(data)):
        print("ERROR: invalid binary glTF v2 header")
        return 2
    print("CONFIRMED: tested GLB is present and matches original successful GPU output")
    print("Destination: Spaktok Cloudflare R2 bucket", BUCKET)
    print("Visibility: PRIVATE; no user/public URLs will be created")
    print("Target departments:", ", ".join(TARGETS))
    consent = input("Type UPLOAD to send this GLB to private Spaktok storage: ").strip()
    if consent != "UPLOAD":
        print("Cancelled; no upload")
        return 0
    token = getpass("Paste temporary Cloudflare REST Bearer token, not an R2 S3 secret (hidden): ").strip()
    if len(token) < 20:
        print("ERROR: missing operator token")
        return 2
    try:
        upload(OBJECT, data, "model/gltf-binary", token)
        print("R2_GLB_UPLOADED_PRIVATE", flush=True)
        manifest = {
            "schema": "spaktok-private-gpu-fanout-v1",
            "asset": {"sha256": digest, "bytes": len(data),
                      "objectKey": OBJECT, "format": "glb",
                      "meshes": 1, "materials": 1, "textures": 2},
            "pipeline": ["TRELLIS.2-4B", "DINOv3", "ZhengPeng7/BiRefNet"],
            "targets": [
                {"department": target, "status": "private-review",
                 "publish": False, "assetObjectKey": OBJECT}
                for target in TARGETS
            ],
            "disclaimer": "Private GPU test; licensing, rights, rigging, animation, AR, Android QA and moderation not verified.",
            "visibleToPublic": False,
        }
        upload(MANIFEST, json.dumps(manifest,ensure_ascii=False,sort_keys=True).encode(),
               "application/json", token)
        print("R2_FANOUT_MANIFEST_UPLOADED_PRIVATE", flush=True)
        print("SHA256:", digest)
        print("No public release, no browser deployment, no native distribution")
        return 0
    except Exception as exc:
        print("UPLOAD_FAILED:", str(exc))
        print("Check Cloudflare R2 object before retry; partial upload may have succeeded.")
        return 3
    finally:
        token = ""


if __name__ == "__main__":
    raise SystemExit(main())
