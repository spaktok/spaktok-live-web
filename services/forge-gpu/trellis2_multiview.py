"""Multi-view (2..5 references) conditioning for TRELLIS.2, EXPERIMENTAL.

TRELLIS.2 ships no multi-image entry point. This ports the *official*
TRELLIS v1 ``multidiffusion`` mode (``inject_sampler_multi_image``): at every
flow step the positive-conditioned velocity is averaged across views while the
negative (unconditional) branch runs once, so CFG / guidance-interval logic in
the unmodified TRELLIS.2 samplers is preserved exactly.

Mechanism: for the duration of one ``pipeline.run`` call only,
  * ``get_cond`` encodes ALL views (DINOv3 accepts a list) -> cond [N, T, D];
  * every ``*flow_model*`` entry is wrapped so a call with that exact cond
    tensor averages N single-view predictions.
Everything is restored in ``finally``; the GPU lock guarantees one job at a time.
Cost: ~N x flow-model compute, near-constant VRAM (views run sequentially).
Quality vs single-view is UNBENCHMARKED; opt-in via FORGE_GPU_MULTIVIEW_ENABLED.
"""
from __future__ import annotations

import os
from contextlib import contextmanager
from typing import Any, Iterator, Sequence

MIN_VIEWS = 2
MAX_VIEWS = 5


def enabled() -> bool:
    return os.environ.get("FORGE_GPU_MULTIVIEW_ENABLED") == "yes"


def validate_view_count(count: int) -> None:
    if not MIN_VIEWS <= count <= MAX_VIEWS:
        raise ValueError("unsupported_view_count")


def make_wrapper_class(module_base: type) -> type:
    """Build an ``nn.Module`` subclass lazily so this file imports without torch.

    Must be a real ``nn.Module``: upstream checks ``isinstance(model, nn.Module)``
    and calls ``.to()`` / ``.cpu()`` under low_vram.
    """

    class MultiViewFlow(module_base):
        def __init__(self, inner: Any, positive_ids: set):
            super().__init__()
            self.inner = inner
            self._positive_ids = positive_ids

        def __getattr__(self, name: str):
            try:
                return super().__getattr__(name)
            except AttributeError:
                return getattr(super().__getattr__("inner"), name)

        def forward(self, x_t, t, cond=None, **kwargs):
            if cond is not None and id(cond) in self._positive_ids and len(cond) > 1:
                total = None
                for index in range(len(cond)):
                    pred = self.inner(x_t, t, cond[index:index + 1], **kwargs)
                    total = pred if total is None else total + pred
                return total / len(cond)
            return self.inner(x_t, t, cond, **kwargs)

    return MultiViewFlow


@contextmanager
def multiview_conditioning(pipeline: Any, views: Sequence[Any],
                           module_base: type, zeros_like) -> Iterator[None]:
    """Temporarily make ``pipeline.run`` condition on every prepared view."""
    validate_view_count(len(views))
    positive_ids: set = set()
    keep_alive: list = []
    wrapper_cls = make_wrapper_class(module_base)
    original_get_cond = pipeline.get_cond
    had_instance_get_cond = "get_cond" in vars(pipeline)
    original_models = dict(pipeline.models)

    def fused_get_cond(_image, resolution, include_neg_cond=True):
        encoded = original_get_cond(list(views), resolution, include_neg_cond=False)["cond"]
        keep_alive.append(encoded)  # id() must stay unique while registered
        positive_ids.add(id(encoded))
        if not include_neg_cond:
            return {"cond": encoded}
        return {"cond": encoded, "neg_cond": zeros_like(encoded[:1])}

    try:
        pipeline.get_cond = fused_get_cond
        for key, model in original_models.items():
            if "flow_model" in key:
                pipeline.models[key] = wrapper_cls(model, positive_ids)
        yield
    finally:
        pipeline.models.clear()
        pipeline.models.update(original_models)
        if had_instance_get_cond:
            pipeline.get_cond = original_get_cond
        else:
            del pipeline.get_cond
        keep_alive.clear()
        positive_ids.clear()
