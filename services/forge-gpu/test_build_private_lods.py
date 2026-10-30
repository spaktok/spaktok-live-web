"""GPU-free subprocess-contract tests for actual private GLB LOD production."""
import hashlib
import json
from pathlib import Path
import struct
import subprocess
import tempfile
import unittest
from unittest.mock import patch

from build_private_lods import generate_lods


def fixture(path: Path, triangles: int, *, uv=True, normal=True,
            pbr=True, malformed_edges=False) -> None:
    """A *valid* indexed GLB fixture. No fake/unbacked geometry declarations."""
    indices = list(range(triangles * 3))
    if malformed_edges:
        # Three triangles incident to undirected edge (0,1).
        indices[:9] = [0, 1, 2, 1, 0, 3, 0, 1, 4]
    vertex_count = triangles * 3
    index_bytes = struct.pack("<" + "I"*len(indices), *indices)
    positions = struct.pack("<" + "f"*(vertex_count*3),
                            *([0.0, 0.0, 0.0]*vertex_count))
    uvs = struct.pack("<" + "f"*(vertex_count*2),
                      *([0.0, 0.0]*vertex_count))
    normals = struct.pack("<" + "f"*(vertex_count*3),
                          *([0.0, 0.0, 1.0]*vertex_count))
    embedded_png = b"\x89PNG" + b"\x00"*12
    views = []
    binary = bytearray()
    for block in (index_bytes, positions, uvs, normals, embedded_png):
        views.append({"buffer": 0, "byteOffset": len(binary),
                      "byteLength": len(block)})
        binary.extend(block)
        binary.extend(b"\0" * (-len(binary) % 4))
    attrs = {"POSITION": 1}
    if uv:
        attrs["TEXCOORD_0"] = 2
    if normal:
        attrs["NORMAL"] = 3
    data = {
        "asset": {"version": "2.0"},
        "buffers": [{"byteLength": len(binary)}],
        "bufferViews": views,
        "accessors": [
            {"bufferView": 0, "componentType": 5125,
             "count": len(indices), "type": "SCALAR"},
            {"bufferView": 1, "componentType": 5126,
             "count": vertex_count, "type": "VEC3"},
            {"bufferView": 2, "componentType": 5126,
             "count": vertex_count, "type": "VEC2"},
            {"bufferView": 3, "componentType": 5126,
             "count": vertex_count, "type": "VEC3"},
        ],
        "materials": ([{"pbrMetallicRoughness": {
            "baseColorTexture": {"index": 0},
        }}] if pbr else []),
        "textures": [{"source": 0}],
        "images": [{"bufferView": 4, "mimeType": "image/png"}],
        "meshes": [{"primitives": [{
            "attributes": attrs, "indices": 0, "mode": 4, "material": 0,
        }]}],
    }
    raw = json.dumps(data).encode("utf-8")
    raw += b" " * (-len(raw) % 4)
    path.write_bytes(
        struct.pack("<4sII", b"glTF", 2,
                    20 + len(raw) + 8 + len(binary))
        + struct.pack("<I4s", len(raw), b"JSON")
        + raw
        + struct.pack("<I4s", len(binary), b"BIN\x00")
        + binary
    )


class MultiLODTests(unittest.TestCase):
    def test_generates_3_monotonically_smaller_pbr_lods_and_atomic_manifest(self):
        with tempfile.TemporaryDirectory() as root:
            origin = Path(root) / "owner.glb"
            output = Path(root) / "private-lods"
            fixture(origin, 1000)
            before = hashlib.sha256(origin.read_bytes()).hexdigest()
            calls = []
            def fake_run(args, **kwargs):
                calls.append(args)
                self.assertEqual(kwargs["timeout"], 90)
                fixture(Path(args[args.index("-o") + 1]),
                        480 if args[args.index("-si") + 1] == "0.50" else 190)
                return subprocess.CompletedProcess(args, 0, "", "")
            with patch("build_private_lods.shutil.which", return_value="/bin/true"), \
                 patch("build_private_lods.subprocess.run", side_effect=fake_run):
                result = generate_lods(origin, output)
            self.assertEqual(len(calls), 2)
            self.assertTrue(all("-noq" in c and "-km" in c and "-slb" in c
                                and "-sv" in c for c in calls))
            self.assertEqual(result["variants"]["lod1"]["topology"]["nonmanifold_edges"], 0)
            self.assertEqual(result["variants"]["lod2"]["topology"]["degenerate_index_triangles"], 0)
            self.assertEqual([result["variants"][n]["triangles"]
                              for n in ("lod0", "lod1", "lod2")],
                             [1000, 480, 190])
            self.assertTrue((output / "lod0.glb").exists())
            self.assertTrue((output / "lod1.glb").exists())
            self.assertTrue((output / "lod2.glb").exists())
            self.assertEqual(json.loads((output / "pack.json").read_text()),
                             result)
            self.assertFalse(result["published"])
            self.assertFalse(result["rigged"])
            self.assertEqual(result["privateStudioRecommendations"]["live"],
                             "lod2")
            self.assertEqual(hashlib.sha256(origin.read_bytes()).hexdigest(), before)
            with self.assertRaises(FileExistsError):
                generate_lods(origin, output)

    def test_rejects_uv_loss_without_exposing_partial_output(self):
        with tempfile.TemporaryDirectory() as root:
            origin = Path(root) / "owner.glb"
            output = Path(root) / "private-lods"
            fixture(origin, 1000)
            def fake_run(args, **kwargs):
                fixture(Path(args[args.index("-o") + 1]), 400, uv=False)
                return subprocess.CompletedProcess(args, 0, "", "")
            with patch("build_private_lods.shutil.which", return_value="/bin/true"), \
                 patch("build_private_lods.subprocess.run", side_effect=fake_run):
                with self.assertRaisesRegex(ValueError, "lod_uvs_missing"):
                    generate_lods(origin, output)
            self.assertFalse(output.exists())

    def test_rejects_nonreducing_geometry_without_partial_delivery(self):
        with tempfile.TemporaryDirectory() as root:
            origin = Path(root) / "owner.glb"
            output = Path(root) / "private-lods"
            fixture(origin, 1000)
            def fake_run(args, **kwargs):
                fixture(Path(args[args.index("-o") + 1]), 1000)
                return subprocess.CompletedProcess(args, 0, "", "")
            with patch("build_private_lods.shutil.which", return_value="/bin/true"), \
                 patch("build_private_lods.subprocess.run", side_effect=fake_run):
                with self.assertRaisesRegex(ValueError, "lod_did_not_reduce"):
                    generate_lods(origin, output)
            self.assertFalse(output.exists())

    def test_rejects_nonmanifold_lod_and_never_exposes_pack(self):
        with tempfile.TemporaryDirectory() as root:
            origin = Path(root) / "owner.glb"
            output = Path(root) / "private-lods"
            fixture(origin, 1000)
            def fake_run(args, **kwargs):
                fixture(Path(args[args.index("-o") + 1]), 450,
                        malformed_edges=True)
                return subprocess.CompletedProcess(args, 0, "", "")
            with patch("build_private_lods.shutil.which", return_value="/bin/true"), \
                 patch("build_private_lods.subprocess.run", side_effect=fake_run):
                with self.assertRaisesRegex(ValueError, "lod_topology_nonmanifold"):
                    generate_lods(origin, output)
            self.assertFalse(output.exists())

    def test_rejects_defective_input_before_running_optimizer(self):
        with tempfile.TemporaryDirectory() as root:
            origin = Path(root) / "broken.glb"
            fixture(origin, 1000, malformed_edges=True)
            with patch("build_private_lods.shutil.which", return_value="/bin/true"), \
                 patch("build_private_lods.subprocess.run") as process:
                with self.assertRaisesRegex(ValueError, "lod_source_topology_requires_repair"):
                    generate_lods(origin, Path(root) / "lod")
                process.assert_not_called()

    def test_no_gpu_or_download_when_binary_missing(self):
        with tempfile.TemporaryDirectory() as root:
            origin = Path(root) / "owner.glb"
            fixture(origin, 1000)
            with patch("build_private_lods.shutil.which", return_value=None), \
                 patch("build_private_lods.subprocess.run") as run:
                with self.assertRaises(FileNotFoundError):
                    generate_lods(origin, Path(root) / "lod")
                run.assert_not_called()


if __name__ == "__main__":
    unittest.main()
