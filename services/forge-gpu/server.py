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
from typing import Optional

from fastapi import FastAPI, File, Form, HTTPException, Request, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse, Response
from PIL import Image, ImageOps, UnidentifiedImageError
from gpu_preflight import require_compatible_gpu
from gpu_ticket import validate_gpu_ticket, validate_job_read_ticket, InvalidGPUTicket

MAX_PHOTO = 8 * 1024 * 1024
MAX_GLB = 35 * 1024 * 1024
app = FastAPI(title="Spaktok Forge GPU", docs_url=None, redoc_url=None)
# No wildcard origins. Set to the EXACT Spaktok creator website origin,
# e.g. https://v0-spaktok-elite-app.vercel.app, when trial is approved.
_BROWSER_ORIGIN = os.environ.get("FORGE_GPU_ALLOWED_ORIGIN", "")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[_BROWSER_ORIGIN] if _BROWSER_ORIGIN.startswith("https://") else [],
    allow_methods=["POST", "GET"],
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


_job_queue = None
JOB_PROFILES = ("studio-hd", "studio-ultra")


@app.middleware("http")
async def admission_guard(request: Request, call_next):
    """Authorize before multipart spooling and burn a short-lived grant once."""
    if request.url.path.startswith("/v1/jobs"):
        # Submit/status are operator-only (server-to-server). The ONLY browser
        # access is GET .../glb with a short-lived signed read grant (sj1),
        # because large GLBs cannot pass through Vercel Functions.
        token = os.environ.get("FORGE_GPU_TOKEN", "")
        if len(token) < 32:
            return Response(status_code=503, content="gpu_secret_unconfigured")
        parts = request.url.path.split("/")
        glb_read = len(parts) == 5 and parts[4] == "glb"
        if glb_read and request.method == "OPTIONS":
            return await call_next(request)
        incoming = request.headers.get("authorization", "")
        if glb_read and request.method == "GET" and incoming.startswith("Bearer sj1."):
            try:
                validate_job_read_ticket(incoming, token, _BROWSER_ORIGIN,
                                         request.headers.get("origin", ""), parts[3])
            except InvalidGPUTicket:
                return Response(status_code=401, content="invalid_job_read_ticket")
            return await call_next(request)
        if not secrets.compare_digest(incoming,
                                      "Bearer " + token):
            return Response(status_code=401, content="operator_token_required")
        if request.method == "POST":
            raw_length = request.headers.get("content-length", "")
            if not raw_length.isdigit():
                return Response(status_code=411, content="content_length_required")
            limit = MAX_MULTIPART + (64 * 1024 * 1024
                                     if request.url.path == "/v1/jobs/retexture" else 0)
            if not 128 <= int(raw_length) <= limit:
                return Response(status_code=413, content="request_too_large")
        return await call_next(request)
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


@app.on_event("startup")
async def start_job_queue():
    global _job_queue
    if _ENGINE_NAME != "trellis2":
        return
    from forge_jobs import JobQueue
    import trellis2_texturing
    trellis2_texturing.load_model_once(torch)
    _job_queue = JobQueue(
        _model.make_glb_async_job,
        workdir=os.environ.get("FORGE_GPU_JOB_DIR", "/tmp/spaktok-forge-jobs"),
        gpu_lock=_gpu_lock,
        max_queue=int(os.environ.get("FORGE_GPU_JOB_QUEUE", "8")),
        ttl_seconds=int(os.environ.get("FORGE_GPU_JOB_TTL", "3600")),
        on_event=lambda event: print(json.dumps({**event, "at": int(time.time())}),
                                     flush=True),
        retexture=trellis2_texturing.retexture if trellis2_texturing.ready() else None,
    )
    _job_queue.start()


@app.on_event("shutdown")
async def stop_job_queue():
    if _job_queue is not None:
        await _job_queue.stop()


@app.get("/health")
async def health():
    return {"ready": _model is not None, "engine": _ENGINE_NAME,
            "hdConfigured": _ENGINE_NAME == "trellis2" and
                os.environ.get("FORGE_GPU_HD_ENABLED") == "yes",
            "asyncJobs": _job_queue is not None,
            "retexture": bool(_job_queue and _job_queue.supports_retexture),
            "no_persistent_images": True}


@app.post("/v1/jobs", status_code=202)
async def submit_job(image: UploadFile = File(...), profile: str = Form("studio-hd"),
                     poly_budget: Optional[int] = Form(None)):
    if _job_queue is None:
        raise HTTPException(status_code=503, detail="async_jobs_unavailable")
    if profile not in JOB_PROFILES:
        raise HTTPException(status_code=422, detail="unsupported_job_profile")
    if os.environ.get("FORGE_GPU_HD_ENABLED") != "yes":
        raise HTTPException(status_code=403, detail="gpu_hd_not_enabled")
    from trellis2_quality import POLY_BUDGETS
    if poly_budget is not None and poly_budget not in POLY_BUDGETS:
        raise HTTPException(status_code=422, detail="unsupported_poly_budget")
    if image.content_type not in ("image/png", "image/jpeg", "image/webp"):
        raise HTTPException(status_code=415, detail="unsupported_image")
    data = await image.read(MAX_PHOTO + 1)
    await image.close()
    if len(data) < 128 or len(data) > MAX_PHOTO:
        raise HTTPException(status_code=413, detail="invalid_image_size")
    try:
        with Image.open(io.BytesIO(data)) as probe:
            if probe.format not in ("PNG", "JPEG", "WEBP"):
                raise ValueError("unsupported image encoding")
    except (ValueError, UnidentifiedImageError):
        raise HTTPException(status_code=422, detail="image_or_glb_invalid")
    from forge_jobs import QueueFull
    try:
        return _job_queue.submit(data, profile, poly_budget)
    except QueueFull:
        raise HTTPException(status_code=429, detail="gpu_job_queue_full")


async def _read_reference_image(image: UploadFile) -> bytes:
    if image.content_type not in ("image/png", "image/jpeg", "image/webp"):
        raise HTTPException(status_code=415, detail="unsupported_image")
    data = await image.read(MAX_PHOTO + 1)
    await image.close()
    if len(data) < 128 or len(data) > MAX_PHOTO:
        raise HTTPException(status_code=413, detail="invalid_image_size")
    try:
        with Image.open(io.BytesIO(data)) as probe:
            if probe.format not in ("PNG", "JPEG", "WEBP"):
                raise ValueError("unsupported image encoding")
    except (ValueError, UnidentifiedImageError):
        raise HTTPException(status_code=422, detail="image_or_glb_invalid")
    return data


@app.post("/v1/jobs/retexture", status_code=202)
async def submit_retexture(image: UploadFile = File(...), mesh: UploadFile = File(...)):
    if _job_queue is None or not _job_queue.supports_retexture:
        raise HTTPException(status_code=503, detail="retexture_unavailable")
    if os.environ.get("FORGE_GPU_HD_ENABLED") != "yes":
        raise HTTPException(status_code=403, detail="gpu_hd_not_enabled")
    from trellis2_texturing import MAX_MESH_BYTES, sniff_mesh_format
    data = await _read_reference_image(image)
    mesh_bytes = await mesh.read(MAX_MESH_BYTES + 1)
    await mesh.close()
    try:
        sniff_mesh_format(mesh_bytes)
    except ValueError:
        raise HTTPException(status_code=422, detail="image_or_glb_invalid")
    from forge_jobs import QueueFull
    try:
        return _job_queue.submit_retexture(data, mesh_bytes)
    except QueueFull:
        raise HTTPException(status_code=429, detail="gpu_job_queue_full")


@app.get("/v1/jobs/{job_id}")
async def job_status(job_id: str):
    status = _job_queue.status(job_id) if _job_queue else None
    if status is None:
        raise HTTPException(status_code=404, detail="job_not_found")
    return status


@app.get("/v1/jobs/{job_id}/glb")
async def job_glb(job_id: str):
    path = _job_queue.result_path(job_id) if _job_queue else None
    if path is None:
        raise HTTPException(status_code=404, detail="job_result_unavailable")
    return FileResponse(path, media_type="model/gltf-binary",
                        headers={"cache-control": "private, no-store",
                                 "x-content-type-options": "nosniff"})


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
    if ticket and ticket.get("profile") == "studio-hd" and (
        _ENGINE_NAME != "trellis2" or os.environ.get("FORGE_GPU_HD_ENABLED") != "yes"
    ):
        raise HTTPException(status_code=403, detail="gpu_hd_not_enabled")
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
    except (ValueError, UnidentifiedImageError) as exc:
        # Only operator-terminal safe metadata. Never log image bytes, token,
        # model URLs, exception messages or full paths in public HTTP responses.
        print(json.dumps({"event":"spaktok_gpu_stage",
            "stage":"image_or_glb_invalid","at":int(time.time()),
            "error_type":type(exc).__name__}),flush=True)
        raise HTTPException(status_code=422, detail="image_or_glb_invalid")
    except Exception as exc:
        # A previous blanket 503 masked the failing component completely.
        # The final traceback *location*, without its message / path / args,
        # lets operators distinguish rembg vs DINOv3 vs CUDA errors safely.
        import traceback
        frames=traceback.extract_tb(exc.__traceback__)
        last=frames[-1] if frames else None
        message=str(exc).lower()
        category=("cuda_out_of_memory" if "out of memory" in message
                  else "model_access_denied" if any(x in message for x in
                  ("gated repo","403 client error","401 client error"))
                  else "cuda_runtime_error" if any(x in message for x in
                  ("cuda error","cublas","cudnn")) else "inference_exception")
        print(json.dumps({"event":"spaktok_gpu_stage",
            "stage":"inference_failed","at":int(time.time()),
            "error_type":type(exc).__name__,"category":category,
            "source_file":os.path.basename(last.filename) if last else None,
            "source_function":last.name if last else None,
            "source_line":last.lineno if last else None}),flush=True)
        # Never leak model stack traces, local paths or source content to clients.
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
