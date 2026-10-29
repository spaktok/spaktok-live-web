import base64
import hashlib
import hmac
import json
import unittest
from gpu_ticket import validate_gpu_ticket, InvalidGPUTicket

SECRET='x'*40
ORIGIN='https://v0-spaktok-elite-app.vercel.app'
NONCE='123e4567-e89b-42d3-a456-426614174000'

def ticket(claim):
    body=base64.urlsafe_b64encode(json.dumps(claim,separators=(',',':')).encode()).rstrip(b'=').decode()
    sig=base64.urlsafe_b64encode(hmac.new(SECRET.encode(),body.encode(),hashlib.sha256).digest()).rstrip(b'=').decode()
    return 'Bearer st1.'+body+'.'+sig

class TicketTests(unittest.TestCase):
    def setUp(self):
        self.now=1800000000
        self.claim=dict(v=1,purpose='forge-browser-one-use',nonce=NONCE,
                        iat=self.now,exp=self.now+120,origin=ORIGIN,
                        sha256='a'*64,mime='image/png',size=10000)
    def ok(self,claim=None,origin=ORIGIN):
        return validate_gpu_ticket(ticket(claim or self.claim),SECRET,ORIGIN,origin,self.now)
    def test_positive(self):
        self.assertEqual(self.ok()['nonce'],NONCE)
    def test_expired_rejected(self):
        c={**self.claim,'exp':self.now-1}
        with self.assertRaises(InvalidGPUTicket):self.ok(c)
    def test_bad_origin_rejected(self):
        with self.assertRaises(InvalidGPUTicket):self.ok(origin='https://evil.example')
    def test_sha_tampering_rejected(self):
        signed=ticket(self.claim)
        with self.assertRaises(InvalidGPUTicket):
            validate_gpu_ticket(signed.replace('a','b',1),SECRET,ORIGIN,ORIGIN,self.now)
    def test_missing_permission_rejected(self):
        c={**self.claim,'purpose':'other'}
        with self.assertRaises(InvalidGPUTicket):self.ok(c)
    def test_oversized_rejected(self):
        c={**self.claim,'size':9*1024*1024}
        with self.assertRaises(InvalidGPUTicket):self.ok(c)
    def test_future_expiry_rejected(self):
        c={**self.claim,'exp':self.now+500}
        with self.assertRaises(InvalidGPUTicket):self.ok(c)

if __name__=='__main__': unittest.main()
