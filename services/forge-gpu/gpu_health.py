"""Proof-of-operator challenge for short-lived Vast.ai/RunPod GPU endpoints.

The public /health route must not be used as an identity proof without this
HMAC challenge. No operator key is transmitted to the browser or remote server.
"""
import hashlib
import hmac
import re

def sign_ready_health(nonce: str, secret: str, engine: str = 'stable-fast-3d') -> str:
    if not isinstance(secret, str) or len(secret) < 32:
        raise ValueError("gpu_secret_unconfigured")
    if not re.fullmatch(r"[a-f0-9]{32}", nonce or ""):
        raise ValueError("gpu_health_nonce_invalid")
    if engine not in ('stable-fast-3d', 'trellis1', 'trellis2'):
        raise ValueError('gpu_engine_invalid')
    payload = f"forge-health-v1:{nonce}:{engine}:ready"
    return hmac.new(secret.encode("utf-8"), payload.encode("ascii"), hashlib.sha256).hexdigest()
