"""Spaktok Forge GPU inference — operator owned, optional, no Rodin API.

Run inside the OFFICIAL Stable Fast 3D environment after accepting its model
license. This service does not download/storage log private images permanently.
ASGI multipart may temporarily spool large requests; deploy on encrypted
ephemeral storage and never enable access logs containing user content.

Required environment:
  FORGE_GPU_TOKEN = securely generated >=32-character secret
  HF_TOKEN = gated model repository access (if required)
  CUDA-capable GPU (recommended >=7 GB VRAM; test on your own hardware)
  PORT = 8000
"""
import asyncio
import io
import os
import secrets
import hashlib
import time
import json

import torch
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import Response
from PIL import Image, ImageOps, UnidentifiedImageError
from gpu_preflight import require_compatible_gpu
from gpu_ticket import validate_gpu_ticket, InvalidGPUTicket

MAX_PHOTO = 8 * 1024 * 1024
MAX_GLB = 35 * 1024 * 1024
app = FastAPI(title="Spaktok Forge GPU", docs_url=None, redoc_url=None)
# No wildcard origins. Set to the EXACT Spaktok creator website origin,
# e.g. https://v0-spaktok-elite-app.vercel.app, when trial is approved.
_BROWSER_ORIGIN = os.environ.get("FORGE_GPU_ALLOWED_ORIGIN", "")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_BROWSER_ORIGIN] if _BROWSER_ORIGIN.startswith("https://") else [],
    allow_methods=["POST"],
    allow_headers=["Authorization", "Content-Type"],
    max_age=300,
)
MAX_MULTIPART = MAX_PHOTO + 32768
_gpu_lock = asyncio.Lock()
_ticket_lock = asyncio.Lock()
_used_tickets: dict[str, int] = {}
_ENGINE_NAME = os.environ.get("FORGE_GPU_ENGINE", "stable-fast-3d")
_model = None
_rembg_session = None
_remove_background_fn = None
_resize_foreground_fn = None


@app.middleware("http")
async def admission_guard(request: Request, call_next):
    """Authorize before multipart spooling and burn a short-lived grant once."""
    if request.url.path == "/v1/generate":
        # Browser CORS preflight contains no authorization token.
        if request.method == "OPTIONS":
            return await call_next(request)
        if request.method != "POST":
            return Response(status_code=405, content="method_not_allowed")
        token = os.environ.get("FORGE_GPU_TOKEN", "")
        incoming = request.headers.get("authorization", "")
        if len(token) < 32:
            return Response(status_code=503, content="gpu_secret_unconfigured")
        operator = secrets.compare_digest(incoming, "Bearer " + token)
        claim = None
        if not operator:
            try:
                claim = validate_gpu_ticket(
                    incoming, token, _BROWSER_ORIGIN,
                    request.headers.get("origin", ""),
                )
            except InvalidGPUTicket:
                return Response(status_code=401, content="invalid_gpu_ticket")
        raw_length = request.headers.get("content-length", "")
        if not raw_length.isdigit():
            return Response(status_code=411, content="content_length_required")
        size = int(raw_length)
        if size < 128 or size > MAX_MULTIPART:
            return Response(status_code=413, content="request_too_large")
        if claim:
            # In-memory replay guard is appropriate for this one-worker,
            # disposable one-hour trial ONLY. Production requires durable
            # nonce admission (e.g. a Cloudflare Durable Object).
            async with _ticket_lock:
                now = int(time.time())
                for key, expiry in list(_used_tickets.items()):
                    if expiry <= now:
                        del _used_tickets[key]
                if claim["nonce"] in _used_tickets:
                    return Response(status_code=409, content="ticket_already_used")
                if len(_used_tickets) >= 256:
                    return Response(status_code=429, content="gpu_ticket_admission_full")
                _used_tickets[claim["nonce"]] = claim["exp"]
            request.state.gpu_ticket = claim
    return await call_next(request)


@app.on_event("startup")
def load_model_once():
    global _model, _rembg_session, _remove_background_fn, _resize_foreground_fn
    token = os.environ.get("FORGE_GPU_TOKEN", "")
    if len(token) < 32:
        raise RuntimeError("FORGE_GPU_TOKEN must be set to >=32 characters")
    # This catches Blackwell sm_120 with CUDA 12.1/PyTorch 2.4 before
    # downloading gated weights or burning paid compute on a broken kernel.
    if _ENGINE_NAME not in ("stable-fast-3d", "trellis-v1", "trellis2"):
        raise RuntimeError("unsupported_forge_gpu_engine")
    require_compatible_gpu(torch)
    if _ENGINE_NAME == "trellis2":
        import trellis2_engine
        trellis2_engine.load_model_once(torch)
        _model = trellis2_engine
        return
    if _ENGINE_NAME == "trellis-v1":
        import trellis_v1_engine
        trellis_v1_engine.load_model_once(torch)
        _model = trellis_v1_engine
        return
    import rembg
    # Loading custom SF3D CUDA modules before the architecture preflight
    # can fail expensively on an RTX PRO 6000 sm_120 with old cu121 torch.
    from sf3d.system import SF3D
    from sf3d.utils import remove_background, resize_foreground
    _remove_background_fn = remove_background
    _resize_foreground_fn = resize_foreground
    _model = SF3D.from_pretrained(
        "stabilityai/stable-fast-3d",
        config_name="config.yaml", weight_name="model.safetensors",
    )
    _model.to("cuda")
    _model.eval()
    _rembg_session = rembg.new_session()


@app.get("/health")
async def health():
    return {"ready": _model is not None, "engine": _ENGINE_NAME,
            "no_persistent_images": True}


def _make_glb(photo: bytes, profile: str = "mobile-preview",
              job_id: str = "operator-direct") -> bytes:
    """Inference is serialized to avoid OOM and uncontrolled GPU concurrency."""
    if _ENGINE_NAME == "trellis2":
        return _model.make_glb(photo, profile=profile, job_id=job_id)
    if _ENGINE_NAME == "trellis-v1":
        return _model.make_glb(photo, profile=profile)
    with Image.open(io.BytesIO(photo)) as source:
        if source.width < 64 or source.height < 64 or (
            source.width * source.height > 4096 * 4096
        ):
            raise ValueError("unsupported dimensions")
        source = ImageOps.exif_transpose(source)
        rgba = source.convert("RGBA")
    # Preserve creator-supplied transparent cutouts instead of wasting
    # extra segmentation on an image which already has an alpha mask.
    prepared = (rgba if rgba.getextrema()[3][0] < 255 else
                _remove_background_fn(rgba, _rembg_session))
    prepared = _resize_foreground_fn(prepared, .85)
    # Turing GPUs do not support BF16. The official CLI uses BF16 but
    # non-BF16 CUDA GPUs need the FP16 inference path.
    dtype = (torch.bfloat16 if torch.cuda.is_bf16_supported()
             else torch.float16)
    with torch.no_grad():
        with torch.autocast(device_type="cuda", dtype=dtype):
            mesh, _meta = _model.run_image(
                [prepared], bake_resolution=1024,
                remesh="none", vertex_count=-1,
            )
    payload = mesh.export(file_type="glb", include_normals=True)
    if not isinstance(payload, bytes) or not 28 <= len(payload) <= MAX_GLB:
        raise ValueError("invalid or oversized GLB")
    return payload


@app.post("/v1/generate")
async def generate(request: Request, image: UploadFile = File(...)):
    if image.content_type not in ("image/png", "image/jpeg", "image/webp"):
        raise HTTPException(status_code=415, detail="unsupported_image")
    data = await image.read(MAX_PHOTO + 1)
    await image.close()
    if len(data) < 128 or len(data) > MAX_PHOTO:
        raise HTTPException(status_code=413, detail="invalid_image_size")
    ticket = getattr(request.state, "gpu_ticket", None)
    if ticket and (
        image.content_type != ticket["mime"]
        or len(data) != ticket["size"]
        or hashlib.sha256(data).hexdigest() != ticket["sha256"]
    ):
        raise HTTPException(status_code=422, detail="gpu_ticket_image_mismatch")
    if _gpu_lock.locked():
        raise HTTPException(status_code=429, detail="gpu_busy_retry_later")
    try:
        with Image.open(io.BytesIO(data)) as probe:
            if probe.format not in ("PNG", "JPEG", "WEBP"):
                raise ValueError("unsupported image encoding")
        # One GPU job at a time, no queue of parallel GPU allocations.
        async with _gpu_lock:
            profile = ticket.get("profile", "mobile-preview") if ticket else "mobile-preview"
            job_id = ticket["nonce"] if ticket else "operator-direct"
            print(json.dumps({"event":"spaktok_gpu_stage",
              "job":job_id,"stage":"image_received","at":int(time.time())}),
              flush=True)
            result = await asyncio.to_thread(_make_glb, data, profile, job_id)
    except (ValueError, UnidentifiedImageError):
        raise HTTPException(status_code=422, detail="image_or_glb_invalid")
    except Exception:
        print(json.dumps({"event":"spaktok_gpu_stage",
            "stage":"inference_failed","at":int(time.time())}),flush=True)
        # Never leak model stack traces, local paths or source content.
        raise HTTPException(status_code=503, detail="inference_unavailable")
    print(json.dumps({"event":"spaktok_gpu_stage",
        "stage":"private_glb_delivered","at":int(time.time()),
        "bytes":len(result)}),flush=True)
    return Response(
        content=result,
        media_type="model/gltf-binary",
        headers={"cache-control": "private, no-store",
                 "x-content-type-options": "nosniff"},
    )
