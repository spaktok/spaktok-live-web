"""No-GPU technical comparator regression tests."""
import json
import struct
import tempfile
import unittest
from pathlib import Path
from benchmark_glb_quality import inspect_glb, report
from test_build_private_lods import fixture as textured_fixture


def fixture(path, include_pbr=True):
    obj = {
        "asset": {"version": "2.0"},
        "buffers": [{"byteLength": 36}],
        "accessors": [{"count": 3, "type": "VEC3"}],
        "meshes": [{"primitives": [
            {"attributes": {"POSITION": 0, "NORMAL": 0, "TEXCOORD_0": 0},
             "mode": 4}
        ]}],
        "images": [],
        "materials": [{"pbrMetallicRoughness": {}}] if include_pbr else [],
    }
    raw = json.dumps(obj).encode()
    raw += b' ' * (-len(raw) % 4)
    geometry = b'\0' * 36
    payload = (
        struct.pack('<4sII', b'glTF', 2, 20 + len(raw) + 8 + len(geometry))
        + struct.pack('<I4s', len(raw), b'JSON')
        + raw
        + struct.pack('<I4s', len(geometry), b'BIN\x00')
        + geometry
    )
    path.write_bytes(payload)


def rewrite_glb_json(path, mutate):
    """Change only the JSON in a genuine GLB, preserving its binary chunk."""
    data = path.read_bytes()
    original_json_length = struct.unpack_from("<I", data, 12)[0]
    document = json.loads(data[20:20 + original_json_length])
    mutate(document)
    encoded = json.dumps(document).encode("utf-8")
    encoded += b" " * (-len(encoded) % 4)
    binary = data[20 + original_json_length:]
    path.write_bytes(
        struct.pack("<4sII", b"glTF", 2, 20 + len(encoded) + len(binary))
        + struct.pack("<I4s", len(encoded), b"JSON")
        + encoded + binary
    )


class BenchmarkTests(unittest.TestCase):
    def test_inspects_without_gpu_or_api(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'owned.glb'
            fixture(path)
            info = inspect_glb(path)
            self.assertEqual(info['triangles'], 1)
            self.assertEqual(info['pbr_material_count'], 1)
            self.assertEqual(info['primitives_with_uv0'], 1)
            self.assertEqual(info['skin_count'], 0)
            self.assertTrue(info['under_15mb_mobile_budget'])

    def test_two_models_do_not_imply_a_winner(self):
        with tempfile.TemporaryDirectory() as folder:
            a, b = Path(folder) / 'spaktok.glb', Path(folder) / 'rodin.glb'
            fixture(a)
            fixture(b, include_pbr=False)
            result = report(a, b)
            self.assertIsNone(result['winner'])
            self.assertEqual(result['rodin']['pbr_material_count'], 0)
            self.assertIn('visual_similarity_to_same_reference', result['unmeasured'])

    def test_rejects_corrupt_headers(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / 'bad.glb'
            fixture(path)
            raw = bytearray(path.read_bytes())
            raw[:4] = b'NOPE'
            path.write_bytes(raw)
            with self.assertRaisesRegex(ValueError, 'invalid_glb_header'):
                inspect_glb(path)


    def test_embedded_webp_extension_texture_graph_is_supported(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "webp-graph.glb"
            textured_fixture(path, 100)
            def edit(document):
                # Only linkage is audited here; pixel bytes are not decoded.
                document["images"][0]["mimeType"] = "image/webp"
                document["textures"][0].pop("source")
                document["textures"][0]["extensions"] = {
                    "EXT_texture_webp": {"source": 0}
                }
            rewrite_glb_json(path, edit)
            result = inspect_glb(path)
            self.assertEqual(result["embedded_image_count"], 1)
            self.assertEqual(result["texture_slot_counts"]["base_color"], 1)

    def test_dangling_pbr_graph_rejects_bogus_image_view(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "missing-image.glb"
            textured_fixture(path, 100)
            rewrite_glb_json(path, lambda doc:
                             doc["images"][0].update({"bufferView": 900}))
            with self.assertRaisesRegex(ValueError, "glb_image_buffer_view_invalid"):
                inspect_glb(path)

    def test_dangling_pbr_graph_rejects_unbacked_image_bytes(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "image-past-end.glb"
            textured_fixture(path, 100)
            rewrite_glb_json(path, lambda doc:
                             doc["bufferViews"][4].update({"byteLength": 999999}))
            with self.assertRaisesRegex(ValueError, "glb_image_buffer_view_invalid"):
                inspect_glb(path)

    def test_dangling_pbr_graph_rejects_missing_texture_source(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "missing-source.glb"
            textured_fixture(path, 100)
            rewrite_glb_json(path, lambda doc:
                             doc["textures"][0].update({"source": 200}))
            with self.assertRaisesRegex(ValueError, "glb_texture_image_reference_invalid"):
                inspect_glb(path)

    def test_dangling_pbr_graph_rejects_material_texture_index(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder) / "bad-material.glb"
            textured_fixture(path, 100)
            rewrite_glb_json(path, lambda doc:
                             doc["materials"][0]["pbrMetallicRoughness"]
                             ["baseColorTexture"].update({"index": 99}))
            with self.assertRaisesRegex(ValueError, "glb_material_texture_index_invalid"):
                inspect_glb(path)


if __name__ == '__main__':
    unittest.main()
