"""CPU-only test for preserving original mesh and PBR texture during finalization."""
import tempfile
import unittest
from pathlib import Path

import numpy as np
import trimesh
from PIL import Image

from glb_quality import inspect_glb_bytes
from glb_mobile_finalize import finalize_mobile_glb


class MobileFinalizeTests(unittest.TestCase):
    @staticmethod
    def source_glb():
        mesh = trimesh.creation.icosphere(subdivisions=1)
        mesh.visual = trimesh.visual.TextureVisuals(
            uv=np.full((len(mesh.vertices), 2), .5),
            material=trimesh.visual.material.PBRMaterial(
                baseColorTexture=Image.new("RGB", (16, 16), "#6677ff"),
                roughnessFactor=1.0,
            ),
        )
        return mesh.export(file_type="glb")

    def test_add_normals_without_dropping_uv_texture_material_or_geometry(self):
        with tempfile.TemporaryDirectory() as folder:
            source, dest = Path(folder)/"source.glb", Path(folder)/"mobile.glb"
            original = self.source_glb()
            self.assertFalse(inspect_glb_bytes(original)["hasNormals"])
            source.write_bytes(original)
            result = finalize_mobile_glb(source, dest)
            self.assertEqual(source.read_bytes(), original)
            metrics = inspect_glb_bytes(dest.read_bytes())
            self.assertTrue(metrics["mobileBudgetPass"])
            self.assertTrue(metrics["hasNormals"])
            self.assertTrue(metrics["hasUV"])
            self.assertEqual(metrics["embeddedImages"], 1)
            self.assertEqual(metrics["pbrMaterials"], 1)
            self.assertEqual(metrics["triangles"], inspect_glb_bytes(original)["triangles"])
            self.assertEqual(len(result["sha256"]), 64)

    def test_never_overwrites_original_or_previous_output(self):
        with tempfile.TemporaryDirectory() as folder:
            source, dest = Path(folder)/"source.glb", Path(folder)/"mobile.glb"
            source.write_bytes(self.source_glb())
            with self.assertRaisesRegex(ValueError, "invalid_original_glb_path"):
                finalize_mobile_glb(source, source)
            dest.write_bytes(b"existing")
            with self.assertRaises(FileExistsError):
                finalize_mobile_glb(source, dest)
            self.assertEqual(dest.read_bytes(), b"existing")


if __name__ == "__main__":
    unittest.main()
