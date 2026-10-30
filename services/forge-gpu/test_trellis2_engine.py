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

    def test_never_generates_without_loaded_model(self):
        with self.assertRaisesRegex(RuntimeError, "not_ready"):
            make_glb(b"test")


if __name__ == "__main__":
    unittest.main()
