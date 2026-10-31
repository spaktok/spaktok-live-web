import asyncio
import struct
import tempfile
import unittest

from forge_jobs import JobQueue
from trellis2_texturing import sniff_mesh_format

GLB = b"glTF" + struct.pack("<II", 2, 40) + b"\x00" * 28


def glb(n):
    return b"glTF" + struct.pack("<II", 2, n) + b"\x00" * (n - 12)


class SniffTest(unittest.TestCase):
    def test_accepts_glb_and_ply(self):
        self.assertEqual(sniff_mesh_format(glb(128)), "glb")
        self.assertEqual(sniff_mesh_format(b"ply\nformat binary" + b"\x00" * 64), "ply")

    def test_rejects_bad_inputs(self):
        for bad in (b"", b"x" * 100, b"glTF" + struct.pack("<II", 1, 128) + b"\0" * 116,
                    b"glTF" + struct.pack("<II", 2, 999) + b"\0" * 116, "glb"):
            with self.assertRaises(ValueError):
                sniff_mesh_format(bad)


class RetextureQueueTest(unittest.TestCase):
    def test_unavailable_without_callable(self):
        q = JobQueue(lambda *a: GLB, workdir=tempfile.mkdtemp())
        self.assertFalse(q.supports_retexture)
        with self.assertRaises(RuntimeError):
            q.submit_retexture(b"p", b"m")

    def test_dispatches_and_drops_inputs(self):
        seen = []

        def retex(photo, mesh, job_id):
            seen.append((photo, mesh))
            return GLB

        async def go():
            q = JobQueue(lambda *a: self.fail("generate called"),
                         workdir=tempfile.mkdtemp(), retexture=retex)
            job = q.submit_retexture(b"photo", b"mesh")
            self.assertEqual(job["kind"], "retexture")
            self.assertEqual(job["profile"], "retexture")
            await q.run_one(job["id"])
            internal = q._jobs[job["id"]]
            self.assertIsNone(internal.photo)
            self.assertIsNone(internal.mesh)
            return q.status(job["id"])

        status = asyncio.run(go())
        self.assertEqual(seen, [(b"photo", b"mesh")])
        self.assertEqual(status["state"], "succeeded")


if __name__ == "__main__":
    unittest.main()
