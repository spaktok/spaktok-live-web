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
        self.assertEqual(agent.image_filename(b"\x89PNG\r\n\x1a\n"), "source.png")
        self.assertEqual(agent.image_filename(b"\xff\xd8\xff"), "source.jpg")
        self.assertEqual(agent.image_filename(b"RIFF" + b"\x00" * 4 + b"WEBP"), "source.webp")
        with self.assertRaises(agent.OperatorError):
            agent.image_filename(b"not-image")


    def test_curl_transport_keeps_device_token_off_process_argv(self):
        import subprocess

        base = "https://spaktok-vast-operator.spaktok.workers.dev"
        secret = "TESTSECRETONLY" * 5
        device = {"deviceId": "a" * 32, "token": secret}
        captured = {}

        def mocked_curl(args, **kwargs):
            captured["args"] = list(args)
            captured["config"] = kwargs["input"].decode("utf-8")
            # curl's private response file is configured through stdin only.
            output_line = next(line for line in captured["config"].splitlines()
                               if line.startswith("output = "))
            output = Path(json.loads(output_line.split(" = ", 1)[1]))
            output.write_bytes(b'{"paired":true,"job":null}')
            return subprocess.CompletedProcess(args, 0, stdout=b"200",
                                               stderr=b"")

        with patch.object(agent.subprocess, "run", side_effect=mocked_curl):
            raw = agent.api(base, "/v1/agent/claim", method="POST",
                            body=b"{}", device=device)
        self.assertEqual(json.loads(raw)["paired"], True)
        self.assertNotIn(secret, " ".join(captured["args"]))
        self.assertIn(secret, captured["config"])
        self.assertEqual(captured["args"][:2], ["curl", "-q"])

    def test_curl_bounded_error_code_is_reported(self):
        import subprocess

        def rejected(args, **kwargs):
            config = kwargs["input"].decode("utf-8")
            line = next(x for x in config.splitlines() if x.startswith("output = "))
            Path(json.loads(line.split(" = ", 1)[1])).write_bytes(
                b'{"error":"enrollment_closed"}')
            return subprocess.CompletedProcess(args, 0, stdout=b"403", stderr=b"")

        with patch.object(agent.subprocess, "run", side_effect=rejected):
            with self.assertRaisesRegex(agent.OperatorError,
                                        "remote_http_403_enrollment_closed"):
                agent.api("https://spaktok-vast-operator.spaktok.workers.dev",
                          "/v1/agent/enroll", method="POST", body=b"{}")

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
                agent.enroll(url, auto_start=False)
                private = json.loads((state / "device.json").read_text())
                self.assertNotIn(private["token"], out.getvalue())
                self.assertIn("PAIR_CODE=", out.getvalue())
                self.assertEqual((state / "device.json").stat().st_mode & 0o077, 0)


if __name__ == "__main__":
    unittest.main()
