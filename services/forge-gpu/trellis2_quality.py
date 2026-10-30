"""Finite TRELLIS.2 quality presets. No untrusted user pipeline arguments.

The HD tier is opt-in: never enabled merely by selecting a Studio target.
These are generation settings, not measured claims of visual superiority.
"""
from dataclasses import dataclass


@dataclass(frozen=True)
class Trellis2Quality:
    profile: str
    pipeline_type: str
    decimation_target: int
    texture_size: int
    min_vram_bytes: int
    operator_hd_required: bool


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
}


def select_trellis2_quality(profile: str, *, vram_bytes: int,
                            hd_authorized: bool = False) -> Trellis2Quality:
    if profile not in PRESETS:
        raise ValueError("unsupported_trellis2_profile")
    preset = PRESETS[profile]
    if preset.operator_hd_required and not hd_authorized:
        raise PermissionError("trellis2_hd_operator_approval_required")
    if vram_bytes < preset.min_vram_bytes:
        raise RuntimeError("trellis2_profile_gpu_memory_insufficient")
    return preset
