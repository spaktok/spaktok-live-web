#!/usr/bin/env python3
"""Offline, zero-GPU structural comparator for two owner-provided GLBs.

Measures technical properties only; cannot judge likeness, art, or one model's
superiority. No GPU use, model downloads, uploads or secrets.
"""
from __future__ import annotations
import argparse
import hashlib
import json
from pathlib import Path
import struct

from glb_topology import scan_glb_topology

MAX_BYTES = 200 * 1024 * 1024


def _validate_embedded_texture_graph(obj: dict, bin_length: int) -> None:
    """Fail closed on dangling embedded PBR image/texture references.

    An image listed in glTF is not necessarily present in its BIN chunk,
    and a material texture index alone does not prove that it can render.
    This is a structural check; it does NOT measure texture appearance.
    """
    views = obj.get("bufferViews", [])
    images = obj.get("images", [])
    textures = obj.get("textures", [])

    def is_ref(value: object, collection: list) -> bool:
        return type(value) is int and 0 <= value < len(collection)

    for image in images:
        if "bufferView" in image:
            if "uri" in image or not is_ref(image["bufferView"], views):
                raise ValueError("glb_image_buffer_view_invalid")
            view = views[image["bufferView"]]
            offset, length = view.get("byteOffset", 0), view.get("byteLength")
            if (view.get("buffer") != 0 or
                    type(offset) is not int or type(length) is not int or
                    offset < 0 or length <= 0 or
                    offset + length > bin_length or
                    not isinstance(image.get("mimeType"), str) or
                    not image["mimeType"].startswith("image/")):
                raise ValueError("glb_image_buffer_view_invalid")
        else:
            uri = image.get("uri")
            if (not isinstance(uri, str) or not uri.startswith("data:image/") or
                    ";base64," not in uri or not uri.split(";base64,", 1)[1]):
                raise ValueError("glb_external_or_unbacked_image")

    for texture in textures:
        refs = []
        if "source" in texture:
            refs.append(texture["source"])
        extensions = texture.get("extensions") or {}
        for name in ("EXT_texture_webp", "KHR_texture_basisu"):
            if name in extensions:
                refs.append(extensions[name].get("source"))
        if not refs or any(not is_ref(ref, images) for ref in refs):
            raise ValueError("glb_texture_image_reference_invalid")

    for material in obj.get("materials", []):
        pbr = material.get("pbrMetallicRoughness") or {}
        slots = (pbr.get("baseColorTexture"),
                 pbr.get("metallicRoughnessTexture"),
                 material.get("normalTexture"),
                 material.get("occlusionTexture"),
                 material.get("emissiveTexture"))
        for slot in slots:
            if slot is not None and (
                    not isinstance(slot, dict) or
                    not is_ref(slot.get("index"), textures)):
                raise ValueError("glb_material_texture_index_invalid")


def inspect_glb(path: Path) -> dict:
    size = path.stat().st_size
    if not 28 <= size <= MAX_BYTES:
        raise ValueError("glb_size_out_of_bounds")
    data = path.read_bytes()
    magic, version, total = struct.unpack_from('<4sII', data, 0)
    if magic != b'glTF' or version != 2 or total != size:
        raise ValueError('invalid_glb_header')
    length, kind = struct.unpack_from('<I4s', data, 12)
    if kind != b'JSON' or length % 4 or length < 16 or 20 + length > size:
        raise ValueError('invalid_glb_json_chunk')
    obj = json.loads(data[20:20 + length].decode('utf-8'))
    if obj.get('asset', {}).get('version') != '2.0':
        raise ValueError('invalid_gltf_version')
    offset = 20 + length
    has_bin = offset + 8 <= size and data[offset + 4:offset + 8] == b'BIN\x00'
    bin_length = struct.unpack_from('<I', data, offset)[0] if has_bin else 0
    if has_bin and offset + 8 + bin_length > size:
        raise ValueError('invalid_binary_chunk')
    buffers = obj.get('buffers', [])
    if len(buffers) > 1 or any(b.get('uri') for b in buffers):
        raise ValueError('external_or_multiple_buffers')
    if buffers and (not has_bin or buffers[0].get('byteLength', 0) > bin_length):
        raise ValueError('unbacked_binary')
    images = obj.get('images', [])
    _validate_embedded_texture_graph(obj, buffers[0]['byteLength'] if buffers else 0)
    acc = obj.get('accessors', [])
    triangles = primitives = uvs = normals = morphs = 0
    for mesh in obj.get('meshes', []):
        for primitive in mesh.get('primitives', []):
            primitives += 1
            if primitive.get('mode', 4) != 4:
                continue
            attrs = primitive.get('attributes', {})
            position_index = attrs.get('POSITION')
            if not isinstance(position_index, int) or not 0 <= position_index < len(acc):
                raise ValueError('invalid_position_accessor')
            count = acc[position_index].get('count')
            index_index = primitive.get('indices')
            if index_index is not None:
                if not isinstance(index_index, int) or not 0 <= index_index < len(acc):
                    raise ValueError('invalid_index_accessor')
                count = acc[index_index].get('count')
            if not isinstance(count, int) or count < 3 or count % 3:
                raise ValueError('invalid_triangle_count')
            triangles += count // 3
            uvs += int('TEXCOORD_0' in attrs)
            normals += int('NORMAL' in attrs)
            morphs += len(primitive.get('targets', []))
    materials = obj.get('materials', [])
    pbr = sum(int(isinstance(m.get('pbrMetallicRoughness'), dict)) for m in materials)
    slots = {
        'base_color': sum('baseColorTexture' in (m.get('pbrMetallicRoughness') or {}) for m in materials),
        'metallic_roughness': sum('metallicRoughnessTexture' in (m.get('pbrMetallicRoughness') or {}) for m in materials),
        'normal': sum('normalTexture' in m for m in materials),
        'occlusion': sum('occlusionTexture' in m for m in materials),
        'emissive': sum('emissiveTexture' in m for m in materials),
    }
    # A GLB can be structurally readable but topologically invalid. Treat
    # unsupported edge formats as UNKNOWN, never as a zero-defect success.
    try:
        topology = scan_glb_topology(path)
    except (ValueError, KeyError, IndexError, TypeError, struct.error):
        topology = {
            'verified': False, 'nonmanifold_edges': None,
            'boundary_edges': None, 'degenerate_index_triangles': None,
            'publish_ready': False,
        }
    return {
        'topology': topology,
        'file': path.name, 'bytes': size,
        'sha256': hashlib.sha256(data).hexdigest(),
        'triangles': triangles, 'triangle_primitives': primitives,
        'primitives_with_uv0': uvs, 'primitives_with_normals': normals,
        'embedded_image_count': len(images), 'material_count': len(materials),
        'pbr_material_count': pbr, 'texture_slot_counts': slots,
        'morph_target_count': morphs,
        'animation_count': len(obj.get('animations', [])),
        'skin_count': len(obj.get('skins', [])),
        'under_15mb_mobile_budget': size <= 15 * 1024 * 1024,
        'under_150k_triangle_mobile_budget': triangles <= 150000,
    }


def report(spaktok: Path, rodin: Path | None = None) -> dict:
    return {
        'schema': 'spaktok-glb-technical-comparison-v1',
        'spaktok': inspect_glb(spaktok),
        'rodin': inspect_glb(rodin) if rodin is not None else None,
        'unmeasured': [
            'visual_similarity_to_same_reference',
            'rear_and_occluded_geometry_accuracy',
            'rigging_and_expression_functionality',
            'subjective_texture_artifact_score',
            'android_fps_and_thermal_performance',
            'cost_per_successful_asset',
        ],
        'winner': None,
        'note': 'Topology and material slot counts alone do not establish visual superiority.',
    }


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument('--spaktok', type=Path, required=True)
    parser.add_argument('--rodin', type=Path)
    args = parser.parse_args()
    print(json.dumps(report(args.spaktok, args.rodin), ensure_ascii=False, indent=2))
    return 0


if __name__ == '__main__':
    raise SystemExit(main())
