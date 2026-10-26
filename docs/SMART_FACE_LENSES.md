# SpakTok Smart Face Lenses – original effects

Added 30 original on-device face-anchored effects on top of existing 10 (total 40 effects plus off).
Groups: animals, fashion, fantasy, reactive, fun. Real mouth openness and eye openness
are derived from MediaPipe 478 landmarks and smoothed locally. Facial landmark
samples are not sent to any API; effects apply during capture via the existing
transparent Canvas 2D overlay, not color grading.

These are **original 2D AR effects**, not the protected Snapchat Lens library,
TikTok effects catalogue, CapCut proprietary templates, nor realistic 3D face
mesh assets. Quality depends on camera/lighting and head yaw. An engine that
supports arbitrary manifests could load original licensed assets in future,
but no proprietary competitor data is included. Runtime FPS is device-dependent.
