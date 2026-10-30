"""Conservative offline POSITION-weld geometry audit for owner-private GLBs.

Unlike an index-only scan, this groups nearly coincident POSITION vertices
*within* each glTF mesh primitive before computing edge incidence. It can
detect index-hidden shared edges, but cannot distinguish intended overlapping
surfaces, UV seams, separate shells, or true defects without visual review.
Do NOT use it as proof of watertightness or automatic release authorization.

Only indexed, uncompressed, self-contained float32 VEC3 positions are
supported; all other inputs fail closed. Never uploads any model.
"""
from __future__ import annotations

from collections import Counter
import json
import math
from pathlib import Path
import struct

from glb_topology import (
    MAX_BYTES, MAX_PRIMITIVES, MAX_TRIANGLES,
    SIZES, UNPACK, scan_glb_topology,
)

RELATIVE_TOLERANCE = 1e-6
MAX_POSITION_VERTICES = 500_000


def _unsigned(value: object, *, minimum: int = 0) -> bool:
    return type(value) is int and value >= minimum


def scan_glb_position_weld(
    path: Path, *, relative_tolerance: float = RELATIVE_TOLERANCE
) -> dict:
    """Read-only index + positional edge-incidence diagnostics, per primitive."""
    if (not isinstance(relative_tolerance, (int, float)) or
            isinstance(relative_tolerance, bool) or
            not math.isfinite(relative_tolerance) or
            not 0 < relative_tolerance <= 1e-4):
        raise ValueError("position_weld_tolerance_invalid")
    indexed = scan_glb_topology(path)  # Validates bounded GLB and index views.
    raw = path.read_bytes()
    if not 28 <= len(raw) <= MAX_BYTES:
        raise ValueError("position_weld_size_invalid")
    json_size = struct.unpack_from("<I", raw, 12)[0]
    bin_base = 20 + json_size + 8
    doc = json.loads(raw[20:20+json_size])
    binary_limit = doc["buffers"][0]["byteLength"]
    views, accessors = doc.get("bufferViews", []), doc.get("accessors", [])
    primitives = [
        p for mesh in doc.get("meshes", [])
        for p in mesh.get("primitives", [])
    ]
    if not 1 <= len(primitives) <= MAX_PRIMITIVES:
        raise ValueError("position_weld_primitive_count_invalid")
    result = {
        "triangles": indexed["triangles"],
        "position_vertices": 0,
        "welded_vertices": 0,
        "duplicate_position_vertices": 0,
        "boundary_edges_after_position_weld": 0,
        "nonmanifold_edges_after_position_weld": 0,
        "degenerate_triangles_after_position_weld": 0,
        "max_edge_incidence_after_position_weld": 0,
        "relative_tolerance_to_bbox_diagonal": float(relative_tolerance),
        "checked_primitives": 0,
        "verified": True,
        "publish_ready": False,
        "human_visual_review_required": True,
    }
    for prim in primitives:
        p_idx = prim["attributes"]["POSITION"]
        i_idx = prim["indices"]
        pos, indices = accessors[p_idx], accessors[i_idx]
        num_positions = pos.get("count")
        if (pos.get("type") != "VEC3" or pos.get("componentType") != 5126 or
                "sparse" in pos or "normalized" in pos or
                not _unsigned(num_positions, minimum=3) or
                num_positions > MAX_POSITION_VERTICES):
            raise ValueError("position_weld_requires_float_positions")
        v_idx = pos.get("bufferView")
        if not _unsigned(v_idx) or v_idx >= len(views):
            raise ValueError("position_weld_missing_view")
        view = views[v_idx]
        view_off = view.get("byteOffset", 0)
        inner_off = pos.get("byteOffset", 0)
        view_len = view.get("byteLength")
        stride = view.get("byteStride", 12)
        if (view.get("buffer") != 0 or
                not all(_unsigned(v) for v in (view_off, inner_off, view_len, stride)) or
                stride < 12 or stride % 4 or
                view_len < 12 or
                inner_off + (num_positions-1)*stride + 12 > view_len or
                view_off + inner_off + (num_positions-1)*stride + 12 > binary_limit or
                (view_off + inner_off) % 4):
            raise ValueError("position_weld_invalid_position_bounds")
        absolute = bin_base + view_off + inner_off
        positions = [
            struct.unpack_from("<fff", raw, absolute + i*stride)
            for i in range(num_positions)
        ]
        if any(not math.isfinite(v) for p in positions for v in p):
            raise ValueError("position_weld_nonfinite_position")
        low = [min(p[k] for p in positions) for k in range(3)]
        high = [max(p[k] for p in positions) for k in range(3)]
        diagonal = math.dist(low, high)
        if not math.isfinite(diagonal) or diagonal <= 0:
            raise ValueError("position_weld_invalid_bounds")
        tolerance = diagonal * float(relative_tolerance)
        positions_to_id: dict[tuple[int, int, int], int] = {}
        welded_ids = []
        for x, y, z in positions:
            key = (
                round((x-low[0])/tolerance),
                round((y-low[1])/tolerance),
                round((z-low[2])/tolerance),
            )
            welded_ids.append(
                positions_to_id.setdefault(key, len(positions_to_id))
            )
        # scan_glb_topology validated every index accessor and buffer range.
        idx_view = views[indices["bufferView"]]
        idx_off = (bin_base + idx_view.get("byteOffset", 0) +
                   indices.get("byteOffset", 0))
        size = SIZES[indices["componentType"]]
        unpack_fmt = UNPACK[indices["componentType"]]
        edges: Counter[tuple[int, int]] = Counter()
        degenerate = 0
        for offset in range(0, indices["count"]*size, 3*size):
            a, b, c = (
                welded_ids[struct.unpack_from(
                    unpack_fmt, raw, idx_off + offset + j*size
                )[0]]
                for j in range(3)
            )
            if len({a, b, c}) < 3:
                degenerate += 1
                continue
            for x, y in ((a, b), (b, c), (c, a)):
                edges[(min(x, y), max(x, y))] += 1
        result["position_vertices"] += num_positions
        result["welded_vertices"] += len(positions_to_id)
        result["duplicate_position_vertices"] += (
            num_positions-len(positions_to_id)
        )
        result["boundary_edges_after_position_weld"] += sum(
            hits == 1 for hits in edges.values()
        )
        result["nonmanifold_edges_after_position_weld"] += sum(
            hits > 2 for hits in edges.values()
        )
        result["degenerate_triangles_after_position_weld"] += degenerate
        result["max_edge_incidence_after_position_weld"] = max(
            result["max_edge_incidence_after_position_weld"],
            max(edges.values(), default=0),
        )
        result["checked_primitives"] += 1
    return result


if __name__ == "__main__":
    import argparse
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("path", type=Path)
    args = parser.parse_args()
    print(json.dumps(scan_glb_position_weld(args.path), indent=2))
