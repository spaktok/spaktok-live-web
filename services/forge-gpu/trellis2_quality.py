"""Finite TRELLIS.2 quality presets. No untrusted user pipeline arguments.

The HD tier is opt-in: never enabled merely by selecting a Studio target.
The ultra tier (1536_cascade, 4K PBR) is async/operator-only: the synchronous
browser ticket API must never run it, because output and runtime can exceed
the 35 MiB / request-timeout delivery bounds.
These are generation settings, not measured claims of visual superiority.
"""
from dataclasses import dataclass, replace


@dataclass(frozen=True)
class Trellis2Quality:
    profile: str
    pipeline_type: str
    decimation_target: int
    texture_size: int
    min_vram_bytes: int
    operator_hd_required: bool
    async_only: bool = False


GIB = 1024 ** 3
PRESETS = {
    "mobile-preview": Trellis2Quality(
        "mobile-preview", "512", 120_000, 1024, 24 * GIB, False,
    ),
    "detail-preview": Trellis2Quality(
        "detail-preview", "512", 200_000, 2048, 24 * GIB, False,
    ),
    "studio-hd": Trellis2Quality(
        "studio-hd", "1024_cascade", 300_000, 2048, 60 * GIB, True,
    ),
    "studio-ultra": Trellis2Quality(
        "studio-ultra", "1536_cascade", 500_000, 4096, 70 * GIB, True,
        async_only=True,
    ),
}

# Rodin-style finite triangle budgets. A budget may only lower a preset's
# ceiling; it can never raise generation cost or delivery size.
POLY_BUDGETS = (20_000, 50_000, 120_000, 200_000, 300_000, 500_000)


def select_trellis2_quality(profile: str, *, vram_bytes: int,
                            hd_authorized: bool = False,
                            async_operator_run: bool = False) -> Trellis2Quality:
    if profile not in PRESETS:
        raise ValueError("unsupported_trellis2_profile")
    preset = PRESETS[profile]
    if preset.async_only and not async_operator_run:
        raise PermissionError("trellis2_profile_requires_async_operator_run")
    if preset.operator_hd_required and not hd_authorized:
        raise PermissionError("trellis2_hd_operator_approval_required")
    if vram_bytes < preset.min_vram_bytes:
        raise RuntimeError("trellis2_profile_gpu_memory_insufficient")
    return preset


def with_poly_budget(preset: Trellis2Quality, faces: int) -> Trellis2Quality:
    if faces not in POLY_BUDGETS:
        raise ValueError("unsupported_poly_budget")
    if faces > preset.decimation_target:
        raise ValueError("poly_budget_exceeds_profile_ceiling")
    return replace(preset, decimation_target=faces)
