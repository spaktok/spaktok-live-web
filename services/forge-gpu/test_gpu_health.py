import hashlib
import hmac
import unittest
from gpu_health import sign_ready_health

class SignedGpuHealthTests(unittest.TestCase):
    def test_good_nonce_proves_shared_secret_without_sending_it(self):
        nonce = "abcdef0123456789abcdef0123456789"
        secret = "x" * 40
        expected = hmac.new(
            secret.encode(), f"forge-health-v1:{nonce}:stable-fast-3d:ready".encode(),
            hashlib.sha256
        ).hexdigest()
        self.assertEqual(sign_ready_health(nonce, secret), expected)

    def test_bad_nonces_fail_closed(self):
        for nonce in ("", "z" * 32, "0" * 31, "0" * 33, "0" * 32 + "\r\n"):
            with self.assertRaises(ValueError):
                sign_ready_health(nonce, "x" * 40)

    def test_weak_secret_fails_closed(self):
        with self.assertRaises(ValueError):
            sign_ready_health("0"*32, "short")

if __name__ == "__main__":
    unittest.main()
