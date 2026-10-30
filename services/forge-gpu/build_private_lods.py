#!/usr/bin/env python3
"""Spaktok private GLB -> actual LOD0/LOD1/LOD2 asset pack, no GPU inference.

Requires locally installed, official gltfpack/meshoptimizer executable.
Never downloads binaries, uploads models or modifies the input. It refuses
to overwrite existing files and validates structural+PBR quality afterwards.
LOD assets remain PRIVATE AND UNPUBLISHED. No skin or AR readiness claimed.
"""
from __future__ import annotations

import argparse
import json
import os
from pathlib import Path
import shutil
import subprocess
import sys
import tempfile
from benchmark_glb_quality import inspect_glb
from glb_topology import scan_glb_topology
from glb_position_weld_audit import scan_glb_position_weld
from glb_uv_surface import inspect_glb_uv_surface

MAX_SOURCE_BYTES = 35 * 1024 * 1024
MAX_OUTPUT_BYTES = 35 * 1024 * 1024
PACK_SCHEMA = "spaktok-private-multi-lod-v1"
# Retain LOD0 original; derive independent geometry for LOD1 and LOD2.
LOD_RATIOS = (("lod1", "0.50"), ("lod2", "0.20"))
# Bounded, opt-in CPU retries. The source GLB remains untouched.
# Real 2026-10-30 asset: aggressive simplification created non-manifold edges,
# whereas these conservative error budgets yielded two topology-clean previews.
# These are NOT promises that the requested 50% / 20% LOD targets can be met.
CONSERVATIVE_ERROR_CAPS = {
    "lod1": ("0.0014", "0.0012", "0.0010", "0.0008"),
    "lod2": ("0.0025", "0.0022", "0.0020", "0.0018", "0.0017",
             "0.00165", "0.0016", "0.0014", "0.0012", "0.0010"),
}
# All target assignments are merely private-preview recommendations.
TARGET_LODS = {
    "avatar": "lod1", "live": "lod2",
    "filter": "lod2", "gift": "lod1", "world": "lod1",
}


def _check_file(path: Path) -> dict:
    meta = inspect_glb(path)
    # Fail closed: a structurally readable GLB can still contain dangerous
    # non-manifold or degenerate triangle indices.
    meta["topology"] = scan_glb_topology(path)
    meta["positionWeldTopology"] = scan_glb_position_weld(path)
    # The existing source/target UV slot gates below retain their own
    # precise failures; valid UV-bearing output gets a full area audit.
    meta["uvSurface"] = (
        inspect_glb_uv_surface(path)
        if meta["primitives_with_uv0"] == meta["triangle_primitives"]
        else None
    )
    if not 28 <= meta["bytes"] <= MAX_OUTPUT_BYTES:
        raise ValueError("lod_output_size_invalid")
    if meta["triangles"] < 1 or meta["triangle_primitives"] < 1:
        raise ValueError("lod_output_missing_triangles")
    return meta


def _check_quality(source: dict, candidate: dict, previous: dict) -> None:
    if candidate["triangles"] >= previous["triangles"]:
        raise ValueError("lod_did_not_reduce_triangles")
    if (candidate["topology"]["nonmanifold_edges"] or
            candidate["topology"]["degenerate_index_triangles"]):
        raise ValueError("lod_topology_nonmanifold_or_degenerate")
    if candidate["primitives_with_uv0"] != candidate["triangle_primitives"]:
        raise ValueError("lod_uvs_missing")
    if source.get("uvSurface") and candidate.get("uvSurface"):
        source_fraction = source["uvSurface"]["uv_collapsed_fraction"]
        next_fraction = candidate["uvSurface"]["uv_collapsed_fraction"]
        if next_fraction > max(.002, source_fraction + .001):
            raise ValueError("lod_uv_collapse_fraction_too_high")
        if candidate["uvSurface"]["surface_area_sum"] <= 0:
            raise ValueError("lod_geometry_surface_area_invalid")
    else:
        raise ValueError("lod_uv_surface_audit_missing")
    if candidate["primitives_with_normals"] != candidate["triangle_primitives"]:
        raise ValueError("lod_normals_missing")
    if candidate["pbr_material_count"] < 1:
        raise ValueError("lod_pbr_materials_missing")
    if source["embedded_image_count"] and not candidate["embedded_image_count"]:
        raise ValueError("lod_lost_embedded_textures")
    if (source["morph_target_count"] and
            candidate["morph_target_count"] < source["morph_target_count"]):
        raise ValueError("lod_lost_morph_targets")
    if source["skin_count"] and candidate["skin_count"] < source["skin_count"]:
        raise ValueError("lod_lost_skins")
    if (source["animation_count"] and
            candidate["animation_count"] < source["animation_count"]):
        raise ValueError("lod_lost_animations")
    # Preserve the broad texture PBR capability of the original. Names/counts
    # may change during packing; the report records the exact observed slots.
    for slot in ("base_color", "metallic_roughness", "normal",
                 "occlusion", "emissive"):
        if (source["texture_slot_counts"].get(slot, 0) > 0 and
                candidate["texture_slot_counts"].get(slot, 0) < 1):
            raise ValueError("lod_lost_pbr_slot_" + slot)


def generate_lods(source_file: Path, output_dir: Path,
                  executable: str = "gltfpack",
                  *, conservative: bool = False) -> dict:
    source_file = source_file.resolve(strict=True)
    if not source_file.is_file() or source_file.suffix.lower() != ".glb":
        raise ValueError("lod_source_must_be_glb")
    if output_dir.exists():
        raise FileExistsError("lod_output_destination_already_exists")
    if not output_dir.parent.is_dir():
        raise ValueError("lod_destination_parent_missing")
    program = shutil.which(executable)
    if not program or not Path(program).is_file():
        raise FileNotFoundError("gltfpack_not_installed_use_official_binary")
    source_meta = _check_file(source_file)
    if source_meta["bytes"] > MAX_SOURCE_BYTES:
        raise ValueError("lod_source_too_large")
    if source_meta["triangles"] < 100:
        raise ValueError("lod_source_too_small_for_decimation")
    if (source_meta["topology"]["nonmanifold_edges"] or
            source_meta["topology"]["degenerate_index_triangles"]):
        raise ValueError("lod_source_topology_requires_repair")
    if source_meta["primitives_with_uv0"] != source_meta["triangle_primitives"]:
        raise ValueError("lod_source_has_missing_uvs")
    if source_meta["primitives_with_normals"] != source_meta["triangle_primitives"]:
        raise ValueError("lod_source_has_missing_normals")
    if source_meta["pbr_material_count"] < 1:
        raise ValueError("lod_source_no_pbr")
    with tempfile.TemporaryDirectory(
        prefix=".spaktok-lod-", dir=output_dir.parent
    ) as scratch:
        temp = Path(scratch)
        paths = {"lod0": temp / "lod0.glb"}
        shutil.copyfile(source_file, paths["lod0"])
        assets = {
            "lod0": {
                "file": "lod0.glb", "ratioRequested": 1.0,
                "meta": source_meta,
            }
        }
        previous = source_meta
        for name, ratio in LOD_RATIOS:
            target = temp / (name + ".glb")
            trials = []
            accepted_meta = None
            accepted_cap = None
            caps = (CONSERVATIVE_ERROR_CAPS[name] if conservative
                    else (None,))
            for error_cap in caps:
                # A rejected attempt must never be confused with the next
                # attempt, and no temporary candidate is published.
                target.unlink(missing_ok=True)
                command = [program, "-i", str(source_file), "-o", str(target),
                           "-si", ratio, "-noq", "-kn", "-km", "-ke",
                           "-slb", "-sv"]
                if error_cap is not None:
                    command += ["-se", error_cap]
                try:
                    result = subprocess.run(
                        command, capture_output=True, text=True, timeout=90,
                        check=False, env={**os.environ, "NO_COLOR": "1"},
                    )
                except subprocess.TimeoutExpired as exc:
                    if not conservative:
                        raise RuntimeError("gltfpack_lod_timeout") from exc
                    trials.append({"maxError": error_cap, "result": "timeout"})
                    continue
                if result.returncode != 0 or not target.is_file():
                    if not conservative:
                        raise RuntimeError("gltfpack_lod_failed")
                    trials.append({"maxError": error_cap,
                                   "result": "gltfpack_failed"})
                    continue
                try:
                    next_meta = _check_file(target)
                    _check_quality(source_meta, next_meta, previous)
                except (ValueError, OSError, IndexError, KeyError, TypeError) as exc:
                    if not conservative:
                        raise
                    # This is diagnostic metadata, never authorization to
                    # distribute an invalid LOD. No subprocess output included.
                    trials.append({"maxError": error_cap,
                                   "result": "rejected", "reason": str(exc)})
                    continue
                accepted_meta = next_meta
                accepted_cap = error_cap
                trials.append({"maxError": error_cap, "result": "accepted"})
                break
            if accepted_meta is None:
                raise ValueError("lod_no_valid_conservative_candidate_" + name
                                 if conservative else "lod_generation_failed")
            paths[name] = target
            assets[name] = {
                "file": target.name, "ratioRequested": float(ratio),
                "meta": accepted_meta, "maxErrorUsed": accepted_cap,
                "trials": trials,
            }
            previous = accepted_meta
        actual_ratios = {
            name: value["meta"]["triangles"] / source_meta["triangles"]
            for name, value in assets.items()
        }
        targets_met = all(
            actual_ratios[name] <= float(ratio)
            for name, ratio in LOD_RATIOS
        )
        # Index-only manifold counts can hide overlapping POSITION edges
        # across UV/material seams. Conservatively flag any incidence >2
        # after positional welding for human review, not auto-repair.
        weld_review_required = any(
            asset["meta"]["positionWeldTopology"][
                "nonmanifold_edges_after_position_weld"
            ] > 0 or asset["meta"]["positionWeldTopology"][
                "degenerate_triangles_after_position_weld"
            ] > 0 for asset in assets.values()
        )
        pack = {
            "schema": PACK_SCHEMA,
            "optimizationMode": ("bounded-conservative-cpu"
                                  if conservative else "fixed-target-cpu"),
            "triangleTargetsMet": targets_met,
            "needsOptimization": not targets_met or weld_review_required,
            "positionWeldGeometryReviewRequired": weld_review_required,
            "source": {
                "filename": source_file.name,
                "sha256": source_meta["sha256"],
                "bytes": source_meta["bytes"],
            },
            "variants": {
                name: {
                    "file": value["file"],
                    "requestedTriangleRatio": value["ratioRequested"],
                    "achievedTriangleRatio": actual_ratios[name],
                    "triangleTargetMet": (
                        actual_ratios[name] <= value["ratioRequested"]
                    ),
                    "maxSimplificationErrorUsed": value.get("maxErrorUsed"),
                    "optimizationAttempts": value.get("trials", []),
                    "triangles": value["meta"]["triangles"],
                    "bytes": value["meta"]["bytes"],
                    "sha256": value["meta"]["sha256"],
                    "embeddedTextureImages": value["meta"]["embedded_image_count"],
                    "pbrMaterialCount": value["meta"]["pbr_material_count"],
                    "topology": value["meta"]["topology"],
                    "positionWeldTopology": value["meta"]["positionWeldTopology"],
                    "uvSurface": value["meta"].get("uvSurface"),
                    "surfaceAreaChangePercentVsOriginal": (
                        100 * (value["meta"]["uvSurface"]["surface_area_sum"] /
                               source_meta["uvSurface"]["surface_area_sum"] - 1)
                        if source_meta.get("uvSurface") and
                           value["meta"].get("uvSurface") else None
                    ),
                }
                for name, value in assets.items()
            },
            # Never infer live/AR suitability from a conservative LOD that
            # did not actually reach its intended triangle budget.
            "privateStudioRecommendations": (
                TARGET_LODS if targets_met and not weld_review_required else {}
            ),
            "published": False,
            "rigged": False,
            "animated": False,
            "cameraTracked": False,
            "review": {
                "androidFPS": "not-tested",
                "automaticDistributionBlocked": True,
                "requiresVisualReview": True,
                "indexManifoldAloneDoesNotProveSurfaceManifold": True,
                "positionWeldGeometryReviewRequired": weld_review_required,
                "simplificationTargetsAchieved": targets_met,
                "nonManifoldEdges": "zero-required-and-verified",
                "visualSeamArtifacts": "not-tested",
                "surfaceAreaDriftRequiresHumanJudgment": True,
                "visualError": "not-tested",
                "sourceRights": "must-be-attested-by-owner",
            },
        }
        (temp / "pack.json").write_text(
            json.dumps(pack, ensure_ascii=False, indent=2) + "\n",
            encoding="utf-8"
        )
        # Only after all 3 structural/PBR checks succeed does the directory
        # become visible as a complete, atomic pack.
        os.replace(temp, output_dir)
        # TemporaryDirectory will NOT delete the moved directory.
    return pack


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--source", type=Path, required=True)
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--gltfpack", default="gltfpack")
    parser.add_argument(
        "--conservative", action="store_true",
        help=("Retry bounded gltfpack error budgets; failed topology/UV/PBR "
              "candidates are discarded. Actual LOD targets may remain unmet."),
    )
    args = parser.parse_args()
    try:
        result = generate_lods(args.source, args.output, args.gltfpack,
                               conservative=args.conservative)
    except (OSError, ValueError, RuntimeError) as exc:
        print("SPAKTOK_LOD_FAILED:", str(exc), file=sys.stderr)
        return 1
    print("SPAKTOK_LOD_PACK_CREATED_PRIVATE")
    for name, v in result["variants"].items():
        print(name, "triangles=", v["triangles"], "bytes=", v["bytes"])
    print("published=false; rigged=false; androidQA=not-tested")
    print("triangleTargetsMet=", result["triangleTargetsMet"],
          "needsOptimization=", result["needsOptimization"])
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
