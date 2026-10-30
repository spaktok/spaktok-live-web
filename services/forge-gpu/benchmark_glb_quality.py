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

MAX_BYTES = 200 * 1024 * 1024


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
    if any(im.get('uri') and not im['uri'].startswith('data:') for im in images):
        raise ValueError('external_image_reference')
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
    return {
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
