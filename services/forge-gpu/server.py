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
import time

import rembg
import torch
from fastapi import FastAPI, File, HTTPException, Request, UploadFile
from fastapi.responses import Response
from PIL import Image, ImageOps, UnidentifiedImageError
from sf3d.system import SF3D
from sf3d.utils import remove_background, resize_foreground

MAX_PHOTO = 8 * 1024 * 1024
MAX_GLB = 35 * 1024 * 1024
app = FastAPI(title="Spaktok Forge GPU", docs_url=None, redoc_url=None)
MAX_MULTIPART = MAX_PHOTO + 32768
_gpu_lock = asyncio.Lock()
_model = None
_rembg_session = None


@app.middleware("http")
async def admission_guard(request: Request, call_next):
    """Reject unauthenticated and oversized bodies BEFORE multipart spooling."""
    if request.url.path == "/v1/generate":
        token = os.environ.get("FORGE_GPU_TOKEN", "")
        incoming = request.headers.get("authorization", "")
        if len(token) < 32 or not secrets.compare_digest(
            incoming, "Bearer " + token
        ):
            return Response(status_code=401, content="unauthorized")
        raw_length = request.headers.get("content-length", "")
        if not raw_length.isdigit():
            return Response(status_code=411, content="content_length_required")
        size = int(raw_length)
        if size < 128 or size > MAX_MULTIPART:
            return Response(status_code=413, content="request_too_large")
        if request.method != "POST":
            return Response(status_code=405, content="method_not_allowed")
    return await call_next(request)


@app.on_event("startup")
def load_model_once():
    global _model, _rembg_session
    token = os.environ.get("FORGE_GPU_TOKEN", "")
    if len(token) < 32:
        raise RuntimeError("FORGE_GPU_TOKEN must be set to >=32 characters")
    if not torch.cuda.is_available():
        raise RuntimeError("Spaktok GPU mode needs NVIDIA CUDA; refuse CPU paid work")
    _model = SF3D.from_pretrained(
        "stabilityai/stable-fast-3d",
        config_name="config.yaml", weight_name="model.safetensors",
    )
    _model.to("cuda")
    _model.eval()
    _rembg_session = rembg.new_session()


@app.get("/health")
async def health():
    return {"ready": _model is not None, "engine": "stable-fast-3d",
            "no_persistent_images": True}


def _make_glb(photo: bytes) -> bytes:
    """Inference is serialized to avoid OOM and uncontrolled GPU concurrency."""
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
                remove_background(rgba, _rembg_session))
    prepared = resize_foreground(prepared, .85)
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
async def generate(image: UploadFile = File(...)):
    if image.content_type not in ("image/png", "image/jpeg", "image/webp"):
        raise HTTPException(status_code=415, detail="unsupported_image")
    data = await image.read(MAX_PHOTO + 1)
    await image.close()
    if len(data) < 128 or len(data) > MAX_PHOTO:
        raise HTTPException(status_code=413, detail="invalid_image_size")
    if _gpu_lock.locked():
        raise HTTPException(status_code=429, detail="gpu_busy_retry_later")
    try:
        with Image.open(io.BytesIO(data)) as probe:
            if probe.format not in ("PNG", "JPEG", "WEBP"):
                raise ValueError("unsupported image encoding")
        # One GPU job at a time, no queue of parallel GPU allocations.
        async with _gpu_lock:
            result = await asyncio.to_thread(_make_glb, data)
    except (ValueError, UnidentifiedImageError):
        raise HTTPException(status_code=422, detail="image_or_glb_invalid")
    except Exception:
        # Never leak model stack traces, local paths or source content.
        raise HTTPException(status_code=503, detail="inference_unavailable")
    return Response(
        content=result,
        media_type="model/gltf-binary",
        headers={"cache-control": "private, no-store",
                 "x-content-type-options": "nosniff"},
    )
