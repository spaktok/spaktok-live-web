"""Offline safety and GLB checks; no GPU, no network, no paid operation."""
import json
import struct
import unittest
from unittest.mock import patch

import one_image_e2e as check


def sample_glb(with_mesh=True):
    doc = {"asset": {"version": "2.0"}}
    if with_mesh:
        doc["meshes"] = [{"primitives": [{"attributes": {"POSITION": 0}}]}]
    chunk = json.dumps(doc).encode("utf-8")
    chunk += b" " * (-len(chunk) % 4)
    # GLB 2.0: 12-byte header, JSON chunk header + data.
    result = b"glTF" + struct.pack("<II", 2, 20 + len(chunk))
    return result + struct.pack("<I", len(chunk)) + b"JSON" + chunk


class OneImageE2ETests(unittest.TestCase):
    def test_glb_header_and_structure(self):
        report = check.inspect_glb(sample_glb())
        self.assertEqual(report["meshes"], 1)
        self.assertEqual(report["materials"], 0)
        self.assertEqual(len(report["sha256"]), 64)

    def test_rejects_not_glb_or_wrong_size(self):
        for raw in (b"not glb" * 30, b"glTF" * 10, sample_glb()[:-1]):
            with self.assertRaises(ValueError):
                check.inspect_glb(raw)

    def test_rejects_meshless_payload(self):
        with self.assertRaisesRegex(ValueError, "no_meshes"):
            check.inspect_glb(sample_glb(False))

    def test_never_calls_network_with_missing_operator_secret(self):
        with patch.object(check.request, "urlopen") as urlopen:
            with self.assertRaisesRegex(ValueError, "token_missing"):
                check.post_one_image(b"x" * 256, "owned.png", "short")
            urlopen.assert_not_called()

    def test_rejects_non_image_extension_without_network(self):
        with patch.object(check.request, "urlopen") as urlopen:
            with self.assertRaisesRegex(ValueError, "only_png"):
                check.post_one_image(b"x" * 256, "secret.txt", "a" * 40)
            urlopen.assert_not_called()


if __name__ == "__main__":
    unittest.main()
