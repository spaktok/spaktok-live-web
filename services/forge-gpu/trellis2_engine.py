"""TRELLIS.2 high-fidelity image-to-3D backend for one NVIDIA A100.

Install from the OFFICIAL Microsoft repo in a separate vetted environment.
The Python package is available only after its CUDA extensions have been built.
Runs inside the already authenticated services/forge-gpu/server.py FastAPI app.
No creator inputs or outputs are persisted beyond a temporary GLB export.
"""
import os
import tempfile
from pathlib import Path

# Must be set before importing torch for best allocation behavior.
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")
os.environ.setdefault("OPENCV_IO_ENABLE_OPENEXR", "1")

_pipeline = None


def initialize():
    global _pipeline
    import torch
    from trellis2.pipelines import Trellis2ImageTo3DPipeline
    if not torch.cuda.is_available():
        raise RuntimeError("trellis2_cuda_unavailable")
    _pipeline = Trellis2ImageTo3DPipeline.from_pretrained(
        "microsoft/TRELLIS.2-4B"
    )
    _pipeline.cuda()
    return _pipeline


def generate_glb(image, profile="preview"):
    """Use the verified upstream pipeline with conservative GLB output budgets.

    Quality and memory must be measured on the actual host before raising
    texture resolution or polygon counts for professional master assets.
    """
    import o_voxel
    import torch
    if profile not in ("preview", "master"):
        raise ValueError("trellis2_profile_invalid")
    # Keep web previews small; allow separate high-detail masters for
    # offline artist review/export, never direct through the 35MB browser API.
    decimation_target, texture_size, max_bytes = (
        (250000, 2048, 35 * 1024 * 1024) if profile == "preview"
        else (1000000, 4096, 512 * 1024 * 1024)
    )
    if _pipeline is None:
        raise RuntimeError("trellis2_not_initialized")
    with torch.inference_mode():
        result = _pipeline.run(image)
        if not result:
            raise ValueError("trellis2_no_mesh")
        mesh = result[0]
        mesh.simplify(16777216)  # upstream nvdiffrast limit
        glb = o_voxel.postprocess.to_glb(
            vertices=mesh.vertices,
            faces=mesh.faces,
            attr_volume=mesh.attrs,
            coords=mesh.coords,
            attr_layout=mesh.layout,
            voxel_size=mesh.voxel_size,
            aabb=[[-0.5, -0.5, -0.5], [0.5, 0.5, 0.5]],
            decimation_target=decimation_target,
            texture_size=texture_size,
            remesh=True,
            remesh_band=1,
            remesh_project=0,
            verbose=False,
        )
    # Use transient storage; do not persist private user assets on the GPU.
    with tempfile.TemporaryDirectory(prefix="spaktok-forge-") as tmp:
        output = Path(tmp) / "result.glb"
        glb.export(str(output), extension_webp=False)
        payload = output.read_bytes()
    if len(payload) < 28 or len(payload) > max_bytes:
        raise ValueError("trellis2_glb_size_out_of_bounds")
    if payload[:4] != b"glTF" or int.from_bytes(payload[4:8], "little") != 2:
        raise ValueError("trellis2_invalid_glb_header")
    if int.from_bytes(payload[8:12], "little") != len(payload):
        raise ValueError("trellis2_glb_length_mismatch")
    return payload
