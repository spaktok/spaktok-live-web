"""CPU-only, offline security and contract tests for the outbound Vast agent."""
import contextlib
import io
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import vast_operator_agent as agent


class VastAgentContractTests(unittest.TestCase):
    def test_operator_https_hostname_and_exact_origin(self):
        self.assertEqual(
            agent.operator_url("https://spaktok-vast-operator.spaktok.workers.dev"),
            "https://spaktok-vast-operator.spaktok.workers.dev")
        for raw in (
            "http://spaktok-vast-operator.spaktok.workers.dev",
            "https://spaktok-vast-operator.spaktok.workers.dev/terminals/1",
            "https://spaktok-vast-operator.spaktok.workers.dev/?token=abc",
            "https://example.com",
            "https://spaktok-vast-operator.spaktok.workers.dev.evil.com",
            "https://name:pass@spaktok-vast-operator.spaktok.workers.dev",
        ):
            with self.subTest(raw=raw), self.assertRaises(agent.OperatorError):
                agent.operator_url(raw)

    def test_finite_action_allowlist_and_paid_job_approval(self):
        base = {"id": "fa3a9d17-2015-4ea4-8c57-123456789abc"}
        for action in ("shell", "bash", "rm", "download_model"):
            with self.assertRaises(agent.OperatorError):
                agent.validate_job({**base, "action": action})
        with self.assertRaises(agent.OperatorError):
            agent.validate_job({**base, "action": "diagnose_dinov3",
                                "approvedCompute": 0})
        with self.assertRaises(agent.OperatorError):
            agent.validate_job({**base, "action": "generate_one",
                                "inputKey": "vast-private/input/photo",
                                "outputKey": "vast-private/output/model",
                                "approvedCompute": 1, "rightsConfirmed": 0})
        self.assertEqual(agent.validate_job({
            **base, "action": "generate_one",
            "inputKey": "vast-private/input/photo",
            "inputSha256": "a" * 64,
            "outputKey": "vast-private/output/model",
            "approvedCompute": 1, "rightsConfirmed": 1,
        })[0], "generate_one")

    def test_no_arbitrary_r2_object_keys(self):
        base = {"id": "fa3a9d17-2015-4ea4-8c57-123456789abc",
                "action": "finalize_glb", "inputKey": "other/customer.glb",
                "outputKey": "vast-private/output/glb"}
        with self.assertRaises(agent.OperatorError):
            agent.validate_job(base)

    def test_image_content_type_magic(self):
        self.assertEqual(agent.image_filename(b"\\x89PNG\\r\\n\\x1a\\n"), "source.png")
        self.assertEqual(agent.image_filename(b"\\xff\\xd8\\xff"), "source.jpg")
        self.assertEqual(agent.image_filename(b"RIFF" + b"\\x00" * 4 + b"WEBP"), "source.webp")
        with self.assertRaises(agent.OperatorError):
            agent.image_filename(b"not-image")

    def test_enrollment_never_prints_secret(self):
        url = "https://spaktok-vast-operator.spaktok.workers.dev"
        with tempfile.TemporaryDirectory() as folder:
            state = Path(folder)
            out = io.StringIO()

            def fake_post(_url, _path, payload, **kwargs):
                self.assertEqual(_url, url)
                self.assertEqual(_path, "/v1/agent/enroll")
                self.assertEqual(len(payload["tokenSha256"]), 64)
                return {"pending": True, "deviceId": payload["deviceId"]}

            with patch.object(agent, "STATE_DIR", state), \
                 patch.object(agent, "CONFIG", state / "device.json"), \
                 patch.object(agent, "post_json", fake_post), \
                 contextlib.redirect_stdout(out):
                agent.enroll(url)
                private = json.loads((state / "device.json").read_text())
                self.assertNotIn(private["token"], out.getvalue())
                self.assertIn("PAIR_CODE=", out.getvalue())
                self.assertEqual((state / "device.json").stat().st_mode & 0o077, 0)


if __name__ == "__main__":
    unittest.main()
