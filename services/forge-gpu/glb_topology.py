"""Strict offline edge-incidence audit for GLB triangle meshes.

Input is untrusted; unsupported geometry reports an error and NEVER becomes
a pass. Counts per glTF primitive, since local indices of independent meshes
must not be merged into one global edge map.
"""
from __future__ import annotations

from collections import Counter
import json
from pathlib import Path
import struct

MAX_BYTES = 35 * 1024 * 1024
MAX_TRIANGLES = 150_000
MAX_PRIMITIVES = 24
SIZES = {5121: 1, 5123: 2, 5125: 4}
UNPACK = {5121: "<B", 5123: "<H", 5125: "<I"}


def scan_glb_topology(path: Path) -> dict:
    size = path.stat().st_size
    if not 28 <= size <= MAX_BYTES:
        raise ValueError("topology_glb_size_invalid")
    raw = path.read_bytes()
    magic, version, total = struct.unpack_from("<4sII", raw, 0)
    if magic != b"glTF" or version != 2 or total != size:
        raise ValueError("topology_glb_header_invalid")
    json_size, json_kind = struct.unpack_from("<I4s", raw, 12)
    if json_kind != b"JSON" or json_size < 16 or json_size % 4:
        raise ValueError("topology_glb_json_chunk_invalid")
    start = 20 + json_size
    if start + 8 > size:
        raise ValueError("topology_glb_bin_missing")
    bin_length, bin_kind = struct.unpack_from("<I4s", raw, start)
    if bin_kind != b"BIN\x00" or bin_length % 4 or start + 8 + bin_length > size:
        raise ValueError("topology_glb_bin_invalid")
    document = json.loads(raw[20:start].decode("utf-8"))
    buffers = document.get("buffers", [])
    if (document.get("asset", {}).get("version") != "2.0" or
            len(buffers) != 1 or buffers[0].get("uri") or
            not isinstance(buffers[0].get("byteLength"), int) or
            not 0 < buffers[0]["byteLength"] <= bin_length):
        raise ValueError("topology_unsupported_external_buffers")
    max_buffer = buffers[0]["byteLength"]
    accessors = document.get("accessors", [])
    views = document.get("bufferViews", [])
    primitives = [
        p for mesh in document.get("meshes", [])
        for p in mesh.get("primitives", [])
    ]
    if not 1 <= len(primitives) <= MAX_PRIMITIVES:
        raise ValueError("topology_unsupported_primitive_count")
    result = {
        "triangles": 0, "edges": 0, "boundary_edges": 0,
        "nonmanifold_edges": 0, "degenerate_index_triangles": 0,
        "checked_primitives": 0, "verified": True, "publish_ready": False,
    }
    for primitive in primitives:
        indexed = primitive.get("indices")
        position = primitive.get("attributes", {}).get("POSITION")
        if (primitive.get("mode", 4) != 4 or
                not isinstance(indexed, int) or not isinstance(position, int) or
                indexed < 0 or position < 0 or
                indexed >= len(accessors) or position >= len(accessors)):
            raise ValueError("topology_requires_indexed_triangles")
        idx = accessors[indexed]
        pos = accessors[position]
        count = idx.get("count")
        vertices = pos.get("count")
        dtype = idx.get("componentType")
        if (idx.get("type") != "SCALAR" or dtype not in SIZES or
                "sparse" in idx or
                not isinstance(count, int) or count < 3 or count % 3 or
                not isinstance(vertices, int) or vertices < 3):
            raise ValueError("topology_invalid_accessor")
        result["triangles"] += count // 3
        if result["triangles"] > MAX_TRIANGLES:
            raise ValueError("topology_triangle_limit")
        bv_index = idx.get("bufferView")
        if not isinstance(bv_index, int) or not 0 <= bv_index < len(views):
            raise ValueError("topology_index_view_missing")
        bv = views[bv_index]
        offset = bv.get("byteOffset", 0)
        inner = idx.get("byteOffset", 0)
        view_size = bv.get("byteLength")
        item_size = SIZES[dtype]
        if (bv.get("buffer") != 0 or "byteStride" in bv or
                not all(isinstance(v, int) for v in (offset, inner, view_size)) or
                offset < 0 or inner < 0 or view_size <= 0 or
                inner + count * item_size > view_size or
                offset + inner + count * item_size > max_buffer or
                (offset + inner) % item_size):
            raise ValueError("topology_invalid_index_buffer")
        loc = start + 8 + offset + inner
        index_format = UNPACK[dtype]
        edges: Counter[tuple[int, int]] = Counter()
        for i in range(0, count, 3):
            a, b, c = (
                struct.unpack_from(index_format, raw, loc + (i+j)*item_size)[0]
                for j in range(3)
            )
            if a >= vertices or b >= vertices or c >= vertices:
                raise ValueError("topology_index_out_of_range")
            if len({a, b, c}) < 3:
                result["degenerate_index_triangles"] += 1
                continue
            for x, y in ((a,b),(b,c),(c,a)):
                edges[(min(x,y), max(x,y))] += 1
        result["edges"] += len(edges)
        result["boundary_edges"] += sum(c == 1 for c in edges.values())
        result["nonmanifold_edges"] += sum(c > 2 for c in edges.values())
        result["checked_primitives"] += 1
    return result
