#!/usr/bin/env python3
"""Private Spaktok Studio/Forge production *candidate* pipeline.

One approved image -> existing operator-owned localhost GPU -> GLB, or
existing GLB -> audited private draft -> optional CPU gltfpack LODs ->
Rodin technical comparison -> five department handoff plans.

This is NOT an inference model, auto-rigger, live/AR integration, publication
endpoint or an assertion of Rodin parity. No public URLs, database writes, R2
writes, credentials in output, retries of GPU inference or hidden paid calls.
Source is never overwritten; results are written atomically only after audit.

Usage (no paid GPU):
  python spaktok_studio_production.py --glb /private/my.glb \\
      --output /private/spaktok-draft --rights-confirmed

Owner's EXPLICIT one-use GPU option:
  FORGE_GPU_TOKEN=... python spaktok_studio_production.py \\
      --image /private/photo.png --output /private/spaktok-draft \\
      --rights-confirmed --permit-image-transfer --execute-gpu-once

Requires an already running, explicitly provisioned local GPU service;
the code never starts or purchases an instance. Optional gltfpack must
already be on PATH; missing or rejected LODs remain flagged as incomplete.
"""
from __future__ import annotations

import argparse
from datetime import datetime, timezone
import hashlib
import json
import os
from pathlib import Path
import shutil
import sys
import tempfile

from benchmark_glb_quality import report as technical_comparison
from build_private_lods import generate_lods, _check_file
from glb_position_weld_audit import scan_glb_position_weld
from one_image_e2e import MAX_IMAGE, MAX_GLB, post_one_image

DEPARTMENTS = ("avatar", "live", "filter", "gift", "world")
TARGET_LODS = {"avatar": "lod1", "live": "lod2", "filter": "lod2",
               "gift": "lod1", "world": "lod1"}
MAX_TEXT_LENGTH = 1000


def _validate_targets(targets: tuple[str, ...]) -> tuple[str, ...]:
    if not targets or len(targets) > len(DEPARTMENTS) or len(set(targets)) != len(targets):
        raise ValueError("invalid_studio_targets")
    if any(name not in DEPARTMENTS for name in targets):
        raise ValueError("unknown_studio_target")
    return targets


def _read_photo(path: Path) -> tuple[bytes, str]:
    ext = path.suffix.lower()
    if ext not in (".png", ".jpg", ".jpeg", ".webp"):
        raise ValueError("unsupported_source_image_type")
    if not path.is_file() or not 128 <= path.stat().st_size <= MAX_IMAGE:
        raise ValueError("source_image_size_invalid")
    raw = path.read_bytes()
    if len(raw) > MAX_IMAGE:
        raise ValueError("source_image_size_invalid")
    return raw, hashlib.sha256(raw).hexdigest()


def _source_audit(path: Path) -> dict:
    measured = _check_file(path)
    if not 28 <= measured["bytes"] <= MAX_GLB or measured["triangles"] < 1:
        raise ValueError("studio_source_glb_invalid")
    index = measured["topology"]
    position = measured["positionWeldTopology"]
    issues = []
    if not index["verified"] or index["nonmanifold_edges"] or index["degenerate_index_triangles"]:
        issues.append("index_topology_requires_review")
    if (position["nonmanifold_edges_after_position_weld"] or
            position["degenerate_triangles_after_position_weld"]):
        issues.append("position_welded_edges_require_visual_review")
    if measured["primitives_with_uv0"] != measured["triangle_primitives"]:
        issues.append("uv_missing")
    if measured["primitives_with_normals"] != measured["triangle_primitives"]:
        issues.append("normals_missing")
    if measured["pbr_material_count"] < 1:
        issues.append("pbr_material_missing")
    if measured["embedded_image_count"] < 1:
        issues.append("embedded_pbr_texture_image_missing")
    if measured["bytes"] > 15 * 1024 * 1024:
        issues.append("mobile_delivery_over_15mib")
    if measured["triangles"] > 150_000:
        issues.append("mobile_over_150k_triangles")
    return {"measured": measured, "issues": issues}


def _department_plan(
    name: str, measured: dict, issues: list[str], lod_manifest: dict | None
) -> dict:
    # Copy, never mutate common issues across departments.
    reasons = list(issues)
    if not lod_manifest or lod_manifest.get("needsOptimization") is not False:
        reasons.append("multi_lod_not_approved")
    if name in ("avatar", "live"):
        if not measured["morph_target_count"]:
            reasons.append("face_blendshapes_missing")
        if not measured["skin_count"]:
            reasons.append("face_or_body_rig_not_verified")
        reasons.append("manual_face_calibration_required")
    if name == "live":
        reasons += ["live_camera_tracking_not_tested",
                    "agora_or_webrtc_sync_not_tested"]
    elif name == "filter":
        reasons += ["face_anchor_occlusion_not_calibrated",
                    "camera_tracking_not_tested"]
    elif name == "gift":
        if not measured["animation_count"]:
            reasons.append("gift_effect_animation_missing")
        reasons.append("gift_monetization_review_missing")
    elif name == "world":
        reasons += ["physical_scale_not_calibrated",
                    "collision_mesh_not_verified"]
    reasons += ["android_fps_thermals_unmeasured",
                "visual_360_and_rights_review_required"]
    return {
        "target": name,
        "requestedLod": TARGET_LODS[name],
        "destination": {
            "avatar": "/avatar-studio", "live": "/avatar-studio",
            "filter": "/reality-studio", "gift": "/gift-studio",
            "world": "/spaktok-world",
        }[name],
        "status": "needs-optimization",
        "blockers": list(dict.fromkeys(reasons)),
        "published": False,
        "autoImported": False,
    }


def produce_private_draft(
    *, output_dir: Path, glb: Path | None = None, image: Path | None = None,
    rights_confirmed: bool = False, permit_image_transfer: bool = False,
    execute_gpu_once: bool = False, targets: tuple[str, ...] = DEPARTMENTS,
    description: str = "", rodin: Path | None = None,
    same_reference_confirmed: bool = False,
    gltfpack: str = "gltfpack", make_lods: bool = True,
) -> dict:
    """Produce an atomic, owner-private package; no network except explicit GPU.

    No retries of chargeable GPU requests. If local GPU fails, nothing ships.
    No public publishing, even if all technical audits appear green.
    """
    targets = _validate_targets(targets)
    if (glb is None) == (image is None):
        raise ValueError("choose_exactly_one_glb_or_image")
    if not rights_confirmed:
        raise PermissionError("creator_rights_confirmation_required")
    if not isinstance(description, str) or len(description) > MAX_TEXT_LENGTH:
        raise ValueError("description_invalid")
    if image is None and (execute_gpu_once or permit_image_transfer):
        raise ValueError("gpu_consent_without_image")
    if image is not None and not (execute_gpu_once and permit_image_transfer):
        raise PermissionError("image_requires_one_time_gpu_and_transfer_approvals")
    if rodin is not None and not same_reference_confirmed:
        raise ValueError("matched_reference_confirmation_required")
    parent = output_dir.parent.resolve(strict=True)
    dest = parent / output_dir.name
    if dest.exists() or output_dir.name in ("", ".", ".."):
        raise FileExistsError("private_output_must_not_exist")
    if glb is not None:
        source = glb.resolve(strict=True)
        if not source.is_file() or source.suffix.lower() != ".glb":
            raise ValueError("studio_source_must_be_glb")
        if not 28 <= source.stat().st_size <= MAX_GLB:
            raise ValueError("studio_source_size_invalid")
        source_kind = "existing-glb"
        image_hash = None
    else:
        source = None
        source_kind = "one-approved-local-gpu-inference"
        image_hash = None
        # Validate BEFORE reading any GPU secret or making network calls.
        assert image is not None
        photo, image_hash = _read_photo(image.resolve(strict=True))
        if len(os.getenv("FORGE_GPU_TOKEN", "")) < 32:
            raise PermissionError("local_gpu_operator_secret_missing")

    with tempfile.TemporaryDirectory(prefix=".spaktok-private-", dir=parent) as temp:
        work = Path(temp)
        result = work / "source.glb"
        if source is not None:
            shutil.copyfile(source, result)
        else:
            # ONE operator-owned local HTTP POST, no automatic retry.
            generated = post_one_image(
                photo, image.name, os.environ["FORGE_GPU_TOKEN"]
            )
            if not 28 <= len(generated) <= MAX_GLB:
                raise ValueError("gpu_generated_glb_size_invalid")
            result.write_bytes(generated)
            del generated, photo

        audited = _source_audit(result)
        meta, issues = audited["measured"], audited["issues"]
        lods = None
        lod_status = "not-requested" if not make_lods else "not-available"
        if make_lods:
            executable = shutil.which(gltfpack)
            if executable and Path(executable).is_file():
                # This tool safely rejects bad topology, texture loss and UV
                # damage; it never claims model "quality" from triangle counts.
                try:
                    lods = generate_lods(result, work / "lods", executable,
                                         conservative=True)
                    lod_status = ("needs-review" if lods["needsOptimization"]
                                  else "structurally-generated-needs-visual-review")
                except (ValueError, OSError, RuntimeError):
                    # Original was still audited; keep this valid draft,
                    # with an explicit failed LOD step and NO partial pack.
                    lod_status = "rejected-by-quality-gate"
                    lods = None

        comparison = None
        if rodin is not None:
            candidate = rodin.resolve(strict=True)
            if not candidate.is_file() or candidate.suffix.lower() != ".glb":
                raise ValueError("rodin_reference_must_be_glb")
            comparison = technical_comparison(result, candidate)
            comparison["sameReferenceConfirmedByOwner"] = True
            comparison["winner"] = None

        model = {
            "format": "glb",
            "file": "source.glb",
            "sha256": meta["sha256"],
            "bytes": meta["bytes"],
            "triangles": meta["triangles"],
            "embeddedTextureImages": meta["embedded_image_count"],
            "pbrMaterials": meta["pbr_material_count"],
            "morphTargets": meta["morph_target_count"],
            "skins": meta["skin_count"],
            "animations": meta["animation_count"],
            "indexedTopology": meta["topology"],
            "positionWeldTopology": meta["positionWeldTopology"],
            "uvSurface": meta["uvSurface"],
        }
        bundle = {
            "schema": "spaktok-private-production-draft-v1",
            "createdAt": datetime.now(timezone.utc).isoformat(),
            "visibility": "owner-private",
            "sourceEngine": source_kind,
            "sourcePhotoSha256": image_hash,
            "referenceImageCount": 1 if image is not None else None,
            "multiViewFusionVerified": False,
            "description": description.strip(),
            "sourceRightsAttested": rights_confirmed,
            "computeJobsRequested": 1 if image is not None else 0,
            "autoChargeOrRetry": False,
            "source": model,
            "generation": {"completed": True,
                           "profile": "operator-existing-local-gpu"
                           if image is not None else "reuse-existing-glb"},
            "optimization": {
                "requested": make_lods, "status": lod_status,
                "lodManifest": "lods/pack.json" if lods else None,
                "targetsMet": bool(lods and lods["triangleTargetsMet"]),
                "needsOptimization": not bool(lods and not lods["needsOptimization"]),
            },
            "comparison": {
                "matchedReference": bool(comparison),
                "report": "rodin-comparison.json" if comparison else None,
                "winner": None,
                "visualBlindStudyComplete": False,
            },
            "departments": [
                _department_plan(t, meta, issues, lods) for t in targets
            ],
            "release": {
                "published": False, "releaseApproved": False,
                "visual360Reviewed": False,
                "rigAndFacialTrackingApproved": False,
                "androidPerformanceTested": False,
                "cloudflareOwnerImportTested": False,
                "requiresHumanSignOff": True,
            },
        }
        if comparison is not None:
            (work / "rodin-comparison.json").write_text(
                json.dumps(comparison, indent=2, ensure_ascii=False) + "\n",
                encoding="utf-8",
            )
        (work / "manifest.json").write_text(
            json.dumps(bundle, indent=2, ensure_ascii=False) + "\n",
            encoding="utf-8",
        )
        # A full private pack appears at once; never overwrite a prior
        # creator draft or publish a half-verified model.
        if dest.exists():
            raise FileExistsError("private_output_must_not_exist")
        os.replace(work, dest)
    return bundle


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    sources = parser.add_mutually_exclusive_group(required=True)
    sources.add_argument("--glb", type=Path, help="Owner-supplied GLB; no GPU")
    sources.add_argument("--image", type=Path, help="Photo; owner GPU approval needed")
    parser.add_argument("--output", type=Path, required=True)
    parser.add_argument("--rights-confirmed", action="store_true")
    parser.add_argument("--permit-image-transfer", action="store_true")
    parser.add_argument("--execute-gpu-once", action="store_true")
    parser.add_argument("--targets", default=",".join(DEPARTMENTS))
    parser.add_argument("--description", default="")
    parser.add_argument("--rodin", type=Path)
    parser.add_argument("--same-reference-confirmed", action="store_true")
    parser.add_argument("--no-lods", action="store_true")
    parser.add_argument("--gltfpack", default="gltfpack")
    args = parser.parse_args()
    try:
        result = produce_private_draft(
            output_dir=args.output, glb=args.glb, image=args.image,
            rights_confirmed=args.rights_confirmed,
            permit_image_transfer=args.permit_image_transfer,
            execute_gpu_once=args.execute_gpu_once,
            targets=tuple(args.targets.split(",")),
            description=args.description, rodin=args.rodin,
            same_reference_confirmed=args.same_reference_confirmed,
            gltfpack=args.gltfpack, make_lods=not args.no_lods,
        )
    except (OSError, ValueError, PermissionError, RuntimeError) as exc:
        # Avoid printing user-supplied paths or remote response bodies.
        print("SPAKTOK_PRIVATE_PRODUCTION_FAILED:", type(exc).__name__,
              file=sys.stderr)
        return 1
    print(json.dumps({
        "status": "private-draft-created",
        "hash": result["source"]["sha256"],
        "triangles": result["source"]["triangles"],
        "lodStatus": result["optimization"]["status"],
        "departments": [d["target"] for d in result["departments"]],
        "published": False,
    }, indent=2))
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
