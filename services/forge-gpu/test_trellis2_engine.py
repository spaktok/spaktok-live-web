"""Pure-CPU contract checks for TRELLIS.2 export profiles; no paid GPU."""
import contextlib
import struct
import sys
import types
import unittest
from unittest.mock import patch

import trellis2_engine


class MockMesh:
    vertices = faces = attrs = coords = layout = voxel_size = object()

    def simplify(self, limit):
        self.simplified_to = limit


class MockPipeline:
    def __init__(self):
        self.mesh = MockMesh()

    def run(self, image):
        return [self.mesh]


class MockGLB:
    def export(self, path, extension_webp=False):
        # Valid minimum GLB envelope; the contract checks export and sizing.
        payload = b"glTF" + struct.pack("<I", 2) + struct.pack("<I", 28) + b" " * 16
        with open(path, "wb") as file:
            file.write(payload)


class ExportContractTests(unittest.TestCase):
    def setUp(self):
        self.previous = trellis2_engine._pipeline
        trellis2_engine._pipeline = MockPipeline()
        self.kwargs = {}
        self.mock_torch = types.SimpleNamespace(inference_mode=contextlib.nullcontext)
        self.mock_voxel = types.SimpleNamespace(
            postprocess=types.SimpleNamespace(to_glb=self.to_glb)
        )

    def tearDown(self):
        trellis2_engine._pipeline = self.previous

    def to_glb(self, **kwargs):
        self.kwargs = kwargs
        return MockGLB()

    def run_with(self, profile):
        with patch.dict(sys.modules, {"torch": self.mock_torch,
                                      "o_voxel": self.mock_voxel}):
            return trellis2_engine.generate_glb(object(), profile)

    def test_mobile_preview_has_lower_geometry_and_texture_budget(self):
        self.assertEqual(len(self.run_with("preview")), 28)
        self.assertEqual(self.kwargs["decimation_target"], 250000)
        self.assertEqual(self.kwargs["texture_size"], 2048)

    def test_master_has_offline_high_fidelity_budget(self):
        self.assertEqual(len(self.run_with("master")), 28)
        self.assertEqual(self.kwargs["decimation_target"], 1000000)
        self.assertEqual(self.kwargs["texture_size"], 4096)

    def test_unknown_profile_is_rejected(self):
        with self.assertRaises(ValueError):
            self.run_with("unlimited")

    def test_uninitialized_model_is_rejected(self):
        trellis2_engine._pipeline = None
        with self.assertRaises(RuntimeError):
            self.run_with("preview")


if __name__ == "__main__":
    unittest.main()
