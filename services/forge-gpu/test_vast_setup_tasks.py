"""CPU-only contract tests; do not clone repositories or rent GPUs."""
import os
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch
import vast_setup_tasks as setup


class VastSetupTests(unittest.TestCase):
    def test_only_finite_reviewed_operations(self):
        self.assertEqual(set(setup.ALLOWED_SETUP),
                         {"probe_environment", "fetch_trellis2_source",
                          "prepare_trellis2_runtime"})
        for action in ("shell", "pip install", "git pull", "terminate_gpu",
                       "fetch:https://evil.example"):
            with self.subTest(action=action), self.assertRaises(setup.SetupError):
                setup.execute_setup_task(action)

    def test_source_fetch_refuses_non_git_path(self):
        with tempfile.TemporaryDirectory() as td:
            existing = Path(td) / "TRELLIS.2"
            existing.mkdir()
            (existing / "unrelated.txt").write_text("owner-data")
            with patch.object(setup, "TRELLIS", existing), \
                 patch.object(setup, "_disk", return_value={"freeGiB": 100}):
                with self.assertRaisesRegex(
                    setup.SetupError, "source_directory_exists_not_git"
                ):
                    setup.fetch_trellis2_source()
            self.assertTrue((existing / "unrelated.txt").exists())

    def test_source_fetch_requires_disk_budget(self):
        with patch.object(setup, "_disk", return_value={"freeGiB": 1}):
            with self.assertRaisesRegex(
                setup.SetupError, "insufficient_disk_for_trellis2"
            ):
                setup.fetch_trellis2_source()

    def test_detects_conda_env_outside_workspace(self):
        import json
        import subprocess
        with tempfile.TemporaryDirectory() as td:
            prefix = Path(td) / "envs" / "trellis2"
            py = prefix / "bin" / "python"
            py.parent.mkdir(parents=True)
            py.write_bytes(b"dummy")
            response = subprocess.CompletedProcess(
                ["conda", "env", "list", "--json"], 0,
                stdout=json.dumps({"envs": ["/venv/main", str(prefix)]}),
                stderr="")
            with patch.object(setup, "ENV_PYTHON", Path(td) / "workspace" / "python"), \\
                 patch.object(setup.shutil, "which", return_value="/venv/main/bin/conda"), \\
                 patch.object(setup, "_run", return_value=response):
                self.assertEqual(setup.locate_trellis_python(), py)

    def test_refuses_unrelated_conda_environment(self):
        import json
        import subprocess
        response = subprocess.CompletedProcess(
            ["conda", "env", "list", "--json"], 0,
            stdout=json.dumps({"envs": ["/venv/main", "/venv/envs/not-trellis"]}),
            stderr="")
        with patch.object(setup, "ENV_PYTHON", Path("/missing-py/bin/python")), \\
             patch.object(setup.shutil, "which", return_value="conda"), \\
             patch.object(setup, "_run", return_value=response):
            self.assertIsNone(setup.locate_trellis_python())

    def test_runtime_no_conda_does_not_run_pip(self):
        with patch.object(setup, "_disk", return_value={"freeGiB": 100}), \
             patch.object(setup.shutil, "which", return_value=None):
            with self.assertRaisesRegex(
                setup.SetupError, "conda_unavailable_use_reviewed_installer"
            ):
                setup.prepare_trellis2_runtime()

    def test_pin_and_repo_cannot_be_supplied_by_remote_caller(self):
        self.assertEqual(len(setup.TRELLIS_SHA), 40)
        self.assertEqual(setup.TRELLIS_ORIGIN,
                         "https://github.com/microsoft/TRELLIS.2.git")
        self.assertEqual(setup.execute_setup_task.__code__.co_argcount, 1)


if __name__ == "__main__":
    unittest.main()
