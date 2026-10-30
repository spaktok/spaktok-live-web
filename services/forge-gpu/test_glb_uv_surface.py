"""Offline tests for multi-primitive-safe GLB 3D surface and UV auditing."""
import json
import tempfile
import unittest
from pathlib import Path
import struct

from glb_uv_surface import inspect_glb_uv_surface
from test_build_private_lods import fixture


def collapse_uv(path: Path):
    raw = bytearray(path.read_bytes())
    size = struct.unpack_from("<I", raw, 12)[0]
    doc = json.loads(raw[20:20 + size])
    bv = doc["bufferViews"][2]
    start = 20 + size + 8 + bv["byteOffset"]
    raw[start:start + bv["byteLength"]] = b"\0" * bv["byteLength"]
    path.write_bytes(raw)


class UVSurfaceAuditTests(unittest.TestCase):
    def test_valid_indexed_glb_has_finite_3d_and_uv_areas(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "sample.glb"
            fixture(path, 100)
            result = inspect_glb_uv_surface(path)
            self.assertEqual(result["triangles"], 100)
            self.assertEqual(result["uv_collapsed_triangles"], 0)
            self.assertEqual(result["tiny_3d_triangles"], 0)
            self.assertGreater(result["surface_area_sum"], 0)
            self.assertGreater(result["uv_triangle_area_sum"], 0)
            self.assertFalse(result["visual_quality_tested"])
            self.assertFalse(result["approved_for_live"])

    def test_uv_degeneracy_is_counted_and_not_certified(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "collapsed.glb"
            fixture(path, 100)
            collapse_uv(path)
            result = inspect_glb_uv_surface(path)
            self.assertEqual(result["uv_collapsed_triangles"], 100)
            self.assertEqual(result["uv_collapsed_fraction"], 1.0)
            self.assertFalse(result["approved_for_live"])

    def test_fails_closed_when_uv_channel_missing(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "missing-uv.glb"
            fixture(path, 100, uv=False)
            with self.assertRaisesRegex(ValueError, "uv_glb_accessor_missing"):
                inspect_glb_uv_surface(path)

    def test_corrupt_glb_cannot_be_mistaken_for_approved(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root) / "broken.glb"
            fixture(path, 100)
            raw = bytearray(path.read_bytes())
            raw[:4] = b"NOPE"
            path.write_bytes(raw)
            with self.assertRaisesRegex(ValueError, "uv_glb_header_invalid"):
                inspect_glb_uv_surface(path)


if __name__ == "__main__":
    unittest.main()
