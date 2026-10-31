import base64, hashlib, hmac, json, unittest
from gpu_ticket import validate_job_read_ticket, InvalidGPUTicket

SECRET = "k" * 48
ORIGIN = "https://studio.example.org"
JOB = "AbCdEfGhIjKlMnOpQrStUvWx"
NOW = 1_800_000_000


def make(claims, prefix="sj1", secret=SECRET):
    body = base64.urlsafe_b64encode(json.dumps(claims).encode()).rstrip(b"=").decode()
    sig = base64.urlsafe_b64encode(hmac.new(secret.encode(), (prefix + "." + body).encode(),
                                            hashlib.sha256).digest()).rstrip(b"=").decode()
    return "Bearer " + prefix + "." + body + "." + sig


def good(**over):
    c = {"v": 1, "purpose": "forge-job-read", "jobId": JOB, "origin": ORIGIN,
         "iat": NOW, "exp": NOW + 240}
    c.update(over)
    return c


class JobReadTicketTest(unittest.TestCase):
    def check(self, bearer, job=JOB, origin=ORIGIN, now=NOW + 5):
        return validate_job_read_ticket(bearer, SECRET, ORIGIN, origin, job, now)

    def test_valid(self):
        self.assertEqual(self.check(make(good()))["jobId"], JOB)

    def test_wrong_job(self):
        with self.assertRaises(InvalidGPUTicket):
            self.check(make(good()), job="ZZZZZZZZZZZZZZZZZZZZZZZZ")

    def test_expired(self):
        with self.assertRaises(InvalidGPUTicket):
            self.check(make(good()), now=NOW + 241)

    def test_too_long_lifetime(self):
        with self.assertRaises(InvalidGPUTicket):
            self.check(make(good(exp=NOW + 3600)))

    def test_origin_mismatch(self):
        with self.assertRaises(InvalidGPUTicket):
            self.check(make(good()), origin="https://evil.example.org")

    def test_wrong_secret(self):
        with self.assertRaises(InvalidGPUTicket):
            self.check(make(good(), secret="x" * 48))

    def test_prefix_swap_rejected(self):
        swapped = make(good(), prefix="st1").replace("Bearer st1.", "Bearer sj1.")
        with self.assertRaises(InvalidGPUTicket):
            self.check(swapped)

    def test_wrong_purpose(self):
        with self.assertRaises(InvalidGPUTicket):
            self.check(make(good(purpose="forge-browser-one-use")))


if __name__ == "__main__":
    unittest.main()
