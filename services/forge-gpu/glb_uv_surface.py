"""CPU-only glTF 2.0 GLB geometry/UV area audit for private Studio LODs.

Output is a *structural indicator* only, not visual fidelity or proof
that a mesh is ready to publish. Supports interleaved float32 attributes,
8/16/32-bit triangle indices and several distinct mesh primitives.
No external buffers, file downloads, GPU, dependencies, or HTTP.
"""
from __future__ import annotations

import json
import math
from pathlib import Path
import struct

MAX_BYTES = 35 * 1024 * 1024
MAX_TRIANGLES = 150_000
MAX_PRIMITIVES = 24
INDEX_FORMATS = {5121: ("B", 1), 5123: ("H", 2), 5125: ("I", 4)}
FLOAT_FORMATS = {"VEC2": 2, "VEC3": 3}


def inspect_glb_uv_surface(path: Path) -> dict:
    size = path.stat().st_size
    if not 28 <= size <= MAX_BYTES:
        raise ValueError("uv_glb_size_invalid")
    data = path.read_bytes()
    magic, version, total = struct.unpack_from("<4sII", data, 0)
    if magic != b"glTF" or version != 2 or total != size:
        raise ValueError("uv_glb_header_invalid")
    json_size, kind = struct.unpack_from("<I4s", data, 12)
    binary_header = 20 + json_size
    if (kind != b"JSON" or json_size < 16 or json_size % 4 or
            binary_header + 8 > size):
        raise ValueError("uv_glb_json_chunk_invalid")
    bin_len, bin_kind = struct.unpack_from("<I4s", data, binary_header)
    if bin_kind != b"BIN\x00" or binary_header + 8 + bin_len > size:
        raise ValueError("uv_glb_binary_chunk_invalid")
    j = json.loads(data[20:binary_header])
    buffers = j.get("buffers", [])
    if (j.get("asset", {}).get("version") != "2.0" or
            len(buffers) != 1 or buffers[0].get("uri") or
            not isinstance(buffers[0].get("byteLength"), int) or
            not 0 < buffers[0]["byteLength"] <= bin_len):
        raise ValueError("uv_glb_external_or_invalid_buffers")
    bin_limit = buffers[0]["byteLength"]
    views, accessors = j.get("bufferViews", []), j.get("accessors", [])
    meshes = j.get("meshes", [])
    primitives = [p for m in meshes for p in m.get("primitives", [])]
    if not 1 <= len(primitives) <= MAX_PRIMITIVES:
        raise ValueError("uv_glb_primitive_count_invalid")

    def accessor(identifier: int, expected: str, kind: str):
        if not isinstance(identifier, int) or not 0 <= identifier < len(accessors):
            raise ValueError("uv_glb_accessor_missing")
        a = accessors[identifier]
        width = 1 if kind == "index" else FLOAT_FORMATS[expected]
        ctype = a.get("componentType")
        if (a.get("type") != expected or "sparse" in a or
                (ctype not in INDEX_FORMATS if kind == "index" else ctype != 5126)):
            raise ValueError("uv_glb_accessor_unsupported")
        count = a.get("count")
        if not isinstance(count, int) or not 3 <= count <= MAX_TRIANGLES * 3:
            raise ValueError("uv_glb_accessor_count_invalid")
        view_id = a.get("bufferView")
        if not isinstance(view_id, int) or not 0 <= view_id < len(views):
            raise ValueError("uv_glb_buffer_view_missing")
        v = views[view_id]
        item_size = INDEX_FORMATS[ctype][1] if kind == "index" else width * 4
        stride = v.get("byteStride", item_size)
        offset = v.get("byteOffset", 0)
        inner = a.get("byteOffset", 0)
        length = v.get("byteLength")
        if (v.get("buffer") != 0 or
                not all(isinstance(x, int) for x in
                        (stride, offset, inner, length)) or
                stride < item_size or stride > 252 or
                offset < 0 or inner < 0 or length <= 0 or
                (offset + inner) % (INDEX_FORMATS[ctype][1] if kind == "index" else 4) or
                inner + (count - 1) * stride + item_size > length or
                offset + inner + (count - 1) * stride + item_size > bin_limit):
            raise ValueError("uv_glb_accessor_bounds_invalid")
        start = binary_header + 8 + offset + inner
        if kind == "index":
            fmt = "<" + INDEX_FORMATS[ctype][0]
        else:
            fmt = "<" + "f" * width
        values = [struct.unpack_from(fmt, data, start + i * stride)
                  for i in range(count)]
        return [x[0] for x in values] if kind == "index" else values

    loaded = []
    triangles = 0
    bounds_min = [math.inf] * 3
    bounds_max = [-math.inf] * 3
    for p in primitives:
        if p.get("mode", 4) != 4 or "indices" not in p:
            raise ValueError("uv_glb_requires_indexed_triangles")
        ix = accessor(p["indices"], "SCALAR", "index")
        positions = accessor(p.get("attributes", {}).get("POSITION"), "VEC3", "attr")
        uv = accessor(p.get("attributes", {}).get("TEXCOORD_0"), "VEC2", "attr")
        if len(ix) % 3 or len(uv) != len(positions):
            raise ValueError("uv_glb_triangle_or_uv_count_invalid")
        if any(i >= len(positions) for i in ix):
            raise ValueError("uv_glb_index_out_of_range")
        triangles += len(ix) // 3
        if triangles > MAX_TRIANGLES:
            raise ValueError("uv_glb_triangle_limit")
        for pt in positions:
            if not all(math.isfinite(x) for x in pt):
                raise ValueError("uv_glb_position_nonfinite")
            for axis in range(3):
                bounds_min[axis] = min(bounds_min[axis], pt[axis])
                bounds_max[axis] = max(bounds_max[axis], pt[axis])
        if any(not all(math.isfinite(x) for x in point) for point in uv):
            raise ValueError("uv_glb_texcoord_nonfinite")
        loaded.append((ix, positions, uv))

    diagonal = math.dist(bounds_min, bounds_max)
    if not math.isfinite(diagonal) or diagonal < 1e-8:
        raise ValueError("uv_glb_zero_extent")
    tiny_3d = diagonal * diagonal * 1e-11
    result = {
        "method": "indexed-triangle-3d-cross-products-and-uv-signed-area-v1",
        "triangles": triangles, "primitives": len(primitives),
        "surface_area_sum": 0.0, "uv_triangle_area_sum": 0.0,
        "uv_collapsed_triangles": 0, "tiny_3d_triangles": 0,
        "uv_out_of_unit_range_triangles": 0, "diagonal": diagonal,
        "visual_quality_tested": False,
        "approved_for_live": False,
    }
    for ix, points, uv in loaded:
        for i in range(0, len(ix), 3):
            a, b, c = [points[j] for j in ix[i:i+3]]
            ab = [b[k] - a[k] for k in range(3)]
            ac = [c[k] - a[k] for k in range(3)]
            cross = (
                ab[1] * ac[2] - ab[2] * ac[1],
                ab[2] * ac[0] - ab[0] * ac[2],
                ab[0] * ac[1] - ab[1] * ac[0],
            )
            area3 = math.sqrt(sum(x * x for x in cross)) / 2
            result["surface_area_sum"] += area3
            result["tiny_3d_triangles"] += area3 <= tiny_3d

            u, v, w = [uv[j] for j in ix[i:i+3]]
            uv_signed = ((v[0]-u[0])*(w[1]-u[1]) -
                         (v[1]-u[1])*(w[0]-u[0])) / 2
            area_uv = abs(uv_signed)
            result["uv_triangle_area_sum"] += area_uv
            result["uv_collapsed_triangles"] += area_uv <= 1e-10
            result["uv_out_of_unit_range_triangles"] += any(
                val < -0.001 or val > 1.001 for val in (*u, *v, *w)
            )
    result["uv_collapsed_fraction"] = result["uv_collapsed_triangles"] / triangles
    result["tiny_3d_fraction"] = result["tiny_3d_triangles"] / triangles
    return result
