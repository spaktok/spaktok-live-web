"""Experimental TRELLIS.2 backend for Spaktok Forge's *existing* ticketed API.

Run this from a separately provisioned, owner-operated CUDA environment with
TRELLIS.2 and its dependencies installed. No shell or model download is
triggered by user requests. Source photos and GLB artifacts are transient.
GPU compatibility, model licensing and real inference remain unverified.
"""
from __future__ import annotations

import io
import json
import os
import tempfile
import time

MODEL_ID = "microsoft/TRELLIS.2-4B"
MAX_GLB_BYTES = 35 * 1024 * 1024
MIN_TRELLIS_VRAM_BYTES = 24 * 1024 * 1024 * 1024
_pipeline = None


def check_trellis_capacity(torch_module) -> None:
    """Fast fail before allocating large weights on an undersized rented GPU."""
    properties = torch_module.cuda.get_device_properties(0)
    if properties.total_memory < MIN_TRELLIS_VRAM_BYTES:
        raise RuntimeError("trellis2_requires_at_least_24gib_vram")


def load_model_once(torch_module) -> None:
    """Load the pinned model *once at server startup*, not on each request."""
    global _pipeline
    check_trellis_capacity(torch_module)
    from trellis2.pipelines import Trellis2ImageTo3DPipeline, rembg
    from trellis2_open_rembg import use_open_background_model, OPEN_REMBG_MODEL
    from trellis2_dinov3_compat import install_for_trellis2
    # Backward compatible with transformers encoder nesting and official
    # TRELLIS.2 class behavior; does not modify the Microsoft checkout.
    install_for_trellis2()
    _stage("loading_trellis2_weights_and_dinov3", "startup",
           background_model=OPEN_REMBG_MODEL)
    # Upstream pipeline.json explicitly selects briaai/RMBG-2.0.
    # Replace only the segmentation model; avoid gated BRIA requests.
    with use_open_background_model(rembg):
        pipeline = Trellis2ImageTo3DPipeline.from_pretrained(MODEL_ID)
    pipeline.cuda()
    _pipeline = pipeline
    _stage("model_ready", "startup")


def _stage(name: str, job_id: str, **detail) -> None:
    """Operator-readable progress WITHOUT source images, names or tokens."""
    print(json.dumps({"event": "spaktok_gpu_stage", "job": job_id,
                      "stage": name, "at": int(time.time()), **detail}),
          flush=True)


def make_glb(photo: bytes, profile: str = "mobile-preview",
             job_id: str = "operator-direct") -> bytes:
    """Produce a private GLB; do not execute any user-provided shell commands."""
    if _pipeline is None:
        raise RuntimeError("trellis2_model_not_ready")
    from trellis2_quality import PRESETS, select_trellis2_quality
    # Reject malformed profile before even importing torch or touching CUDA.
    if profile not in PRESETS:
        raise ValueError("unsupported_trellis2_profile")
    import torch
    quality = select_trellis2_quality(
        profile,
        vram_bytes=torch.cuda.get_device_properties(0).total_memory,
        hd_authorized=os.environ.get("FORGE_GPU_HD_ENABLED") == "yes",
    )
    return generate_with_quality(photo, quality, job_id=job_id)


MAX_ASYNC_GLB_BYTES = 256 * 1024 * 1024


def make_glb_async_job(photo: bytes, profile: str, poly_budget, job_id: str) -> bytes:
    """Operator async queue entry: permits async-only presets (studio-ultra)."""
    if _pipeline is None:
        raise RuntimeError("trellis2_model_not_ready")
    from trellis2_quality import PRESETS, select_trellis2_quality, with_poly_budget
    if profile not in PRESETS:
        raise ValueError("unsupported_trellis2_profile")
    import torch
    quality = select_trellis2_quality(
        profile,
        vram_bytes=torch.cuda.get_device_properties(0).total_memory,
        hd_authorized=os.environ.get("FORGE_GPU_HD_ENABLED") == "yes",
        async_operator_run=True,
    )
    if poly_budget is not None:
        quality = with_poly_budget(quality, int(poly_budget))
    return generate_with_quality(photo, quality, job_id=job_id,
                                 max_bytes=MAX_ASYNC_GLB_BYTES)


def generate_with_quality(photo: bytes, quality, *, job_id: str,
                          max_bytes: int = MAX_GLB_BYTES) -> bytes:
    """Shared generation core. Callers MUST pass an already-selected preset."""
    if _pipeline is None:
        raise RuntimeError("trellis2_model_not_ready")
    profile = quality.profile
    import torch
    from PIL import Image, ImageOps
    import o_voxel

    with Image.open(io.BytesIO(photo)) as src:
        if src.width < 64 or src.height < 64 or src.width * src.height > 4096**2:
            raise ValueError("unsupported_dimensions")
        image = ImageOps.exif_transpose(src).convert("RGBA")
    _stage("image_validated", job_id, profile=profile,
           resolution=quality.pipeline_type, bytes=len(photo))

    # Official TRELLIS.2 pipeline names: 512 / 1024_cascade.
    # A100 HD remains opt-in and UNBENCHMARKED. Never auto-upgrade a job.
    with torch.inference_mode():
        # Preserve signed, finite quality selection throughout inference.
        _stage("background_segmentation_started", job_id)
        # Identical official preprocessing, but split from generation so
        # operator can locate 503 causes before resubmitting expensive jobs.
        prepared = _pipeline.preprocess_image(image)
        _stage("background_segmentation_completed", job_id)
        _stage("dinov3_conditioning_and_generation_started", job_id)
        mesh = _pipeline.run(
            prepared, pipeline_type=quality.pipeline_type,
            preprocess_image=False
        )[0]
        _stage("geometry_and_pbr_generated", job_id)
        mesh.simplify(16777216)
        _stage("glb_texture_baking_started", job_id)
        scene = o_voxel.postprocess.to_glb(
            vertices=mesh.vertices,
            faces=mesh.faces,
            attr_volume=mesh.attrs,
            coords=mesh.coords,
            attr_layout=mesh.layout,
            voxel_size=mesh.voxel_size,
            aabb=[[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
            decimation_target=quality.decimation_target,
            texture_size=quality.texture_size,
            remesh=True,
            remesh_band=1,
            remesh_project=0,
            verbose=False,
        )

    # Match the upstream .export(path, extension_webp=True) API, writing only
    # inside a restrictive and automatically deleted ephemeral directory.
    with tempfile.TemporaryDirectory(prefix="spaktok-trellis2-") as folder:
        path = os.path.join(folder, "generated.glb")
        scene.export(path, extension_webp=True)
        _stage("glb_exported", job_id, bytes=os.path.getsize(path))
        byte_size = os.path.getsize(path)
        if not 28 <= byte_size <= max_bytes:
            raise ValueError("invalid_or_oversized_glb")
        with open(path, "rb") as binary:
            result = binary.read(max_bytes + 1)
    if (result[:4] != b"glTF" or len(result) > max_bytes or
            int.from_bytes(result[4:8], "little") != 2 or
            int.from_bytes(result[8:12], "little") != len(result)):
        raise ValueError("invalid_glb_header_or_size")
    _stage("glb_ready_for_private_import", job_id,
           profile=quality.profile, bytes=len(result))
    return result
