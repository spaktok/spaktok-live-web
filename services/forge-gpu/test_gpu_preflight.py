"""Fast CPU-only unit tests; no model download, no GPU charges."""
import unittest
from gpu_preflight import (
    IncompatibleGPU, verify_cuda_build, require_compatible_gpu,
)


class CompatibleTests(unittest.TestCase):
    def test_blackwell_rejects_old_torch(self):
        with self.assertRaisesRegex(IncompatibleGPU, "cu128"):
            verify_cuda_build((12, 0), "12.1", ["sm_80", "sm_90"])

    def test_blackwell_rejects_new_torch_without_sm120(self):
        with self.assertRaisesRegex(IncompatibleGPU, "sm120"):
            verify_cuda_build((12, 0), "12.8", ["sm_90"])

    def test_blackwell_accepts_cu128_and_sm120(self):
        self.assertTrue(
            verify_cuda_build((12, 0), "12.8", ["sm_120"])["archSupported"]
        )

    def test_hopper_accepts_legacy_cuda_image(self):
        result = verify_cuda_build((9, 0), "12.1", ["sm_90"])
        self.assertEqual(result["capability"], "9.0")

    def test_broken_runtime_rejected(self):
        for version in ("", None, "12", "cuda 12.8"):
            with self.assertRaises(IncompatibleGPU):
                verify_cuda_build((12, 0), version, ["sm_120"])

    def test_missing_hopper_sm90_rejected(self):
        with self.assertRaises(IncompatibleGPU):
            verify_cuda_build((9, 0), "12.1", ["sm_86"])

    def test_no_cuda_fails_closed(self):
        class Fake:
            class cuda:
                @staticmethod
                def is_available():
                    return False

        with self.assertRaisesRegex(IncompatibleGPU, "cuda_device_unavailable"):
            require_compatible_gpu(Fake())


if __name__ == "__main__":
    unittest.main()
