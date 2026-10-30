"""Explicit, scoped, transparent RMBG-2.0 replacement for TRELLIS.2 startup.

Microsoft TRELLIS.2-4B/pipeline.json currently requests rembg.BiRefNet with
model_name='briaai/RMBG-2.0'. That repository is gated and has different terms.

The open ZhengPeng7/BiRefNet checkpoint is MIT-listed on Hugging Face and uses
the very same AutoModelForImageSegmentation interface and upstream BiRefNet
adapter. This scoped override changes only the background removal model,
NOT DINOv3, geometry checkpoints, or target model weights.

Never edit the shared HF cache nor execute shell commands from creator inputs.
Review remote-code revisions and actual commercial license before production.
"""
from __future__ import annotations

from contextlib import contextmanager
from typing import Any, Iterator

OPEN_REMBG_MODEL = "ZhengPeng7/BiRefNet"
EXPECTED_REMBG_FROM_MS = "briaai/RMBG-2.0"


@contextmanager
def use_open_background_model(rembg_module: Any) -> Iterator[None]:
    """Swap only during a single synchronous from_pretrained call."""
    original = rembg_module.BiRefNet

    class SpaktokOpenBiRefNet(original):
        def __init__(self, model_name: str = EXPECTED_REMBG_FROM_MS, **kwargs):
            if model_name not in (EXPECTED_REMBG_FROM_MS, OPEN_REMBG_MODEL):
                raise ValueError("unexpected_background_model_in_pipeline")
            # No request to the gated BRIA checkpoint takes place.
            super().__init__(model_name=OPEN_REMBG_MODEL, **kwargs)

    rembg_module.BiRefNet = SpaktokOpenBiRefNet
    try:
        yield
    finally:
        rembg_module.BiRefNet = original
