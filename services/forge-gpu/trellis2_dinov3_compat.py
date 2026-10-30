"""Bridge DINOv3ViTModel encoder nesting across transformers versions.

Microsoft TRELLIS.2's DinoV3FeatureExtractor invokes self.model.layer, but
some transformers versions expose the same ModuleList at self.model.model.layer.
This applies the same backward-compatible lookup as upstream PR #156 without
editing the downloaded TRELLIS.2 checkout or changing its model weights.

Only install in the single-worker model service before it begins serving jobs.
"""
from __future__ import annotations


def install_dinov3_encoder_compat(extractor_cls, functional) -> bool:
    """Patch only nested-encoder versions, preserving the original older path.

    The class is provided by the installed TRELLIS.2 source. 'functional'
    is the torch.nn.functional module from that source, reused as-is.
    Returns True if the compatibility wrapper is active.
    """
    if getattr(extractor_cls, "_spaktok_dinov3_encoder_compat", False):
        return True
    original = extractor_cls.extract_features

    def compatible_extract_features(self, image):
        model = self.model
        if getattr(model, "layer", None) is not None:
            return original(self, image)
        encoder = getattr(model, "model", None)
        if encoder is None or getattr(encoder, "layer", None) is None:
            # Do not guess at an unknown DINOv3 architecture.
            raise RuntimeError("unsupported_dinov3_encoder_structure")
        # The following is the original TRELLIS.2 feature computation except
        # for the encoder ModuleList lookup (self.model.model.layer).
        image = image.to(model.embeddings.patch_embeddings.weight.dtype)
        hidden_states = model.embeddings(image, bool_masked_pos=None)
        position_embeddings = model.rope_embeddings(image)
        for layer_module in encoder.layer:
            hidden_states = layer_module(
                hidden_states, position_embeddings=position_embeddings
            )
        return functional.layer_norm(hidden_states, hidden_states.shape[-1:])

    extractor_cls.extract_features = compatible_extract_features
    extractor_cls._spaktok_dinov3_encoder_compat = True
    return True


def install_for_trellis2() -> bool:
    from trellis2.modules import image_feature_extractor
    installed = install_dinov3_encoder_compat(
        image_feature_extractor.DinoV3FeatureExtractor,
        image_feature_extractor.F,
    )
    print("SPAKTOK_DINOV3_ENCODER_COMPAT_INSTALLED", flush=True)
    return installed
