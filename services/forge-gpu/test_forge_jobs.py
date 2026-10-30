import asyncio
import os
import stat
import tempfile
import unittest

from forge_jobs import JobQueue, QueueFull, categorize

GLB = b"glTF" + b"\x02\x00\x00\x00" + (40).to_bytes(4, "little") + b"\x00" * 28


class Clock:
    def __init__(self):
        self.now = 1_000_000.0

    def __call__(self):
        return self.now


def run(coro):
    return asyncio.run(coro)


class ForgeJobsTest(unittest.TestCase):
    def setUp(self):
        self.dir = tempfile.mkdtemp()
        self.clock = Clock()

    def queue(self, fn, **kw):
        return JobQueue(fn, workdir=self.dir, clock=self.clock, **kw)

    def test_success_writes_private_result_and_drops_photo(self):
        seen = []

        def gen(photo, profile, poly, job_id):
            seen.append((photo, profile, poly))
            return GLB

        async def go():
            q = self.queue(gen)
            job = q.submit(b"p" * 200, "studio-ultra", 300_000)
            self.assertEqual(job["state"], "queued")
            self.assertEqual(job["queuePosition"], 1)
            await q.run_one(job["id"])
            return q, job["id"]

        q, job_id = run(go())
        status = q.status(job_id)
        self.assertEqual(status["state"], "succeeded")
        self.assertEqual(status["bytes"], len(GLB))
        self.assertEqual(seen, [(b"p" * 200, "studio-ultra", 300_000)])
        self.assertIsNone(q._jobs[job_id].photo)
        path = q.result_path(job_id)
        self.assertEqual(stat.S_IMODE(os.stat(path).st_mode), 0o600)

    def test_failure_is_categorized_without_message(self):
        def gen(*_):
            raise RuntimeError("CUDA out of memory at /secret/path")

        async def go():
            q = self.queue(gen)
            job = q.submit(b"p" * 200, "studio-hd")
            await q.run_one(job["id"])
            return q.status(job["id"])

        status = run(go())
        self.assertEqual(status["state"], "failed")
        self.assertEqual(status["error"], "cuda_out_of_memory")
        self.assertNotIn("secret", str(status))

    def test_rejects_non_glb_output(self):
        async def go():
            q = self.queue(lambda *_: b"not a glb" * 10)
            job = q.submit(b"p" * 200, "studio-hd")
            await q.run_one(job["id"])
            return q.status(job["id"])

        self.assertEqual(run(go())["error"], "image_or_glb_invalid")

    def test_queue_depth_bound(self):
        q = self.queue(lambda *_: GLB, max_queue=2)
        q.submit(b"p" * 200, "studio-hd")
        q.submit(b"p" * 200, "studio-hd")
        with self.assertRaises(QueueFull):
            q.submit(b"p" * 200, "studio-hd")

    def test_results_expire_after_ttl(self):
        async def go():
            q = self.queue(lambda *_: GLB, ttl_seconds=60)
            job = q.submit(b"p" * 200, "studio-hd")
            await q.run_one(job["id"])
            return q, job["id"]

        q, job_id = run(go())
        path = q.result_path(job_id)
        self.clock.now += 61
        self.assertIsNone(q.result_path(job_id))
        self.assertEqual(q.status(job_id)["state"], "expired")
        self.assertFalse(os.path.exists(path))

    def test_worker_serializes_jobs(self):
        active, peak = [0], [0]

        def gen(*_):
            active[0] += 1
            peak[0] = max(peak[0], active[0])
            active[0] -= 1
            return GLB

        async def go():
            q = self.queue(gen)
            q.start()
            ids = [q.submit(b"p" * 200, "studio-hd")["id"] for _ in range(3)]
            await asyncio.wait_for(q._pending.join(), 5)
            await q.stop()
            return [q.status(i)["state"] for i in ids]

        self.assertEqual(run(go()), ["succeeded"] * 3)
        self.assertEqual(peak[0], 1)

    def test_unknown_job(self):
        q = self.queue(lambda *_: GLB)
        self.assertIsNone(q.status("missing"))
        self.assertIsNone(q.result_path("missing"))

    def test_categorize(self):
        self.assertEqual(categorize(PermissionError("x")), "profile_not_permitted")
        self.assertEqual(categorize(ValueError("x")), "image_or_glb_invalid")
        self.assertEqual(categorize(RuntimeError("cuDNN error")), "cuda_runtime_error")
        self.assertEqual(categorize(RuntimeError("boom")), "inference_exception")


if __name__ == "__main__":
    unittest.main()
