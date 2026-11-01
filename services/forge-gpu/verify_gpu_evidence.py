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
            digest = sha256_file(file_path)
            if not SHA.fullmatch(str(row.get("sha256", ""))) or digest != row["sha256"]:
                raise ValueError("hash_mismatch")
            if not isinstance(row.get("seconds"), (int, float)) or isinstance(row.get("seconds"), bool) or row["seconds"] < 0:
                raise ValueError("missing_duration")
            if not isinstance(row.get("peak_vram_gib"), (int, float)) or isinstance(row.get("peak_vram_gib"), bool) or row["peak_vram_gib"] < 0:
                raise ValueError("missing_vram")
            verified_profiles.append({"profile": profile, "bytes": size, "sha256": digest})
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
        "scope": "local_bytes_and_provenance_only",
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
