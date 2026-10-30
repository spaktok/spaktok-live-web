"""Dependency-free tests for the original TRELLIS/DINOv2 adapter."""
import unittest
from types import SimpleNamespace

import trellis_v1_engine as module


class OriginalTrellisTests(unittest.TestCase):
    def test_requires_minimum_vram(self):
        torch = SimpleNamespace(cuda=SimpleNamespace(
            get_device_properties=lambda _: SimpleNamespace(
                total_memory=12*1024**3)))
        with self.assertRaisesRegex(RuntimeError, "16gib"):
            module.check_capacity(torch)

    def test_accepts_a100_40gb(self):
        torch = SimpleNamespace(cuda=SimpleNamespace(
            get_device_properties=lambda _: SimpleNamespace(
                total_memory=40*1024**3)))
        module.check_capacity(torch)

    def test_invalid_command_is_rejected_without_load(self):
        with self.assertRaisesRegex(ValueError, "unsupported_original"):
            module.make_glb(b"not an image", "shell")

    def test_model_not_loaded_returns_safe_error(self):
        with self.assertRaisesRegex(RuntimeError, "not_ready"):
            module.make_glb(b"not an image")

    def test_no_dinov3_dependency_in_adapter(self):
        import inspect
        self.assertNotIn("DINOv3ViTModel", inspect.getsource(module))


if __name__ == "__main__":
    unittest.main()
