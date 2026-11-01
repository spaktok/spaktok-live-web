"""CPU-only provenance gate tests: no GPUs, credentials, network or private media."""
import hashlib
import json
from pathlib import Path
import struct
import tempfile
import unittest

from verify_gpu_evidence import verify

COMMIT = "a" * 40
MODEL = "trellis2-rev-20261031"


def make_glb() -> bytes:
    raw = json.dumps({"asset": {"version": "2.0"}}).encode()
    raw += b" " * ((-len(raw)) % 4)
    return struct.pack("<4sII", b"glTF", 2, 20 + len(raw)) + struct.pack("<I4s", len(raw), b"JSON") + raw


class EvidenceTests(unittest.TestCase):
    def setUp(self):
        self.tmp = tempfile.TemporaryDirectory()
        self.addCleanup(self.tmp.cleanup)
        self.base = Path(self.tmp.name)
        self.image = self.base / "source.png"
        self.image.write_bytes(b"private-owner-image-content")
        self.glb = self.base / "spaktok-mobile-preview.glb"
        self.glb.write_bytes(make_glb())
        self.report = self.base / "ladder-report.json"
        self.payload = {
            "tool": "spaktok-rodin-parity-ladder",
            "provenance": {
                "git_commit": COMMIT, "model_revision": MODEL,
                "source_image_sha256": hashlib.sha256(self.image.read_bytes()).hexdigest(),
            },
            "results": [{
                "profile": "mobile-preview", "ok": True, "glb": str(self.glb),
                "bytes": self.glb.stat().st_size,
                "sha256": hashlib.sha256(self.glb.read_bytes()).hexdigest(),
                "seconds": 9.2, "peak_vram_gib": 5.5,
            }],
        }

    def check(self):
        self.report.write_text(json.dumps(self.payload))
        return verify(self.report, self.image, expected_commit=COMMIT,
                      expected_model_revision=MODEL)

    def test_matching_evidence_verifies_only_bytes_not_quality(self):
        result = self.check()
        self.assertTrue(result["verified"])
        self.assertIn("visual_parity", result["not_proven"])

    def test_changed_glb_rejected(self):
        self.glb.write_bytes(self.glb.read_bytes() + b"evil")
        self.assertFalse(self.check()["verified"])

    def test_changed_source_rejected(self):
        self.image.write_bytes(b"other-private-photo")
        self.assertIn("source_image_hash_mismatch", self.check()["errors"])

    def test_mismatched_commit_rejected(self):
        self.payload["provenance"]["git_commit"] = "b" * 40
        self.assertIn("commit_mismatch", self.check()["errors"])

    def test_partial_generation_is_not_verified(self):
        self.payload["results"][0]["ok"] = False
        self.assertFalse(self.check()["verified"])

    def test_symlink_not_followed(self):
        self.glb.unlink()
        self.glb.symlink_to(self.image)
        self.assertFalse(self.check()["verified"])

    def test_invalid_model_identity_rejected(self):
        self.assertEqual(verify(self.report, self.image, expected_commit=COMMIT,
                                expected_model_revision="bad")["errors"],
                         ["invalid_expected_model_revision"])


if __name__ == "__main__":
    unittest.main()
