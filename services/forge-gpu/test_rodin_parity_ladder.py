import tempfile
import unittest
from pathlib import Path

from rodin_parity_ladder import plan_profiles, run_ladder
from trellis2_quality import (PRESETS, POLY_BUDGETS, select_trellis2_quality,
                              with_poly_budget)

GIB = 1024 ** 3


class FakeCuda:
    def __init__(self, total):
        self.total = total
        self.resets = 0

    def get_device_properties(self, _index):
        return type("P", (), {"total_memory": self.total})()

    def reset_peak_memory_stats(self):
        self.resets += 1

    def max_memory_allocated(self):
        return 40 * GIB


class FakeTorch:
    def __init__(self, total=80 * GIB):
        self.cuda = FakeCuda(total)


class FakeEngine:
    def __init__(self, fail_on=None):
        self.calls = []
        self.fail_on = fail_on

    def generate_with_quality(self, photo, quality, *, job_id, max_bytes):
        self.calls.append((quality.profile, quality.decimation_target, max_bytes))
        if quality.profile == self.fail_on:
            raise RuntimeError("CUDA out of memory /secret/path")
        return b"glTF" + b"\x00" * 60


def fake_clock():
    ticks = iter(range(0, 1000, 5))
    return lambda: next(ticks)


class UltraPresetTests(unittest.TestCase):
    def test_ultra_is_never_reachable_from_synchronous_api(self):
        with self.assertRaises(PermissionError):
            select_trellis2_quality("studio-ultra", vram_bytes=80 * GIB,
                                    hd_authorized=True)

    def test_ultra_needs_async_and_hd_and_70gib(self):
        ultra = select_trellis2_quality("studio-ultra", vram_bytes=80 * GIB,
                                        hd_authorized=True,
                                        async_operator_run=True)
        self.assertEqual(ultra.pipeline_type, "1536_cascade")
        self.assertEqual(ultra.texture_size, 4096)
        with self.assertRaises(PermissionError):
            select_trellis2_quality("studio-ultra", vram_bytes=80 * GIB,
                                    async_operator_run=True)
        with self.assertRaises(RuntimeError):
            select_trellis2_quality("studio-ultra", vram_bytes=48 * GIB,
                                    hd_authorized=True,
                                    async_operator_run=True)

    def test_poly_budget_only_lowers_ceiling(self):
        mobile = PRESETS["mobile-preview"]
        self.assertEqual(with_poly_budget(mobile, 50_000).decimation_target, 50_000)
        with self.assertRaises(ValueError):
            with_poly_budget(mobile, 300_000)
        with self.assertRaises(ValueError):
            with_poly_budget(mobile, 12_345)
        self.assertEqual(POLY_BUDGETS, tuple(sorted(POLY_BUDGETS)))


class LadderTests(unittest.TestCase):
    def test_plan_rejects_ultra_without_flag_and_duplicates(self):
        with self.assertRaises(PermissionError):
            plan_profiles("mobile-preview,studio-ultra", allow_ultra=False)
        with self.assertRaises(ValueError):
            plan_profiles("mobile-preview,mobile-preview", allow_ultra=False)
        with self.assertRaises(ValueError):
            plan_profiles("rodin-max", allow_ultra=True)
        self.assertEqual(plan_profiles("studio-hd,studio-ultra", allow_ultra=True),
                         ["studio-hd", "studio-ultra"])

    def test_runs_each_profile_once_and_records_evidence(self):
        engine, torch = FakeEngine(), FakeTorch()
        with tempfile.TemporaryDirectory() as tmp:
            report = run_ladder(b"img", ["mobile-preview", "studio-hd"],
                                Path(tmp), engine=engine, torch_module=torch,
                                inspect=lambda p: {"triangles": 1},
                                allow_ultra=False, clock=fake_clock())
            self.assertTrue((Path(tmp) / "spaktok-studio-hd.glb").is_file())
        self.assertIsNone(report["winner"])
        self.assertEqual([c[0] for c in engine.calls], ["mobile-preview", "studio-hd"])
        self.assertEqual(torch.cuda.resets, 2)
        row = report["results"][1]
        self.assertTrue(row["ok"])
        self.assertEqual(row["pipeline_type"], "1024_cascade")
        self.assertEqual(row["seconds"], 5)
        self.assertEqual(row["peak_vram_gib"], 40.0)
        self.assertTrue(row["fits_35mib_web_delivery"])

    def test_stops_at_first_failure_without_leaking_message(self):
        engine = FakeEngine(fail_on="detail-preview")
        with tempfile.TemporaryDirectory() as tmp:
            report = run_ladder(b"img", ["mobile-preview", "detail-preview",
                                         "studio-hd"], Path(tmp), engine=engine,
                                torch_module=FakeTorch(), inspect=lambda p: {},
                                allow_ultra=False, clock=fake_clock())
        self.assertEqual(len(engine.calls), 2)
        failed = report["results"][-1]
        self.assertFalse(failed["ok"])
        self.assertEqual(failed["error_type"], "RuntimeError")
        self.assertNotIn("secret", str(report))

    def test_poly_budget_applies_below_ceiling_only(self):
        engine = FakeEngine()
        with tempfile.TemporaryDirectory() as tmp:
            run_ladder(b"img", ["mobile-preview", "studio-hd"], Path(tmp),
                       engine=engine, torch_module=FakeTorch(),
                       inspect=lambda p: {}, allow_ultra=False,
                       poly_budget=200_000, clock=fake_clock())
        self.assertEqual(engine.calls[0][1], 120_000)
        self.assertEqual(engine.calls[1][1], 200_000)


if __name__ == "__main__":
    unittest.main()
