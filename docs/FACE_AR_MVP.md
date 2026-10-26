# SpakTok Face AR: first prototype (2026-10-26)

Face AR is separate from color grading. A native **Face AR** tab displays
ten original face effects (plus off): neon glasses, dark shades, cat, puppy,
crown, butterfly, cyber visor, hearts, robot and festival.

Architecture: MediaPipe Face Landmarker runs ON DEVICE only when makeup/
face-reshape or a face effect is enabled. Landmark geometry is temporally
smoothed, then eye coordinates define a face-local tilted coordinate system
for fast signed-distance procedural art in the existing single-pass WebGL
fragment shader. FX are uniform-selected, requiring **no shader recompile**
per mask. The same canvas is the camera preview, saved JPEG, and the input
to MediaRecorder (canvas.captureStream), so masks are actually recorded.

This is a stylized face-anchored 2D AR first version, not full 3D occlusion,
3D meshes, prebuilt CapCut/TikTok proprietary assets, or verified 60fps.
Accuracy under heavy head yaw, fast motion, multiple faces and low light
requires device testing. If tracking is unavailable or no face is found,
the effect is intentionally hidden rather than drawing off-face.

No biometric landmarks are transmitted or stored by our application.
