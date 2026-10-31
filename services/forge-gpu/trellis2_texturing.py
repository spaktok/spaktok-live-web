"""Shape-conditioned PBR re-texturing (official Trellis2TexturingPipeline).

Rodin-style "keep my geometry, regenerate the materials from a reference".
Opt-in with FORGE_GPU_RETEXTURE_ENABLED=yes; loads a second pipeline, so it
is only permitted on >=40 GiB cards. Mesh validation is pure Python so the
contract is testable on CPU-only CI.
"""
from __future__ import annotations

import io
import os
import struct
import tempfile

MODEL_ID = "microsoft/TRELLIS.2-4B"
MAX_MESH_BYTES = 64 * 1024 * 1024
MAX_MESH_FACES = 2_000_000
MIN_RETEXTURE_VRAM_BYTES = 40 * 1024 * 1024 * 1024
MAX_OUTPUT_BYTES = 256 * 1024 * 1024
_pipeline = None


def enabled() -> bool:
    return os.environ.get("FORGE_GPU_RETEXTURE_ENABLED") == "yes"


def sniff_mesh_format(data: bytes) -> str:
    """Return 'glb' or 'ply' from magic bytes; never trust filename/MIME."""
    if not isinstance(data, (bytes, bytearray)) or not 64 <= len(data) <= MAX_MESH_BYTES:
        raise ValueError("invalid_mesh_size")
    if data[:4] == b"glTF":
        version, length = struct.unpack_from("<II", data, 4)
        if version != 2 or length != len(data):
            raise ValueError("invalid_glb_header")
        return "glb"
    if data[:4] == b"ply\n" or data[:5] == b"ply\r\n":
        return "ply"
    raise ValueError("unsupported_mesh_format")


def load_model_once(torch_module) -> None:
    global _pipeline
    if not enabled():
        return
    if torch_module.cuda.get_device_properties(0).total_memory < MIN_RETEXTURE_VRAM_BYTES:
        raise RuntimeError("retexture_requires_at_least_40gib_vram")
    from trellis2.pipelines import Trellis2TexturingPipeline
    pipeline = Trellis2TexturingPipeline.from_pretrained(
        MODEL_ID, config_file="texturing_pipeline.json")
    pipeline.cuda()
    _pipeline = pipeline


def ready() -> bool:
    return _pipeline is not None


def retexture(photo: bytes, mesh_bytes: bytes, job_id: str) -> bytes:
    if _pipeline is None:
        raise RuntimeError("retexture_model_not_ready")
    fmt = sniff_mesh_format(mesh_bytes)
    import torch
    import trimesh
    from PIL import Image, ImageOps

    with Image.open(io.BytesIO(photo)) as src:
        if src.width < 64 or src.height < 64 or src.width * src.height > 4096**2:
            raise ValueError("unsupported_dimensions")
        image = ImageOps.exif_transpose(src).convert("RGBA")

    loaded = trimesh.load(io.BytesIO(mesh_bytes), file_type=fmt, force="mesh",
                          process=False)
    if not isinstance(loaded, trimesh.Trimesh) or len(loaded.faces) == 0:
        raise ValueError("mesh_has_no_faces")
    if len(loaded.faces) > MAX_MESH_FACES:
        raise ValueError("mesh_too_dense")

    with torch.inference_mode():
        output = _pipeline.run(loaded, image)
    with tempfile.TemporaryDirectory(prefix="spaktok-retex-") as tmp:
        path = os.path.join(tmp, "textured.glb")
        output.export(path, extension_webp=True)
        size = os.path.getsize(path)
        if not 28 <= size <= MAX_OUTPUT_BYTES:
            raise ValueError("invalid_or_oversized_glb")
        with open(path, "rb") as handle:
            return handle.read()
