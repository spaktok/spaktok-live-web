#!/usr/bin/env python3
"""Generate four private SVG orthographic wireframe review views from a GLB.

Read-only mesh inspection, not PBR render, silhouette proof, or visual
similarity scoring. Full PBR review still uses a real GLTF/WebGL or Blender
renderer. SVGs contain no source images and require no GPU or network.
"""
from __future__ import annotations

import argparse
import math
from pathlib import Path
import struct
import xml.etree.ElementTree as ET

from glb_topology import scan_glb_topology
from glb_position_weld_audit import scan_glb_position_weld

WIDTH = 600
HEIGHT = 600
PAD = 35
MAX_DRAW_TRIANGLES = 2000
# dir: x horizontal projected coordinate, y vertical projected coordinate
VIEWS = {
    "front": (0, 1, 1, 1),
    "back": (0, 1, -1, 1),
    "left": (2, 1, 1, 1),
    "right": (2, 1, -1, 1),
}


def _geometry(path: Path):
    import json
    raw = path.read_bytes()
    head = struct.unpack_from("<I", raw, 12)[0]
    doc = json.loads(raw[20:20+head])
    base = 20 + head + 8
    accessors = doc["accessors"]
    views = doc["bufferViews"]
    geometry = []
    global_min = [math.inf]*3
    global_max = [-math.inf]*3
    for mesh in doc["meshes"]:
        for prim in mesh["primitives"]:
            pos = accessors[prim["attributes"]["POSITION"]]
            idx = accessors[prim["indices"]]
            if (pos["type"] != "VEC3" or pos["componentType"] != 5126 or
                    "sparse" in pos):
                raise ValueError("wireframe_requires_float_position")
            pview = views[pos["bufferView"]]
            stride = pview.get("byteStride", 12)
            pbase = base + pview.get("byteOffset",0) + pos.get("byteOffset",0)
            points = []
            for i in range(pos["count"]):
                xyz = struct.unpack_from("<fff",raw,pbase+i*stride)
                if not all(math.isfinite(n) for n in xyz):
                    raise ValueError("wireframe_nonfinite_coordinate")
                points.append(xyz)
                for dim in range(3):
                    global_min[dim] = min(global_min[dim],xyz[dim])
                    global_max[dim] = max(global_max[dim],xyz[dim])
            iview = views[idx["bufferView"]]
            ibase = base+iview.get("byteOffset",0)+idx.get("byteOffset",0)
            data_type = idx["componentType"]
            if data_type not in (5121,5123,5125):
                raise ValueError("wireframe_index_type_unsupported")
            fmt, sz = {5121:("<B",1),5123:("<H",2),5125:("<I",4)}[data_type]
            step = max(1,math.ceil((idx["count"]//3)/MAX_DRAW_TRIANGLES))
            triangles = []
            for i in range(0,idx["count"]//3,step):
                face = tuple(struct.unpack_from(
                    fmt,raw,ibase+(i*3+j)*sz
                )[0] for j in range(3))
                if max(face)>=len(points):
                    raise ValueError("wireframe_index_out_of_range")
                triangles.append(face)
            geometry.append((points,triangles,step))
    if not geometry or any(not math.isfinite(v) for v in global_min+global_max):
        raise ValueError("wireframe_empty_model")
    return geometry, global_min, global_max


def create_wireframe_review(
    source: Path, output: Path, *, max_faces_per_primitive: int = MAX_DRAW_TRIANGLES
) -> dict:
    """Create four PRIVATE SVGs. Output dir must be new and parent must exist."""
    if not 200 <= max_faces_per_primitive <= MAX_DRAW_TRIANGLES:
        raise ValueError("wireframe_draw_budget_invalid")
    if output.exists():
        raise FileExistsError("wireframe_output_exists")
    if not output.parent.is_dir():
        raise ValueError("wireframe_parent_missing")
    # Full structural scans first; no malformed index buffers accepted.
    scan_glb_topology(source)
    scan_glb_position_weld(source)
    geometries, lows, highs = _geometry(source)
    # Preserve non-degenerate common scale in all four views.
    span = max(highs[d]-lows[d] for d in range(3))
    if not math.isfinite(span) or span < 1e-7:
        raise ValueError("wireframe_invalid_scale")
    center = [(a+b)*0.5 for a,b in zip(lows,highs)]
    factor = (min(WIDTH,HEIGHT)-2*PAD)/span
    # Precreate outputs in the pipeline's private scratch; never overwrite.
    output.mkdir()
    paths=[]
    totalDrawn=0
    for name,(axis_x,axis_y,flip_x,flip_y) in VIEWS.items():
        svg=ET.Element("svg",{
            "xmlns":"http://www.w3.org/2000/svg",
            "viewBox":f"0 0 {WIDTH} {HEIGHT}",
            "role":"img",
            "aria-label":f"Spaktok private {name} sparse orthographic wireframe",
        })
        ET.SubElement(svg,"rect",{
            "width":str(WIDTH),"height":str(HEIGHT),"fill":"#0f172a",
        })
        ET.SubElement(svg,"text",{
            "x":"22","y":"28","fill":"#e2e8f0",
            "font-size":"18",
        }).text=f"{name.upper()} / WIREFRAME SAMPLE ONLY"
        group=ET.SubElement(svg,"g",{
            "stroke":"#93c5fd","stroke-width":"0.6",
            "stroke-opacity":"0.60","fill":"none","stroke-linejoin":"round",
        })
        for points,triangles,step in geometries:
            stride=max(1,math.ceil(len(triangles)/max_faces_per_primitive))
            for face in triangles[::stride]:
                coords=[]
                for i in face:
                    p=points[i]
                    x=WIDTH/2+(p[axis_x]-center[axis_x])*factor*flip_x
                    y=HEIGHT/2-(p[axis_y]-center[axis_y])*factor*flip_y
                    coords.append(f"{x:.2f},{y:.2f}")
                ET.SubElement(group,"polygon",{"points":" ".join(coords)})
                totalDrawn+=1
        dest=output/(name+".svg")
        ET.ElementTree(svg).write(dest,encoding="utf-8",xml_declaration=True)
        paths.append(dest.name)
    return {
        "format": "spaktok-private-wireframe-review-v1",
        "type": "sparse-wireframe-not-PBR",
        "files": paths,
        "sampledFacesAcrossFourViews": totalDrawn,
        "humanReviewRequired": True,
        "visualSimilarityProven": False,
        "publicationApproved": False,
    }


if __name__=="__main__":
    p=argparse.ArgumentParser(description=__doc__)
    p.add_argument("--source",type=Path,required=True)
    p.add_argument("--output",type=Path,required=True)
    a=p.parse_args()
    try:
        info=create_wireframe_review(a.source,a.output)
    except (OSError,ValueError,IndexError,KeyError,struct.error):
        raise SystemExit("SPAKTOK_PRIVATE_WIREFRAME_FAILED")
    print(info)
