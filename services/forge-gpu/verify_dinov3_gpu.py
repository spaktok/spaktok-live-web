#!/usr/bin/env python3
"""Bounded local smoke test: already-approved DINOv3 checkpoint on Vast A100.

No auth/login, secret reads, image uploads, model downloads or GLB generation.
Outputs only stage codes and derived tensor dimensions, never credential paths.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import sys


MODEL = "facebook/dinov3-vitl16-pretrain-lvd1689m"
WEIGHTS_BYTES = 1212559808


def event(stage: str, **metadata):
    print(json.dumps({"stage": stage, **metadata}, separators=(",", ":")),
          flush=True)


def cached_files() -> bool:
    home = Path(os.environ.get("HF_HOME", "/workspace/.hf_home"))
    snapshots = home / "hub" / "models--facebook--dinov3-vitl16-pretrain-lvd1689m" / "snapshots"
    if not snapshots.is_dir():
        return False
    # Hugging Face snapshots are identified by immutable hexadecimal commits.
    import re
    for folder in snapshots.iterdir():
        if (folder.is_dir() and re.fullmatch(r"[0-9a-f]{40}", folder.name)
                and (folder / "config.json").is_file()
                and (folder / "model.safetensors").is_file()
                and (folder / "model.safetensors").stat().st_size == WEIGHTS_BYTES):
            return True
    return False


def main() -> int:
    parser = argparse.ArgumentParser()
    parser.add_argument("--mode", choices=("cache", "cuda"), default="cuda")
    args = parser.parse_args()
    if not cached_files():
        event("checkpoint_not_present_in_selected_hf_home")
        return 2
    event("dinov3_checkpoint_present", weightsBytes=WEIGHTS_BYTES)
    if args.mode == "cache":
        return 0
    try:
        import torch
        from transformers import DINOv3ViTModel

        if not torch.cuda.is_available():
            event("cuda_unavailable_in_trellis_conda")
            return 3
        # Important: local_files_only prevents a credential or network request.
        model = DINOv3ViTModel.from_pretrained(MODEL, local_files_only=True)
        model = model.eval().to(device="cuda", dtype=torch.float16)
        with torch.inference_mode():
            pixels = torch.zeros((1, 3, 224, 224), device="cuda",
                                 dtype=torch.float16)
            features = model(pixel_values=pixels).last_hidden_state
            torch.cuda.synchronize()
            shape = [int(dim) for dim in features.shape]
        del model, features, pixels
        torch.cuda.empty_cache()
        event("dinov3_cuda_smoke_passed", outputShape=shape,
              note="TRELLIS.2 weights and 3D generation not tested")
        return 0
    except Exception as exc:
        # Surface only exception class to avoid accidental token/log disclosure.
        event("dinov3_cuda_smoke_failed", errorType=type(exc).__name__)
        return 4


if __name__ == "__main__":
    sys.exit(main())
