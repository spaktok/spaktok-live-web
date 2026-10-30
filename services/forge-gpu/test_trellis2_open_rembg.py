"""Pure unit checks: test the override without model weights or GPU."""
import unittest
from types import SimpleNamespace
from trellis2_open_rembg import use_open_background_model, OPEN_REMBG_MODEL


class FakeBiRefNet:
    def __init__(self, model_name, **kwargs):
        self.model_name = model_name
        self.kwargs = kwargs


class OpenBackgroundTests(unittest.TestCase):
    def test_maps_official_bria_request_to_mit_checkpoint(self):
        fake = SimpleNamespace(BiRefNet=FakeBiRefNet)
        with use_open_background_model(fake):
            x = fake.BiRefNet(model_name="briaai/RMBG-2.0")
            self.assertEqual(x.model_name, OPEN_REMBG_MODEL)
        self.assertIs(fake.BiRefNet, FakeBiRefNet)

    def test_refuses_unexpected_dynamic_model(self):
        fake = SimpleNamespace(BiRefNet=FakeBiRefNet)
        with use_open_background_model(fake):
            with self.assertRaisesRegex(ValueError, "unexpected_background"):
                fake.BiRefNet(model_name="untrusted/random-model")
        self.assertIs(fake.BiRefNet, FakeBiRefNet)

    def test_restores_wrapper_on_exception(self):
        fake = SimpleNamespace(BiRefNet=FakeBiRefNet)
        with self.assertRaisesRegex(RuntimeError, "stop"):
            with use_open_background_model(fake):
                raise RuntimeError("stop")
        self.assertIs(fake.BiRefNet, FakeBiRefNet)


if __name__ == "__main__":
    unittest.main()
