"""CPU-only mobile GLB finalization: add normals without rerunning inference.

Process a previously generated textured TRELLIS GLB, retain its geometry,
UV mapping and embedded PBR texture, and write a SEPARATE review file.
This is a structural audit only, not a rendering/FPS/rigging certification.
"""
from __future__ import annotations

import hashlib
import io
import json
import sys
from pathlib import Path


def finalize_mobile_glb(source: Path, output: Path) -> dict:
    import numpy as np
    import trimesh
    from glb_quality import inspect_glb_bytes

    source = Path(source)
    output = Path(output)
    if not source.is_file() or source.resolve() == output.resolve():
        raise ValueError("invalid_original_glb_path")
    if output.exists():
        raise FileExistsError("refusing_to_overwrite_existing_file")

    original = source.read_bytes()
    before = inspect_glb_bytes(original)
    if not before["hasUV"] or not before["pbrMaterials"] or not before["embeddedImages"]:
        raise ValueError("source_missing_uv_pbr_or_embedded_image")
    scene = trimesh.load(io.BytesIO(original), file_type="glb", force="scene", process=False)
    meshes = [mesh for mesh in scene.geometry.values() if isinstance(mesh, trimesh.Trimesh)]
    if not meshes:
        raise ValueError("source_no_triangle_meshes")
    for mesh in meshes:
        if not len(mesh.faces) or not len(mesh.vertices):
            raise ValueError("source_mesh_empty")
        normals = np.asarray(mesh.vertex_normals)
        if normals.shape != (len(mesh.vertices), 3) or not np.isfinite(normals).all():
            raise ValueError("computed_normals_invalid")
        mesh.vertex_normals = normals.copy()

    updated = scene.export(file_type="glb")
    after = inspect_glb_bytes(updated)
    if (not after["hasNormals"] or not after["hasUV"]
            or after["pbrMaterials"] < before["pbrMaterials"]
            or after["embeddedImages"] < before["embeddedImages"]
            or not after["mobileBudgetPass"]):
        raise ValueError("finalized_glb_fails_mobile_structure_budget")
    if after["triangles"] != before["triangles"]:
        raise ValueError("finalizer_changed_triangle_count")
    with output.open("xb") as dest:
        dest.write(updated)
    return {"originalFile": str(source), "mobileFile": str(output),
            "sha256": hashlib.sha256(updated).hexdigest(), "metrics": after,
            "note": "Normals/material preservation only; still test visual quality and FPS on Android."}


if __name__ == "__main__":
    if len(sys.argv) != 3:
        raise SystemExit("Usage: glb_mobile_finalize.py INPUT.glb OUTPUT-mobile.glb")
    print(json.dumps(finalize_mobile_glb(Path(sys.argv[1]), Path(sys.argv[2]))))
