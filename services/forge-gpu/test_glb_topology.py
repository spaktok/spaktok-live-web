"""Regression tests for strict offline GLB topology scans."""
import tempfile
import unittest
from pathlib import Path

from glb_topology import scan_glb_topology
from test_build_private_lods import fixture


class GlbTopologyTests(unittest.TestCase):
    def test_regular_triangles_have_no_nonmanifold_edge(self):
        with tempfile.TemporaryDirectory() as root:
            file = Path(root) / "ordinary.glb"
            fixture(file, 200)
            r = scan_glb_topology(file)
            self.assertEqual(r["triangles"], 200)
            self.assertEqual(r["checked_primitives"], 1)
            self.assertEqual(r["nonmanifold_edges"], 0)
            self.assertEqual(r["degenerate_index_triangles"], 0)
            self.assertFalse(r["publish_ready"])

    def test_shared_edge_three_faces_is_rejected_by_quality_gate(self):
        with tempfile.TemporaryDirectory() as root:
            file = Path(root) / "broken.glb"
            fixture(file, 100, malformed_edges=True)
            r = scan_glb_topology(file)
            self.assertGreater(r["nonmanifold_edges"], 0)
            self.assertTrue(r["verified"])
            self.assertFalse(r["publish_ready"])

    def test_corrupt_glb_header_fails_closed(self):
        with tempfile.TemporaryDirectory() as root:
            file = Path(root) / "invalid.glb"
            fixture(file, 100)
            data = bytearray(file.read_bytes())
            data[:4] = b"NOPE"
            file.write_bytes(data)
            with self.assertRaisesRegex(ValueError, "topology_glb_header_invalid"):
                scan_glb_topology(file)

    def test_no_external_deps_or_paid_inference(self):
        with tempfile.TemporaryDirectory() as root:
            file = Path(root) / "valid.glb"
            fixture(file, 100)
            result = scan_glb_topology(file)
            self.assertEqual(result["boundary_edges"], 300)
            self.assertEqual(result["edges"], 300)
            self.assertFalse(result["publish_ready"])


if __name__ == "__main__":
    unittest.main()
