"""Strict bounded GLB structural and mobile deployment metrics for Spaktok.

No GPU or third-party packages. This is NOT a visual similarity score.
"""
import json
import struct
from pathlib import Path

MAX_GLB = 512 * 1024 * 1024
GLB_JSON = 0x4E4F534A


def inspect_glb_bytes(data: bytes) -> dict:
    if not 28 <= len(data) <= MAX_GLB or data[:4] != b"glTF":
        raise ValueError("glb_header_invalid")
    version, total = struct.unpack_from("<II", data, 4)
    if version != 2 or total != len(data):
        raise ValueError("glb_version_or_size_invalid")
    offset = 12
    if offset + 8 > len(data):
        raise ValueError("glb_json_chunk_missing")
    length, chunk_type = struct.unpack_from("<II", data, offset)
    offset += 8
    if chunk_type != GLB_JSON or length % 4 or offset + length > len(data):
        raise ValueError("glb_json_chunk_invalid")
    try:
        doc = json.loads(data[offset:offset + length].rstrip(b" \x00\t\r\n"))
    except (ValueError, UnicodeError) as exc:
        raise ValueError("glb_json_invalid") from exc
    if not isinstance(doc, dict) or doc.get("asset", {}).get("version") != "2.0":
        raise ValueError("gltf_asset_invalid")
    accessors = doc.get("accessors", [])
    materials = doc.get("materials", [])
    triangles = 0
    primitives = 0
    uv_count = normal_count = 0
    for mesh in doc.get("meshes", []):
        for primitive in mesh.get("primitives", []):
            mode = primitive.get("mode", 4)
            if mode != 4:
                continue
            primitives += 1
            attr = primitive.get("attributes", {})
            uv_count += int("TEXCOORD_0" in attr)
            normal_count += int("NORMAL" in attr)
            index = primitive.get("indices", attr.get("POSITION"))
            if not isinstance(index, int) or not 0 <= index < len(accessors):
                raise ValueError("glb_invalid_accessor")
            count = accessors[index].get("count", 0)
            if not isinstance(count, int) or count < 3:
                raise ValueError("glb_invalid_accessor_count")
            triangles += count // 3
    if not primitives or not triangles:
        raise ValueError("glb_no_triangles")
    pbr = sum(1 for m in materials if isinstance(m, dict) and
              isinstance(m.get("pbrMetallicRoughness"), dict))
    return {
        "bytes": len(data), "meshes": len(doc.get("meshes", [])),
        "trianglePrimitives": primitives, "triangles": triangles,
        "hasUV": uv_count > 0, "hasNormals": normal_count > 0,
        "pbrMaterials": pbr, "embeddedImages": len(doc.get("images", [])),
        "mobileBudgetPass": (
            len(data) <= 15 * 1024 * 1024 and triangles <= 150000 and
            uv_count == primitives and normal_count == primitives and pbr > 0
        ),
        "note": "Structural metrics only; does not prove image similarity, rigging, privacy rights or Rodin-level appearance.",
    }


def inspect_glb_file(path: str) -> dict:
    file = Path(path)
    if not file.is_file() or file.stat().st_size > MAX_GLB:
        raise ValueError("missing_or_oversized_glb")
    return inspect_glb_bytes(file.read_bytes())


if __name__ == "__main__":
    import sys
    try:
        print(json.dumps(inspect_glb_file(sys.argv[1]), ensure_ascii=False))
    except (ValueError, IndexError, OSError) as error:
        print(json.dumps({"ok": False, "reason": str(error)}))
        raise SystemExit(2)
