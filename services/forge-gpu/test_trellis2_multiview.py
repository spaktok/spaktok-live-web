import asyncio
import tempfile
import unittest

import trellis2_multiview as mv
from forge_jobs import JobQueue

GLB = b"glTF" + b"\x02\x00\x00\x00" + (40).to_bytes(4, "little") + b"\x00" * 28


class FakeModule:
    """Mimics the parts of torch.nn.Module the wrapper relies on."""

    def __init__(self):
        pass

    def __getattr__(self, name):
        state = object.__getattribute__(self, "__dict__")
        if name in state:
            return state[name]
        raise AttributeError(name)

    def __call__(self, *args, **kwargs):
        return self.forward(*args, **kwargs)


class Cond(list):
    def __getitem__(self, item):
        result = super().__getitem__(item)
        return Cond(result) if isinstance(item, slice) else result


class FakeFlow:
    resolution = 32

    def __init__(self):
        self.calls = []

    def __call__(self, x_t, t, cond, **kwargs):
        self.calls.append(list(cond))
        return x_t + sum(cond)


class FakePipeline:
    def __init__(self):
        self.models = {"sparse_structure_flow_model": FakeFlow(),
                       "shape_slat_flow_model_512": FakeFlow(),
                       "shape_slat_decoder": object()}
        self.encoded = []

    def get_cond(self, image, resolution, include_neg_cond=True):
        self.encoded.append((image, include_neg_cond))
        cond = Cond(image) if isinstance(image, list) else Cond([image])
        out = {"cond": cond}
        if include_neg_cond:
            out["neg_cond"] = Cond([0])
        return out


def zeros_like(cond):
    return Cond([0] * len(cond))


class MultiViewTest(unittest.TestCase):
    def test_positive_branch_averages_views_negative_runs_once(self):
        pipe = FakePipeline()
        flow = pipe.models["shape_slat_flow_model_512"]
        with mv.multiview_conditioning(pipe, [10, 20, 30], FakeModule, zeros_like):
            conds = pipe.get_cond("ignored", 512)
            self.assertEqual(list(conds["cond"]), [10, 20, 30])
            self.assertEqual(list(conds["neg_cond"]), [0])
            wrapped = pipe.models["shape_slat_flow_model_512"]
            self.assertEqual(wrapped(1, 0.5, conds["cond"]), 1 + 20)
            self.assertEqual(wrapped(1, 0.5, conds["neg_cond"]), 1)
            self.assertEqual(wrapped.resolution, 32)
        self.assertEqual(flow.calls, [[10], [20], [30], [0]])
        self.assertEqual(pipe.encoded, [([10, 20, 30], False)])

    def test_restores_pipeline_even_on_failure(self):
        pipe = FakePipeline()
        originals = dict(pipe.models)
        with self.assertRaises(RuntimeError):
            with mv.multiview_conditioning(pipe, [1, 2], FakeModule, zeros_like):
                raise RuntimeError("cuda_oom")
        self.assertEqual(pipe.models, originals)
        self.assertNotIn("get_cond", vars(pipe))
        self.assertEqual(list(pipe.get_cond(5, 512)["cond"]), [5])

    def test_non_flow_models_untouched(self):
        pipe = FakePipeline()
        decoder = pipe.models["shape_slat_decoder"]
        with mv.multiview_conditioning(pipe, [1, 2], FakeModule, zeros_like):
            self.assertIs(pipe.models["shape_slat_decoder"], decoder)

    def test_view_count_bounds(self):
        for bad in (0, 1, 6):
            with self.assertRaises(ValueError):
                mv.validate_view_count(bad)
        mv.validate_view_count(2)
        mv.validate_view_count(5)

    def test_queue_passes_and_drops_views(self):
        seen = []

        def gen(photo, profile, poly, job_id, views=()):
            seen.append(views)
            return GLB

        async def go():
            q = JobQueue(gen, workdir=tempfile.mkdtemp())
            job = q.submit(b"p" * 200, "studio-hd", None, views=(b"a" * 200, b"b" * 200))
            self.assertEqual(job["views"], 3)
            await q.run_one(job["id"])
            return q, job["id"]

        q, job_id = asyncio.run(go())
        self.assertEqual(q.status(job_id)["state"], "succeeded")
        self.assertEqual(seen, [(b"a" * 200, b"b" * 200)])
        self.assertEqual(q._jobs[job_id].views, ())

    def test_queue_rejects_too_many_views(self):
        q = JobQueue(lambda *a, **k: GLB, workdir=tempfile.mkdtemp())
        with self.assertRaises(ValueError):
            q.submit(b"p" * 200, "studio-hd", None, views=(b"v" * 200,) * 5)


if __name__ == "__main__":
    unittest.main()
