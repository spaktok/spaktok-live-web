"""Synthetic QA regressions for index-hidden nonmanifold POSITION edges."""
import json
import math
from pathlib import Path
import struct
import tempfile
import unittest

from glb_position_weld_audit import scan_glb_position_weld
from glb_topology import scan_glb_topology
from test_build_private_lods import fixture


def _set_vertex(path: Path, index: int, xyz: tuple[float, float, float]) -> None:
    raw = bytearray(path.read_bytes())
    length = struct.unpack_from("<I", raw, 12)[0]
    doc = json.loads(raw[20:20+length])
    acc = doc["accessors"][1]
    view = doc["bufferViews"][acc["bufferView"]]
    start = 20 + length + 8 + view.get("byteOffset", 0)
    start += acc.get("byteOffset", 0) + index*12
    struct.pack_into("<fff", raw, start, *xyz)
    path.write_bytes(raw)


def _replace_json(path: Path, edit) -> None:
    original = path.read_bytes()
    n = struct.unpack_from("<I", original, 12)[0]
    doc = json.loads(original[20:20+n])
    edit(doc)
    data = json.dumps(doc).encode("utf8")
    data += b" " * (-len(data) % 4)
    tail = original[20+n:]
    path.write_bytes(
        struct.pack("<4sII", b"glTF", 2, 20 + len(data)+len(tail))
        + struct.pack("<I4s", len(data), b"JSON") + data + tail
    )


class PositionWeldAuditTests(unittest.TestCase):
    def test_isolated_geometry_has_no_hidden_nonmanifold_edges(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root)/"ordinary.glb"
            fixture(path, 100)
            observed = scan_glb_position_weld(path)
            self.assertEqual(observed["triangles"], 100)
            self.assertEqual(observed["nonmanifold_edges_after_position_weld"], 0)
            self.assertEqual(observed["boundary_edges_after_position_weld"], 300)
            self.assertEqual(observed["degenerate_triangles_after_position_weld"], 0)
            self.assertFalse(observed["publish_ready"])
            self.assertTrue(observed["human_visual_review_required"])

    def test_detects_three_faces_sharing_position_edge_with_distinct_indices(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root)/"seam-hidden.glb"
            fixture(path, 100)
            triangles = [
                ((0,0,0),(1,0,0),(0,1,0)),
                ((0,0,0),(1,0,0),(0,-1,0)),
                ((0,0,0),(1,0,0),(0,0,1)),
            ]
            for t, positions in enumerate(triangles):
                for j, xyz in enumerate(positions):
                    _set_vertex(path, t*3+j, xyz)
            indexed = scan_glb_topology(path)
            self.assertEqual(indexed["nonmanifold_edges"], 0)
            result = scan_glb_position_weld(path)
            self.assertGreaterEqual(result["nonmanifold_edges_after_position_weld"], 1)
            self.assertEqual(result["max_edge_incidence_after_position_weld"], 3)
            self.assertGreaterEqual(result["duplicate_position_vertices"], 4)
            self.assertFalse(result["publish_ready"])

    def test_rejects_nonfinite_and_nonfloat_position_data(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root)/"nonfinite.glb"
            fixture(path, 100)
            _set_vertex(path, 0, (math.nan, 0.0, 0.0))
            with self.assertRaisesRegex(ValueError, "position_weld_nonfinite_position"):
                scan_glb_position_weld(path)
            fixture(path, 100)
            _replace_json(path, lambda doc: doc["accessors"][1].update(
                {"componentType": 5123}
            ))
            with self.assertRaisesRegex(ValueError, "position_weld_requires_float_positions"):
                scan_glb_position_weld(path)

    def test_rejects_invalid_stride_and_unsafe_tolerance(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root)/"invalid.glb"
            fixture(path, 100)
            with self.assertRaisesRegex(ValueError, "position_weld_tolerance_invalid"):
                scan_glb_position_weld(path, relative_tolerance=0.5)
            with self.assertRaisesRegex(ValueError, "position_weld_tolerance_invalid"):
                scan_glb_position_weld(path, relative_tolerance=float("nan"))
            _replace_json(path, lambda doc: doc["bufferViews"][1].update(
                {"byteStride": 8}
            ))
            with self.assertRaisesRegex(ValueError, "position_weld_invalid_position_bounds"):
                scan_glb_position_weld(path)

    def test_invalid_glb_never_looks_clean(self):
        with tempfile.TemporaryDirectory() as root:
            path = Path(root)/"corrupt.glb"
            fixture(path, 100)
            data = bytearray(path.read_bytes())
            data[:4] = b"NOPE"
            path.write_bytes(data)
            with self.assertRaisesRegex(ValueError, "topology_glb_header_invalid"):
                scan_glb_position_weld(path)


if __name__ == "__main__":
    unittest.main()
