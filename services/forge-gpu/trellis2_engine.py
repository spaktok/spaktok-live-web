"""Experimental TRELLIS.2 backend for Spaktok Forge's *existing* ticketed API.

Run this from a separately provisioned, owner-operated CUDA environment with
TRELLIS.2 and its dependencies installed. No shell or model download is
triggered by user requests. Source photos and GLB artifacts are transient.
GPU compatibility, model licensing and real inference remain unverified.
"""
from __future__ import annotations

import io
import os
import tempfile

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
    from trellis2.pipelines import Trellis2ImageTo3DPipeline
    pipeline = Trellis2ImageTo3DPipeline.from_pretrained(MODEL_ID)
    pipeline.cuda()
    _pipeline = pipeline


def make_glb(photo: bytes) -> bytes:
    """Produce a private GLB; do not execute any user-provided shell commands."""
    if _pipeline is None:
        raise RuntimeError("trellis2_model_not_ready")
    from PIL import Image, ImageOps
    import torch
    import o_voxel

    with Image.open(io.BytesIO(photo)) as src:
        if src.width < 64 or src.height < 64 or src.width * src.height > 4096**2:
            raise ValueError("unsupported_dimensions")
        image = ImageOps.exif_transpose(src).convert("RGBA")

    # Official inference shape (microsoft/TRELLIS.2 README, Oct 2026).
    # Use official default resolution for this first experimental bridge.
    # Higher resolutions require measured VRAM, runtime and size gates.
    with torch.inference_mode():
        mesh = _pipeline.run(image)[0]
        mesh.simplify(16777216)
        scene = o_voxel.postprocess.to_glb(
            vertices=mesh.vertices,
            faces=mesh.faces,
            attr_volume=mesh.attrs,
            coords=mesh.coords,
            attr_layout=mesh.layout,
            voxel_size=mesh.voxel_size,
            aabb=[[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
            decimation_target=200000,
            texture_size=2048,
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
        byte_size = os.path.getsize(path)
        if not 28 <= byte_size <= MAX_GLB_BYTES:
            raise ValueError("invalid_or_oversized_glb")
        with open(path, "rb") as binary:
            result = binary.read(MAX_GLB_BYTES + 1)
    if result[:4] != b"glTF" or len(result) > MAX_GLB_BYTES:
        raise ValueError("invalid_glb_header_or_size")
    return result
