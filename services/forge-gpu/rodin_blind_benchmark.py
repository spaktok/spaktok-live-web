#!/usr/bin/env python3
"""20-reference, human-blind Rodin vs Spaktok evidence gate.

No Rodin API calls, GPU rental, model uploads or invented "better" scores.
Owner supplies rights-cleared inputs, the TWO private GLBs generated from each
same image, recorded costs/latencies, and five independent blind judgments.
The tool separately compares GLB structure and visual-review completeness.
A favorable metric is evidence, not public-release or likeness certification.
"""
from __future__ import annotations

import argparse
import json
import math
from pathlib import Path
import statistics
import sys

from benchmark_glb_quality import inspect_glb

CATEGORIES = (
    ("stylized_character", 4),
    ("human_face", 4),
    ("intricate_accessory", 3),
    ("clothing_or_hair", 3),
    ("transparent_or_reflective", 2),
    ("hard_surface", 2),
    ("rear_occlusion", 2),
)
HASH_HEX = set("0123456789abcdef")


def template() -> dict:
    cases = []
    count = 0
    for category, amount in CATEGORIES:
        for _ in range(amount):
            count += 1
            cases.append({
                "id": f"ref-{count:02d}",
                "category": category,
                "rightsConfirmed": False,
                "referenceSha256": None,
                "sameReferenceConfirmed": False,
                "spaktokGlb": None,
                "rodinGlb": None,
                "costEUR": {"spaktok": None, "rodin": None},
                "latencySeconds": {"spaktok": None, "rodin": None},
                "blindVotes": [],
            })
    return {
        "schema": "spaktok-rodin-blind-v1",
        "note": "Private references only; 5 independent raters x 20 same-image cases. No results are implied.",
        "cases": cases,
    }


def _hash(s: object) -> bool:
    return isinstance(s, str) and len(s) == 64 and all(c in HASH_HEX for c in s)


def _nonnegative(v: object) -> bool:
    return isinstance(v, (float, int)) and not isinstance(v, bool) and math.isfinite(v) and v >= 0


def _vote(v: object) -> bool:
    return isinstance(v, dict) and isinstance(v.get("raterId"), str) and (
        1 <= len(v["raterId"]) <= 40
    ) and v.get("preferred") in ("spaktok", "rodin", "tie")


def _wilson_lower(wins: int, count: int, *, z: float = 1.96) -> float:
    if count < 1:
        return 0.
    p = wins / count
    denom = 1 + z*z/count
    return max(0., (p + z*z/(2*count) - z*math.sqrt(
        (p*(1-p)+z*z/(4*count))/count
    )) / denom)


def inspect_suite(spec: dict) -> dict:
    if not isinstance(spec, dict) or spec.get("schema") != "spaktok-rodin-blind-v1":
        raise ValueError("benchmark_schema_invalid")
    cases = spec.get("cases")
    if not isinstance(cases, list) or len(cases) != 20:
        raise ValueError("benchmark_requires_exactly_20_references")
    if len({case.get("id") for case in cases if isinstance(case, dict)}) != 20:
        raise ValueError("benchmark_case_ids_not_unique")
    recognized = {name for name, _ in CATEGORIES}
    results = []
    allVotes = []
    completeCosts = []
    completeTimes = []
    for item in cases:
        if not isinstance(item, dict) or not isinstance(item.get("id"), str):
            raise ValueError("benchmark_case_invalid")
        case_id = item["id"]
        if (len(case_id) > 40 or not case_id.isascii() or
                not all(c.isalnum() or c in "-_" for c in case_id) or
                item.get("category") not in recognized):
            raise ValueError("benchmark_case_metadata_invalid")
        votes = item.get("blindVotes", [])
        if not isinstance(votes, list) or len(votes) > 5 or not all(_vote(v) for v in votes):
            raise ValueError("benchmark_votes_invalid")
        if len({v["raterId"] for v in votes}) != len(votes):
            raise ValueError("benchmark_rater_duplicated")
        if (not isinstance(item.get("rightsConfirmed"), bool) or
                not isinstance(item.get("sameReferenceConfirmed"), bool)):
            raise ValueError("benchmark_confirmation_invalid")
        costs = item.get("costEUR")
        times = item.get("latencySeconds")
        if not isinstance(costs, dict) or not isinstance(times, dict):
            raise ValueError("benchmark_economics_invalid")
        for measured in (costs, times):
            if any(measured.get(k) is not None and not _nonnegative(measured[k])
                   for k in ("rodin", "spaktok")):
                raise ValueError("benchmark_economics_invalid")
        ref = item.get("referenceSha256")
        if ref is not None and not _hash(ref):
            raise ValueError("benchmark_reference_hash_invalid")
        paired = (
            item["rightsConfirmed"] and item["sameReferenceConfirmed"] and
            _hash(ref) and
            isinstance(item.get("spaktokGlb"), str) and
            isinstance(item.get("rodinGlb"), str)
        )
        stats = None
        missing = []
        if not paired:
            missing.append("same_rights_cleared_reference_and_two_models_missing")
        else:
            try:
                left = Path(item["spaktokGlb"]).resolve(strict=True)
                right = Path(item["rodinGlb"]).resolve(strict=True)
                if (left.suffix.lower() != ".glb" or
                        right.suffix.lower() != ".glb" or left == right):
                    raise ValueError("benchmark_distinct_glbs_required")
                a, b = inspect_glb(left), inspect_glb(right)
                # Do not include user file paths or source contents in report.
                stats = {
                    "spaktok": {k: a[k] for k in
                                ("sha256", "bytes", "triangles", "pbr_material_count",
                                 "embedded_image_count", "morph_target_count",
                                 "skin_count", "animation_count")},
                    "rodin": {k: b[k] for k in
                              ("sha256", "bytes", "triangles", "pbr_material_count",
                               "embedded_image_count", "morph_target_count",
                               "skin_count", "animation_count")},
                    "visualQualityMeasuredByMachine": False,
                }
            except (OSError, ValueError, KeyError, TypeError):
                missing.append("paired_model_invalid_or_unavailable")
        if len(votes) < 5:
            missing.append("five_blind_independent_votes_required")
        if any(costs.get(x) is None for x in ("spaktok", "rodin")):
            missing.append("measured_cost_both_models_required")
        if any(times.get(x) is None for x in ("spaktok", "rodin")):
            missing.append("measured_latency_both_models_required")
        complete = not missing and stats is not None
        if complete:
            allVotes.extend(v["preferred"] for v in votes)
            completeCosts.append((costs["spaktok"], costs["rodin"]))
            completeTimes.append((times["spaktok"], times["rodin"]))
        results.append({
            "id": case_id, "category": item["category"],
            "complete": complete,
            "missing": missing,
            "technical": stats,
            "blindJudgmentsCollected": len(votes),
            "sourceImageHashVerifiedAgainstModels": False,
            # A claimed identical reference is not a cryptographic visual
            # provenance guarantee; only operator attestation is represented.
        })
    complete_count = sum(row["complete"] for row in results)
    decisive = [v for v in allVotes if v != "tie"]
    wins = sum(v == "spaktok" for v in decisive)
    lower = _wilson_lower(wins, len(decisive))
    medCost = (
        {"spaktok": statistics.median(a for a, _ in completeCosts),
         "rodin": statistics.median(b for _, b in completeCosts)}
        if completeCosts else None
    )
    medTime = (
        {"spaktok": statistics.median(a for a, _ in completeTimes),
         "rodin": statistics.median(b for _, b in completeTimes)}
        if completeTimes else None
    )
    eligible = complete_count == 20 and len(allVotes) == 100
    return {
        "schema": "spaktok-rodin-benchmark-evidence-v1",
        "totalCases": 20,
        "completedCases": complete_count,
        "readyForReview": eligible,
        "blindVotes": {
            "count": len(allVotes),
            "spaktok": allVotes.count("spaktok"),
            "rodin": allVotes.count("rodin"),
            "tie": allVotes.count("tie"),
            "decisiveCount": len(decisive),
            "spaktokPreferenceShare": wins/len(decisive) if decisive else None,
            "wilson95LowerBound": lower if decisive else None,
        },
        "medianCostEUR": medCost,
        "medianLatencySeconds": medTime,
        "preferenceThreshold60PercentReached": (
            eligible and len(decisive) >= 80 and
            wins/len(decisive) >= .6 and lower > .5
        ),
        "releaseApproved": False,
        "winner": None,
        "reason": "Human quality review, production parity and permissions required; technical counts are not artistic likeness scores.",
        "cases": results,
    }


def main() -> int:
    cli = argparse.ArgumentParser(description=__doc__)
    modes = cli.add_mutually_exclusive_group(required=True)
    modes.add_argument("--create-template", type=Path)
    modes.add_argument("--audit", type=Path)
    cli.add_argument("--output", type=Path)
    args = cli.parse_args()
    try:
        if args.create_template is not None:
            if args.output is not None:
                raise ValueError("template_output_is_create_template")
            with args.create_template.open("x", encoding="utf-8") as f:
                json.dump(template(), f, ensure_ascii=False, indent=2)
                f.write("\n")
            print("SPAKTOK_20_REFERENCE_BLIND_TEMPLATE_CREATED")
        else:
            if args.output is None:
                raise ValueError("benchmark_output_required")
            raw = args.audit.read_bytes()
            if len(raw) > 128 * 1024:
                raise ValueError("benchmark_input_too_large")
            report = inspect_suite(json.loads(raw))
            with args.output.open("x", encoding="utf-8") as f:
                json.dump(report, f, ensure_ascii=False, indent=2)
                f.write("\n")
            print(json.dumps({
                "status": "benchmark_evidence_written",
                "completedCases": report["completedCases"],
                "winner": None,
                "releaseApproved": False,
            }))
    except (ValueError, OSError, TypeError, KeyError):
        print("SPAKTOK_BLIND_BENCHMARK_FAILED", file=sys.stderr)
        return 1
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
