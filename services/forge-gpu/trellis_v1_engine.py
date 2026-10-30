"""Image-to-3D with ORIGINAL Microsoft TRELLIS (DINOv2, NOT DINOv3).

This module uses the official TRELLIS-image-large checkpoint and its original
mesh+gaussian -> textured GLB exporter. No TRELLIS.2 import or DINOv3 model.
Loaded once on a single operator-controlled GPU. Unverified until a real GPU
trial is run; do not enable production traffic on that assumption.
"""
from __future__ import annotations

import io
import os
import tempfile

MODEL_ID = "microsoft/TRELLIS-image-large"
MIN_VRAM = 16 * 1024**3
MAX_GLB = 35 * 1024**2
_profiles = {
    "mobile-preview": (0.95, 1024),
    "detail-preview": (0.90, 2048),
}
_pipeline = None


def check_capacity(torch_module) -> None:
    props = torch_module.cuda.get_device_properties(0)
    if props.total_memory < MIN_VRAM:
        raise RuntimeError("original_trellis_requires_16gib_vram")


def load_model_once(torch_module) -> None:
    global _pipeline
    check_capacity(torch_module)
    # Official TRELLIS recommends the native spconv path for single requests.
    os.environ.setdefault("SPCONV_ALGO", "native")
    from trellis.pipelines import TrellisImageTo3DPipeline
    pipeline = TrellisImageTo3DPipeline.from_pretrained(MODEL_ID)
    pipeline.cuda()
    _pipeline = pipeline


def make_glb(photo: bytes, profile: str = "mobile-preview") -> bytes:
    if profile not in _profiles:
        raise ValueError("unsupported_original_trellis_profile")
    if _pipeline is None:
        raise RuntimeError("original_trellis_model_not_ready")
    from PIL import Image, ImageOps
    import torch
    from trellis.utils import postprocessing_utils

    with Image.open(io.BytesIO(photo)) as src:
        if (src.width < 64 or src.height < 64 or
                src.width > 4096 or src.height > 4096):
            raise ValueError("unsupported_dimensions")
        image = ImageOps.exif_transpose(src).convert("RGBA")

    simplify, texture_size = _profiles[profile]
    # Pretrained ORIGINAL TRELLIS uses DINOv2, not DINOv3. Both gaussian
    # appearance and mesh geometry are required by the official GLB exporter.
    with torch.inference_mode():
        results = _pipeline.run(
            image, seed=42, formats=["mesh", "gaussian"],
        )
        glb = postprocessing_utils.to_glb(
            results["gaussian"][0],
            results["mesh"][0],
            simplify=simplify,
            texture_size=texture_size,
        )
    with tempfile.TemporaryDirectory(prefix="spaktok-trellis-v1-") as directory:
        destination = os.path.join(directory, "result.glb")
        glb.export(destination)
        if not 28 <= os.path.getsize(destination) <= MAX_GLB:
            raise ValueError("invalid_or_oversized_glb")
        with open(destination, "rb") as file:
            data = file.read(MAX_GLB + 1)
    if not data.startswith(b"glTF") or len(data) > MAX_GLB:
        raise ValueError("invalid_glb_header_or_size")
    return data
