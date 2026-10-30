"""CPU-only, dependency-free DINOv3 extractor compatibility contracts."""
import unittest
from types import SimpleNamespace
from trellis2_dinov3_compat import install_dinov3_encoder_compat


class Tensor:
    shape = (1, 7, 3)
    def to(self, dtype):
        return self


class FakeEmbeddings:
    patch_embeddings = SimpleNamespace(weight=SimpleNamespace(dtype="bf16"))
    def __call__(self, image, bool_masked_pos):
        return image


def nested():
    def block(h, position_embeddings):
        return h
    return SimpleNamespace(
        embeddings=FakeEmbeddings(),
        rope_embeddings=lambda image: ("cos", "sin"),
        model=SimpleNamespace(layer=[block, block]),
    )


class CompatibilityTests(unittest.TestCase):
    def make_extractor(self, model):
        class Extractor:
            def __init__(self, selected):
                self.model = selected
            def extract_features(self, image):
                return "legacy"
        Extractor._functional = SimpleNamespace(layer_norm=lambda hidden, shape: hidden)
        install_dinov3_encoder_compat(Extractor, Extractor._functional)
        return Extractor(model), Extractor

    def test_nested_encoder(self):
        instance, _ = self.make_extractor(nested())
        self.assertIs(instance.extract_features(Tensor()).shape, Tensor.shape)

    def test_legacy_encoder_is_untouched(self):
        model = nested()
        model.layer = model.model.layer
        instance, _ = self.make_extractor(model)
        self.assertEqual(instance.extract_features(Tensor()), "legacy")

    def test_unknown_structure_is_not_silently_mapped(self):
        instance, _ = self.make_extractor(SimpleNamespace())
        with self.assertRaisesRegex(RuntimeError, "unsupported_dinov3"):
            instance.extract_features(Tensor())

    def test_patch_is_idempotent(self):
        instance, cls = self.make_extractor(nested())
        original_wrapper = cls.extract_features
        self.assertTrue(install_dinov3_encoder_compat(cls, cls._functional))
        self.assertIs(cls.extract_features, original_wrapper)


if __name__ == "__main__":
    unittest.main()
