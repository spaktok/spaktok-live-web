"""CPU-only checks for the experimental TRELLIS.2 adapter."""
import unittest
from types import SimpleNamespace

import trellis2_engine
from trellis2_engine import MIN_TRELLIS_VRAM_BYTES, check_trellis_capacity, make_glb


class TrellisAdapterTests(unittest.TestCase):
    def make_fake_torch(self, memory):
        return SimpleNamespace(
            cuda=SimpleNamespace(
                get_device_properties=lambda device: SimpleNamespace(total_memory=memory)
            )
        )

    def test_requires_24gib_to_start(self):
        with self.assertRaisesRegex(RuntimeError, "24gib"):
            check_trellis_capacity(self.make_fake_torch(12 * 1024**3))

    def test_accepts_24gib_or_greater(self):
        check_trellis_capacity(self.make_fake_torch(MIN_TRELLIS_VRAM_BYTES))
        check_trellis_capacity(self.make_fake_torch(80 * 1024**3))

    def test_rejects_unapproved_profile_without_running_inference(self):
        model = trellis2_engine._pipeline
        try:
            trellis2_engine._pipeline = object()
            with self.assertRaisesRegex(ValueError, "unsupported_trellis2_profile"):
                make_glb(b"test", profile="shell")
        finally:
            trellis2_engine._pipeline = model

    def test_finite_quality_presets(self):
        from trellis2_quality import select_trellis2_quality
        mobile = select_trellis2_quality("mobile-preview", vram_bytes=80*1024**3)
        detail = select_trellis2_quality("detail-preview", vram_bytes=80*1024**3)
        hd = select_trellis2_quality(
            "studio-hd", vram_bytes=80*1024**3, hd_authorized=True
        )
        self.assertEqual(mobile.pipeline_type, "512")
        self.assertEqual(mobile.texture_size, 1024)
        self.assertEqual(detail.pipeline_type, "512")
        self.assertEqual(detail.texture_size, 2048)
        self.assertEqual(hd.pipeline_type, "1024_cascade")
        self.assertEqual(hd.texture_size, 2048)
        self.assertEqual(hd.decimation_target, 300_000)

    def test_hd_requires_operator_consent_and_minimum_vram(self):
        from trellis2_quality import select_trellis2_quality
        with self.assertRaises(PermissionError):
            select_trellis2_quality("studio-hd", vram_bytes=80*1024**3)
        with self.assertRaises(RuntimeError):
            select_trellis2_quality(
                "studio-hd", vram_bytes=24*1024**3, hd_authorized=True
            )
        with self.assertRaises(ValueError):
            select_trellis2_quality(
                "shell-command", vram_bytes=80*1024**3, hd_authorized=True
            )

    def test_never_generates_without_loaded_model(self):
        with self.assertRaisesRegex(RuntimeError, "not_ready"):
            make_glb(b"test")


if __name__ == "__main__":
    unittest.main()
