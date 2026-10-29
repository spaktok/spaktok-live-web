"""Microsoft TRELLIS (2024) image-to-GLB backend for Spaktok's own GPU.

Runs the *official* pinned TRELLIS image pipeline, which uses open DINOv2
with registers (not the gated DINOv3 required by TRELLIS.2).
No model or user input is proxied through a third-party hosted demo.
The operator must verify source/submodule licenses before commercial use.
"""
import json
import os
import re
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


def _checkpoint_patterns(manifest: dict) -> list[str]:
    """Select exact necessary files, not all 3D checkpoints in the repo."""
    model_files = manifest.get("args", {}).get("models", {})
    if not isinstance(model_files, dict) or not model_files:
        raise ValueError("trellis1_empty_model_manifest")
    patterns = ["pipeline.json"]
    for model_name in model_files.values():
        if (not isinstance(model_name, str)
                or not re.fullmatch(r"ckpts/[A-Za-z0-9_/-]+", model_name)
                or ".." in model_name):
            raise ValueError("trellis1_unsafe_checkpoint_name")
        patterns.extend((model_name + ".json", model_name + ".safetensors"))
    return list(dict.fromkeys(patterns))


def _local_checkpoint_dir():
    """Fetch only official weights once; prevent upstream's masked HF 401.

    Upstream Pipeline.from_pretrained catches ANY load error then retries
    'ckpts/modelname' as if it were a Hugging Face repository. That converts
    unrelated errors into misleading RepositoryNotFoundError/401 responses.
    A fully verified local snapshot forces all model files onto the local
    loading path. Subsequent runs reuse the Hugging Face cache.
    """
    from huggingface_hub import hf_hub_download, snapshot_download
    manifest_file = hf_hub_download(repo_id=MODEL_ID, filename="pipeline.json")
    manifest = json.loads(Path(manifest_file).read_text(encoding="utf-8"))
    patterns = _checkpoint_patterns(manifest)
    print("[Spaktok TRELLIS v1] Downloading/verifying official Microsoft checkpoints;",
          (len(patterns) - 1) // 2, "model components; cache is reusable.", flush=True)
    snapshot = Path(snapshot_download(repo_id=MODEL_ID, allow_patterns=patterns))
    for filename in patterns:
        checkpoint = snapshot / filename
        if not checkpoint.is_file() or checkpoint.stat().st_size == 0:
            raise RuntimeError("trellis1_missing_local_checkpoint: " + filename)
    return str(snapshot)


def initialize():
    """Only run after CUDA, model-license and dependency preflights."""
    global _pipeline, _to_glb
    import torch
    if not torch.cuda.is_available():
        raise RuntimeError("trellis1_cuda_unavailable")
    from trellis.pipelines import TrellisImageTo3DPipeline
    from trellis.utils import postprocessing_utils

    # Do not pass the remote repo directly into upstream's broad except:
    # a failure inside models.from_pretrained silently falls back to
    # "ckpts/foo" as a fake HF repository, hiding the actual traceback.
    local_model_dir = _local_checkpoint_dir()
    pipeline = TrellisImageTo3DPipeline.from_pretrained(local_model_dir)
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
