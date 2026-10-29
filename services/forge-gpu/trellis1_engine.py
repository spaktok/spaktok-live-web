"""Microsoft TRELLIS (2024) image-to-GLB backend for Spaktok's own GPU.

Runs the *official* pinned TRELLIS image pipeline, which uses open DINOv2
with registers (not the gated DINOv3 required by TRELLIS.2).
No model or user input is proxied through a third-party hosted demo.
The operator must verify source/submodule licenses before commercial use.
"""
import os
import tempfile
from pathlib import Path

os.environ.setdefault("SPCONV_ALGO", "native")
os.environ.setdefault("PYTORCH_CUDA_ALLOC_CONF", "expandable_segments:True")

MODEL_ID = "microsoft/TRELLIS-image-large"
_PROFILES = {
    # Same extraction API used by the official Microsoft example.py.
    # simplify is the *fraction of faces removed*, not a kept-face target.
    "preview": {"simplify": 0.95, "texture_size": 1024,
                "max_bytes": 35 * 1024 * 1024},
    # Offline only; NOT available through the 35MB browser ticket API.
    "master": {"simplify": 0.90, "texture_size": 2048,
               "max_bytes": 512 * 1024 * 1024},
}
_pipeline = None
_to_glb = None


def initialize():
    """Only run after CUDA, model-license and dependency preflights."""
    global _pipeline, _to_glb
    import torch
    if not torch.cuda.is_available():
        raise RuntimeError("trellis1_cuda_unavailable")
    from trellis.pipelines import TrellisImageTo3DPipeline
    from trellis.utils import postprocessing_utils

    pipeline = TrellisImageTo3DPipeline.from_pretrained(MODEL_ID)
    pipeline.cuda()
    _pipeline = pipeline
    _to_glb = postprocessing_utils.to_glb
    return pipeline


def generate_glb(image, profile="preview"):
    """Generate a real textured GLB; serialize usage in Forge server.py."""
    if profile not in _PROFILES:
        raise ValueError("trellis1_invalid_profile")
    if _pipeline is None or _to_glb is None:
        raise RuntimeError("trellis1_not_initialized")
    import torch
    from glb_quality import inspect_glb_bytes

    options = _PROFILES[profile]
    with torch.inference_mode():
        # Gaussian colors + mesh geometry are both needed for texture baking.
        outputs = _pipeline.run(image, seed=1, formats=["gaussian", "mesh"])
        if (not isinstance(outputs, dict)
                or not outputs.get("gaussian") or not outputs.get("mesh")):
            raise ValueError("trellis1_missing_gaussian_or_mesh")
        glb = _to_glb(
            outputs["gaussian"][0],
            outputs["mesh"][0],
            simplify=options["simplify"],
            texture_size=options["texture_size"],
            verbose=False,
        )

    # Never save a user's face/image/model to a persistent GPU directory.
    with tempfile.TemporaryDirectory(prefix="spaktok-trellis1-") as tmp:
        target = Path(tmp) / "result.glb"
        glb.export(str(target))
        if target.stat().st_size > options["max_bytes"]:
            raise ValueError("trellis1_glb_too_large")
        payload = target.read_bytes()

    # Enforce actual GLB 2.0 JSON/mesh structure; a magic-header test alone
    # cannot prove the file contains any usable 3D geometry.
    audit = inspect_glb_bytes(payload)
    if audit["bytes"] > options["max_bytes"]:
        raise ValueError("trellis1_glb_too_large")
    return payload
