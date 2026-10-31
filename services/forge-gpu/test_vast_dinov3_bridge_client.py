"""CPU-only tests; no Hugging Face or Cloudflare calls, no GPU charges."""
import hashlib
import json
from pathlib import Path
import tempfile
import unittest
from unittest.mock import patch

import vast_dinov3_bridge_client as dl


class DinoBridgeTests(unittest.TestCase):
    def test_allowed_files_are_fixed_to_approved_model(self):
        self.assertEqual(dl.MODEL, "facebook/dinov3-vitl16-pretrain-lvd1689m")
        self.assertEqual(dl.FILES["model.safetensors"], 1212559808)
        self.assertLessEqual(dl.CHUNK_SIZE, 8 * 1024 * 1024)
        with tempfile.TemporaryDirectory() as td:
            with patch.object(dl, "DIR", Path(td)):
                with self.assertRaises(dl.OperatorError):
                    dl.download_one("../../etc/passwd", 10, {})

    def test_download_in_bounded_ranges_and_validate(self):
        payload = b"0123456789"
        seen = []
        def fake_api(base, path, **kwargs):
            self.assertEqual(base, dl.BRIDGE)
            self.assertEqual(path, "/v1/agent/dinov3/file/config.json")
            self.assertEqual(kwargs["method"], "GET")
            chunk = kwargs["headers"]["Range"]
            seen.append(chunk)
            start, end = chunk.split("=")[1].split("-")
            return payload[int(start):int(end)+1]
        with tempfile.TemporaryDirectory() as td:
            with patch.object(dl, "DIR", Path(td)), \
                 patch.object(dl, "FILES", {"config.json": len(payload)}), \
                 patch.object(dl, "CHUNK_SIZE", 4), \
                 patch.object(dl, "api", side_effect=fake_api):
                out=dl.download_one("config.json",len(payload),
                                    {"deviceId":"a"*32,"token":"notreal"})
                self.assertEqual(out["bytes"],10)
                self.assertEqual(out["sha256"],hashlib.sha256(payload).hexdigest())
                self.assertEqual((Path(td)/"config.json").read_bytes(),payload)
                self.assertEqual(seen,["bytes=0-3","bytes=4-7","bytes=8-9"])

    def test_mismatched_chunk_does_not_publish(self):
        with tempfile.TemporaryDirectory() as td:
            with patch.object(dl, "DIR", Path(td)), \
                 patch.object(dl, "FILES", {"config.json": 10}), \
                 patch.object(dl, "CHUNK_SIZE", 5), \
                 patch.object(dl, "api", return_value=b"shorter"):
                with self.assertRaisesRegex(dl.OperatorError,
                                            "checkpoint_chunk_size_mismatch"):
                    dl.download_one("config.json", 10, {})
                self.assertFalse((Path(td)/"config.json").exists())
                self.assertFalse((Path(td)/"config.json.partial").exists())

    def test_cloudflare_secret_and_device_grant_are_required(self):
        device={"deviceId":"a"*32,"token":"private"}
        cases=[
            ({"granted":False,"tokenConfigured":True,"model":dl.MODEL},
             "dinov3_device_grant_required"),
            ({"granted":True,"tokenConfigured":False,"model":dl.MODEL},
             "dinov3_cloudflare_secret_required"),
            ({"granted":True,"tokenConfigured":True,"model":"other/model"},
             "dinov3_model_mismatch"),
        ]
        for response,expected in cases:
            with patch.object(dl, "read_config", return_value=device), \
                 patch.object(dl, "api", return_value=json.dumps(response).encode()):
                with self.assertRaisesRegex(dl.OperatorError,expected):
                    dl.sync()


if __name__ == "__main__":
    unittest.main()
