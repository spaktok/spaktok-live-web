"""Verifies single-use, short-lived browser-to-GPU grants; no dependencies.

The Vercel backend issues a SHA-256/HMAC-signed ticket after authenticated
D1 quota reservation. Never send an operator bearer secret to browsers.
"""
from __future__ import annotations

import base64
import hashlib
import hmac
import json
import re
import time
from typing import Any

MAX_IMAGE_BYTES = 8 * 1024 * 1024
MAX_TICKET_BYTES = 1800
_SHA256_RE = re.compile(r"^[a-f0-9]{64}$")
_UUID_RE = re.compile(
    r"^[a-f0-9]{8}-[a-f0-9]{4}-[1-8][a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$"
)

class InvalidGPUTicket(ValueError):
    pass


def validate_gpu_ticket(
    bearer: str, secret: str, allowed_origin: str, actual_origin: str,
    now: int | None = None,
) -> dict[str, Any]:
    if not secret or len(secret) < 32:
        raise InvalidGPUTicket("ticket_config_missing")
    if (not allowed_origin.startswith("https://") or not actual_origin or
        actual_origin != allowed_origin):
        raise InvalidGPUTicket("ticket_origin_mismatch")
    if not bearer.startswith("Bearer st1.") or len(bearer) > MAX_TICKET_BYTES:
        raise InvalidGPUTicket("ticket_format_invalid")
    chunks = bearer.removeprefix("Bearer ").split(".")
    if len(chunks) != 3 or chunks[0] != "st1":
        raise InvalidGPUTicket("ticket_format_invalid")
    body, signature = chunks[1], chunks[2]
    if not body or not signature or not re.fullmatch(r"[a-zA-Z0-9_-]+", body+signature):
        raise InvalidGPUTicket("ticket_base64_invalid")
    check = base64.urlsafe_b64encode(
        hmac.new(secret.encode("utf-8"), body.encode("ascii"), hashlib.sha256).digest()
    ).rstrip(b"=").decode("ascii")
    if not hmac.compare_digest(check, signature):
        raise InvalidGPUTicket("ticket_bad_signature")
    try:
        raw = base64.urlsafe_b64decode(body + "=" * (-len(body) % 4))
        claim = json.loads(raw.decode("utf-8"))
    except (ValueError, UnicodeError) as exc:
        raise InvalidGPUTicket("ticket_invalid_claims") from exc
    if not isinstance(claim, dict):
        raise InvalidGPUTicket("ticket_invalid_claims")
    now = int(time.time()) if now is None else now
    if claim.get("v") != 1 or claim.get("purpose") != "forge-browser-one-use":
        raise InvalidGPUTicket("ticket_wrong_purpose")
    if claim.get("origin") != allowed_origin:
        raise InvalidGPUTicket("ticket_origin_mismatch")
    iat, exp = claim.get("iat"), claim.get("exp")
    if (type(iat) is not int or type(exp) is not int or
        iat < now-180 or iat > now+10 or exp <= now or
        exp > now+180 or exp <= iat or exp-iat > 150):
        raise InvalidGPUTicket("ticket_expired_or_invalid")
    sha = claim.get("sha256")
    if not isinstance(sha, str) or not _SHA256_RE.fullmatch(sha):
        raise InvalidGPUTicket("ticket_invalid_sha256")
    nonce = claim.get("nonce")
    if not isinstance(nonce, str) or not _UUID_RE.fullmatch(nonce):
        raise InvalidGPUTicket("ticket_invalid_nonce")
    size = claim.get("size")
    if type(size) is not int or not 128 <= size <= MAX_IMAGE_BYTES:
        raise InvalidGPUTicket("ticket_invalid_size")
    if claim.get("mime") not in ("image/png","image/jpeg","image/webp"):
        raise InvalidGPUTicket("ticket_invalid_mime")
    return claim
