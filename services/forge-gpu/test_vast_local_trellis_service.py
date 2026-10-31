"""Offline, CPU-only tests for the fixed localhost TRELLIS.2 launcher."""
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import vast_local_trellis_service as svc


class LocalServiceTests(unittest.TestCase):
    def test_rejects_running_unmanaged_service(self):
        with tempfile.TemporaryDirectory() as td:
            with patch.object(svc, "STATE_DIR", Path(td)), \
                 patch.object(svc, "TOKEN_FILE", Path(td) / "missing"), \
                 patch.object(svc, "local_health", return_value=(True, True)):
                with self.assertRaisesRegex(svc.LocalServiceError,
                                            "existing_gpu_server_unmanaged"):
                    svc.ensure_local_trellis2()

    def test_rejects_busy_local_port(self):
        with patch.object(svc, "local_health", return_value=(False, True)):
            with self.assertRaisesRegex(svc.LocalServiceError,
                                        "localhost_gpu_port_occupied_or_booting"):
                svc.ensure_local_trellis2()

    def test_token_is_local_private_and_stable(self):
        with tempfile.TemporaryDirectory() as td:
            token_path = Path(td) / "gpu-token"
            with patch.object(svc, "STATE_DIR", Path(td)), \
                 patch.object(svc, "TOKEN_FILE", token_path):
                first = svc.local_token()
                second = svc.local_token()
                self.assertEqual(first, second)
                self.assertGreaterEqual(len(first), 32)
                self.assertEqual(token_path.stat().st_mode & 0o077, 0)

    def test_environment_has_no_remote_open_port_or_secrets(self):
        with tempfile.TemporaryDirectory() as td:
            base=Path(td)
            home=base / "hf"
            home.mkdir()
            py=base / "trellis2" / "bin" / "python"
            with patch.dict("os.environ", {"HF_HOME": str(home)}, clear=True):
                env=svc.process_environment(py, "fake-private-token")
            self.assertEqual(env["FORGE_GPU_ENGINE"], "trellis2")
            self.assertEqual(env["CONDA_PREFIX"], str(py.parent.parent))
            self.assertEqual(env["HF_HOME"], str(home))
            self.assertEqual(env["FORGE_GPU_TOKEN"], "fake-private-token")
            self.assertNotIn("FORGE_GPU_ALLOWED_ORIGIN", env)

    def test_cannot_start_when_huggingface_cache_missing(self):
        with patch.dict("os.environ", {"HF_HOME": "/not/existing/spaktok/cache"},
                        clear=True):
            with self.assertRaisesRegex(svc.LocalServiceError,
                                        "huggingface_device_cache_missing"):
                svc.process_environment(Path("/tmp/trellis2/bin/python"),
                                        "fake-private-token")


if __name__ == "__main__":
    unittest.main()
