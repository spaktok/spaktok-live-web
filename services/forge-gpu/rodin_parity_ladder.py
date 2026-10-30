#!/usr/bin/env python3
"""Operator-only TRELLIS.2 resolution ladder on the owner's A100.

Generates ONE local image at 512 -> 1024_cascade -> (optional) 1536_cascade
in a single model load, recording wall time, peak VRAM, GLB bytes and
structural metrics, so Rodin comparisons use measured numbers instead of
claims. Dry-run by default. Stops at the first failure: no automatic paid
retries. Outputs stay on the GPU disk; nothing is uploaded.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import os
import sys
import time
import traceback
from pathlib import Path

TRELLIS_ROOT = Path("/workspace/TRELLIS.2")
DEFAULT_PROFILES = ("mobile-preview", "detail-preview", "studio-hd")
OFFLINE_MAX_GLB_BYTES = 200 * 1024 * 1024
ALLOWED_SUFFIXES = (".png", ".jpg", ".jpeg", ".webp")


def event(stage: str, **metadata) -> None:
    print(json.dumps({"spaktok_ladder": stage, **metadata}), flush=True)


def plan_profiles(raw: str, *, allow_ultra: bool) -> list[str]:
    from trellis2_quality import PRESETS
    profiles = [p.strip() for p in raw.split(",") if p.strip()]
    if not profiles or len(set(profiles)) != len(profiles):
        raise ValueError("profiles_empty_or_duplicated")
    for profile in profiles:
        if profile not in PRESETS:
            raise ValueError("unsupported_trellis2_profile")
        if PRESETS[profile].async_only and not allow_ultra:
            raise PermissionError("ultra_requires_allow_ultra_flag")
    return profiles


def _error_summary(exc: Exception) -> dict:
    frames = traceback.extract_tb(exc.__traceback__)
    point = frames[-1] if frames else None
    # Never include exception text: it can contain paths or tokens.
    return {"error_type": type(exc).__name__,
            "source": Path(point.filename).name if point else None,
            "line": point.lineno if point else None}


def run_ladder(photo: bytes, profiles: list[str], out_dir: Path, *,
               engine, torch_module, inspect, allow_ultra: bool,
               poly_budget: int | None = None, clock=time.perf_counter) -> dict:
    from trellis2_quality import select_trellis2_quality, with_poly_budget
    vram_total = torch_module.cuda.get_device_properties(0).total_memory
    out_dir.mkdir(parents=True, exist_ok=True)
    rows = []
    for profile in profiles:
        row = {"profile": profile}
        try:
            quality = select_trellis2_quality(
                profile, vram_bytes=vram_total, hd_authorized=True,
                async_operator_run=allow_ultra)
            # A budget above a profile's ceiling keeps that ceiling.
            if poly_budget is not None and poly_budget <= quality.decimation_target:
                quality = with_poly_budget(quality, poly_budget)
            row.update(pipeline_type=quality.pipeline_type,
                       decimation_target=quality.decimation_target,
                       texture_size=quality.texture_size)
            torch_module.cuda.reset_peak_memory_stats()
            started = clock()
            glb = engine.generate_with_quality(
                photo, quality, job_id=f"ladder-{profile}",
                max_bytes=OFFLINE_MAX_GLB_BYTES)
            row["seconds"] = round(clock() - started, 2)
            row["peak_vram_gib"] = round(
                torch_module.cuda.max_memory_allocated() / 1024 ** 3, 2)
            path = out_dir / f"spaktok-{profile}.glb"
            path.write_bytes(glb)
            row.update(glb=str(path), bytes=len(glb),
                       sha256=hashlib.sha256(glb).hexdigest(),
                       fits_35mib_web_delivery=len(glb) <= 35 * 1024 * 1024,
                       structure=inspect(path), ok=True)
            event("profile_completed", profile=profile, seconds=row["seconds"],
                  bytes=len(glb), peak_vram_gib=row["peak_vram_gib"])
        except Exception as exc:  # stop: no automatic expensive retries
            row.update(ok=False, **_error_summary(exc))
            rows.append(row)
            event("profile_failed_ladder_stopped", profile=profile,
                  error_type=row["error_type"])
            break
        rows.append(row)
    return {"tool": "spaktok-rodin-parity-ladder", "gpu_vram_gib":
            round(vram_total / 1024 ** 3, 1), "results": rows,
            "winner": None,
            "note": "Structural/timing evidence only; visual quality needs the "
                    "blind study in SPAKTOK_RODIN_COMPETITIVE_QUALITY_GATE."}


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--image", default=str(TRELLIS_ROOT /
                                              "assets/example_image/T.png"))
    parser.add_argument("--profiles", default=",".join(DEFAULT_PROFILES))
    parser.add_argument("--poly-budget", type=int)
    parser.add_argument("--out-dir", default="/workspace/spaktok-ladder")
    parser.add_argument("--allow-ultra", action="store_true",
                        help="Permit studio-ultra (1536_cascade, 4K PBR)")
    parser.add_argument("--execute", action="store_true",
                        help="Actually load weights and generate (paid GPU)")
    args = parser.parse_args()

    source = Path(args.image)
    if not source.is_file() or source.suffix.lower() not in ALLOWED_SUFFIXES:
        event("source_invalid")
        return 2
    try:
        profiles = plan_profiles(args.profiles, allow_ultra=args.allow_ultra)
    except (ValueError, PermissionError) as exc:
        event("plan_rejected", reason=str(exc))
        return 2
    if not args.execute:
        event("dry_run_only", image=source.name, profiles=profiles,
              poly_budget=args.poly_budget, no_gpu_generation=True)
        return 0
    if os.environ.get("CONDA_PREFIX") != "/workspace/trellis2-env":
        event("wrong_conda_environment")
        return 2

    sys.path.insert(0, str(TRELLIS_ROOT))
    import torch
    import trellis2_engine
    from benchmark_glb_quality import inspect_glb

    trellis2_engine.load_model_once(torch)
    report = run_ladder(source.read_bytes(), profiles, Path(args.out_dir),
                        engine=trellis2_engine, torch_module=torch,
                        inspect=inspect_glb, allow_ultra=args.allow_ultra,
                        poly_budget=args.poly_budget)
    report_path = Path(args.out_dir) / "ladder-report.json"
    report_path.write_text(json.dumps(report, indent=2))
    event("report_written", path=str(report_path))
    return 0 if all(r.get("ok") for r in report["results"]) else 1


if __name__ == "__main__":
    raise SystemExit(main())
