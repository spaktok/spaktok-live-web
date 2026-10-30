"""No-GPU technical comparator regression tests."""
import json
import struct
import tempfile
import unittest
from pathlib import Path
from benchmark_glb_quality import inspect_glb, report


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


if __name__ == '__main__':
    unittest.main()
