#!/usr/bin/env python3
"""Low-cost *partial* checkpoint diagnostic for the existing Vast GPU.

Does not start a network server, create a GLB, run diffusion or call the GPU
generation endpoint. It tests background segmentation and DINOv3 conditioning
on the same test image that failed with HTTP 503. GPU rental itself is paid.
"""
from __future__ import annotations

import argparse
import json
import os
import sys
from pathlib import Path
import traceback

TRELLIS_ROOT = Path("/workspace/TRELLIS.2")
sys.path.insert(0, str(TRELLIS_ROOT))


def event(stage: str, **metadata) -> None:
    print(json.dumps({"spaktok_stage": stage, **metadata}), flush=True)


def safe_error(stage: str, exc: Exception) -> None:
    frames = traceback.extract_tb(exc.__traceback__)
    point = frames[-1] if frames else None
    event("diagnostic_failed", failed_stage=stage,
          error_type=type(exc).__name__,
          source=Path(point.filename).name if point else None,
          function=point.name if point else None,
          line=point.lineno if point else None)
    # Do not print exception str, exception args, HF token or model traceback.


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--image", default=str(TRELLIS_ROOT /
                                              "assets/example_image/T.png"))
    parser.add_argument("--execute", action="store_true",
                        help="Explicitly load cached models and test conditioning; no GLB")
    args = parser.parse_args()
    source = Path(args.image)
    if not source.is_file() or source.suffix.lower() not in (".png", ".jpg", ".jpeg", ".webp"):
        event("source_invalid")
        return 2
    if not args.execute:
        event("dry_run_only", image=source.name, no_gpu_generation=True)
        return 0
    if os.environ.get("CONDA_PREFIX") != "/workspace/trellis2-env":
        event("wrong_conda_environment")
        return 2
    import torch
    from PIL import Image
    import trellis2_engine
    stage = "load_model"
    try:
        event("loading_cached_checkpoint", no_diffusion=True)
        trellis2_engine.load_model_once(torch)
        pipeline = trellis2_engine._pipeline
        assert pipeline is not None
        stage = "background_segmentation"
        event("starting_background_segmentation")
        with Image.open(source) as f:
            rgba = f.convert("RGBA")
        # Same branch as TRELLIS.2's normal run, using owner-approved
        # ZhengPeng7/BiRefNet for nontransparent images.
        prepared = pipeline.preprocess_image(rgba)
        event("background_segmentation_ok", width=prepared.width,
              height=prepared.height)
        stage = "dinov3_image_conditioning"
        event("starting_dinov3_image_conditioning")
        with torch.inference_mode():
            cond = pipeline.get_cond([prepared], 512)
        event("dinov3_image_conditioning_ok",
              shape=[int(n) for n in cond["cond"].shape])
        event("partial_diagnostic_passed",
              note="3D sampling, GLB and full job NOT tested")
        return 0
    except Exception as exc:
        safe_error(stage, exc)
        return 3


if __name__ == "__main__":
    raise SystemExit(main())
