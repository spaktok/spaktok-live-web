#!/usr/bin/env python3
"""Offline verifier of Spaktok GPU ladder evidence; no GPU, network or uploads.

A JSON report alone is not proof of inference. Verification requires local GLB
bytes, a matching source image digest, an exact source commit and model revision.
This script deliberately does not assign any visual-quality score or publish.
"""
from __future__ import annotations

import argparse
import hashlib
import json
import re
import struct
from pathlib import Path

SHA = re.compile(r"^[0-9a-f]{64}$")
COMMIT = re.compile(r"^[0-9a-f]{40}$")
MODEL_REV = re.compile(r"^[A-Za-z0-9._/@:+-]{7,160}$")
MAX_BYTES = 200 * 1024 * 1024


def sha256_file(path: Path) -> str:
    digest = hashlib.sha256()
    with path.open("rb") as stream:
        for chunk in iter(lambda: stream.read(1024 * 1024), b""):
            digest.update(chunk)
    return digest.hexdigest()



def validate_glb_geometry(path: Path, size: int) -> dict:
    """Bounded structural check: require a binary-backed triangle mesh.

    A valid GLB header and SHA can still describe an EMPTY scene. This check
    rejects JSON-only, unbacked or malformed mesh data before evidence is accepted.
    It is NOT a replacement for the full PBR/topology/visual QA suite.
    """
    with path.open("rb") as stream:
        stream.seek(12)
        header = stream.read(8)
        if len(header) != 8:
            raise ValueError("invalid_glb_json_chunk")
        json_size, kind = struct.unpack("<I4s", header)
        if kind != b"JSON" or json_size < 16 or json_size % 4 or json_size > 8 * 1024 * 1024:
            raise ValueError("invalid_glb_json_chunk")
        json_bytes = stream.read(json_size)
        if len(json_bytes) != json_size:
            raise ValueError("invalid_glb_json_chunk")
        try:
            obj = json.loads(json_bytes.decode("utf-8"))
        except (UnicodeError, ValueError, TypeError):
            raise ValueError("invalid_glb_json")
        bin_header = stream.read(8)
        if len(bin_header) != 8:
            raise ValueError("missing_glb_binary")
        bin_length, bin_kind = struct.unpack("<I4s", bin_header)
        if bin_kind != b"BIN\\x00" or bin_length < 36 or 28 + json_size + bin_length != size:
            raise ValueError("invalid_glb_binary")
    if not isinstance(obj, dict) or (obj.get("asset") or {}).get("version") != "2.0":
        raise ValueError("invalid_gltf_version")
    buffers = obj.get("buffers")
    views = obj.get("bufferViews")
    accessors = obj.get("accessors")
    meshes = obj.get("meshes")
    if not all(isinstance(x, list) for x in (buffers, views, accessors, meshes)):
        raise ValueError("missing_mesh_geometry")
    if len(buffers) != 1 or buffers[0].get("uri") is not None or buffers[0].get("byteLength", 0) > bin_length:
        raise ValueError("unbacked_glb_buffer")
    triangles = 0
    for mesh in meshes:
        for primitive in mesh.get("primitives", []):
            if primitive.get("mode", 4) != 4:
                continue
            attrs = primitive.get("attributes", {})
            p = attrs.get("POSITION")
            if type(p) is not int or p < 0 or p >= len(accessors):
                continue
            pos = accessors[p]
            view_index = pos.get("bufferView")
            if type(view_index) is not int or not 0 <= view_index < len(views):
                continue
            view = views[view_index]
            offset = view.get("byteOffset", 0)
            length = view.get("byteLength")
            if (view.get("buffer") != 0 or type(offset) is not int or type(length) is not int or
                    offset < 0 or length < 36 or offset + length > bin_length or
                    pos.get("componentType") != 5126 or pos.get("type") != "VEC3" or
                    type(pos.get("count")) is not int or pos["count"] < 3 or
                    pos["count"] * 12 > length):
                continue
            indices = primitive.get("indices")
            if indices is None:
                count = pos["count"]
            elif type(indices) is int and 0 <= indices < len(accessors):
                count = accessors[indices].get("count", 0)
            else:
                continue
            if type(count) is int and count >= 3 and count % 3 == 0:
                triangles += count // 3
    if triangles == 0:
        raise ValueError("no_backed_triangle_mesh")
    return {"triangles": triangles, "structural_mesh_present": True}

def verify(report_path: Path, source_image: Path, *, expected_commit: str,
           expected_model_revision: str) -> dict:
    """Validate the report against actual local bytes (no trust in path strings).

    Paths in generated reports are untrusted; only names under report directory
    may be verified, preventing arbitrary filesystem reads or symlink escapes.
    """
    errors: list[str] = []
    if not COMMIT.fullmatch(expected_commit):
        return {"verified": False, "errors": ["invalid_expected_commit"]}
    if not MODEL_REV.fullmatch(expected_model_revision):
        return {"verified": False, "errors": ["invalid_expected_model_revision"]}
    try:
        report = json.loads(report_path.read_text(encoding="utf-8"))
    except (OSError, ValueError, UnicodeError):
        return {"verified": False, "errors": ["invalid_report"]}
    if not isinstance(report, dict) or report.get("tool") != "spaktok-rodin-parity-ladder":
        return {"verified": False, "errors": ["wrong_report_type"]}
    provenance = report.get("provenance")
    if not isinstance(provenance, dict):
        return {"verified": False, "errors": ["missing_provenance"]}
    if provenance.get("git_commit") != expected_commit:
        errors.append("commit_mismatch")
    if provenance.get("model_revision") != expected_model_revision:
        errors.append("model_revision_mismatch")
    try:
        if not source_image.is_file() or not 0 < source_image.stat().st_size <= 8 * 1024 * 1024:
            raise ValueError("invalid_source_size")
        if provenance.get("source_image_sha256") != sha256_file(source_image):
            errors.append("source_image_hash_mismatch")
    except (OSError, ValueError):
        errors.append("source_image_unavailable")
    rows = report.get("results")
    if not isinstance(rows, list) or not rows:
        return {"verified": False, "errors": errors + ["missing_profiles"]}
    verified_profiles = []
    base = report_path.resolve().parent
    for index, row in enumerate(rows):
        if not isinstance(row, dict) or row.get("ok") is not True:
            errors.append(f"profile_{index}_failed_or_missing")
            continue
        profile = row.get("profile")
        if not isinstance(profile, str) or not re.fullmatch(r"[a-z0-9-]{1,64}", profile):
            errors.append(f"profile_{index}_invalid")
            continue
        expected_name = f"spaktok-{profile}.glb"
        raw_path = row.get("glb")
        if not isinstance(raw_path, str) or Path(raw_path).name != expected_name:
            errors.append(f"profile_{index}_path_invalid")
            continue
        file_path = base / expected_name
        try:
            # Reject symlinks rather than follow them outside private output directory.
            if file_path.is_symlink() or not file_path.is_file() or file_path.resolve().parent != base:
                raise ValueError("unsafe_file")
            size = file_path.stat().st_size
            if not 28 <= size <= MAX_BYTES or size != row.get("bytes"):
                raise ValueError("size_mismatch")
            with file_path.open("rb") as handle:
                header = handle.read(12)
            if header[:4] != b"glTF" or int.from_bytes(header[4:8], "little") != 2 or int.from_bytes(header[8:12], "little") != size:
                raise ValueError("invalid_glb_header")
            geometry = validate_glb_geometry(file_path, size)
            digest = sha256_file(file_path)
            if not SHA.fullmatch(str(row.get("sha256", ""))) or digest != row["sha256"]:
                raise ValueError("hash_mismatch")
            if not isinstance(row.get("seconds"), (int, float)) or isinstance(row.get("seconds"), bool) or row["seconds"] < 0:
                raise ValueError("missing_duration")
            if not isinstance(row.get("peak_vram_gib"), (int, float)) or isinstance(row.get("peak_vram_gib"), bool) or row["peak_vram_gib"] < 0:
                raise ValueError("missing_vram")
            verified_profiles.append({"profile": profile, "bytes": size, "sha256": digest, **geometry})
        except (OSError, ValueError) as exc:
            # Error class only; never print local paths or sensitive job data.
            code = str(exc) if isinstance(exc, ValueError) else "file_unavailable"
            errors.append(f"profile_{index}_{code}")
    return {
        "verified": not errors and len(verified_profiles) == len(rows),
        "git_commit": expected_commit,
        "model_revision": expected_model_revision,
        "verified_profiles": verified_profiles,
        "errors": errors,
        "scope": "local_bytes_structural_mesh_and_operator_declared_provenance",
        "not_proven": ["real_gpu_identity", "visual_parity", "android_fps", "public_release"],
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--report", type=Path, required=True)
    parser.add_argument("--source-image", type=Path, required=True)
    parser.add_argument("--commit", required=True)
    parser.add_argument("--model-revision", required=True)
    args = parser.parse_args()
    result = verify(args.report, args.source_image,
                    expected_commit=args.commit,
                    expected_model_revision=args.model_revision)
    print(json.dumps(result, indent=2, sort_keys=True))
    return 0 if result["verified"] else 1


if __name__ == "__main__":
    raise SystemExit(main())
