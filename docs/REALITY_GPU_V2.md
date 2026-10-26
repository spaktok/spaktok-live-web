# SpakTok Reality GPU v2 — Integrated 3D Render (QA opt-in)
2026-10-26

## What is implemented
- The existing color, beauty, segmentation and FX fragment shader source is reused unchanged in a Three.js ShaderMaterial.
- Three.js VideoTexture (unflipped, matching the legacy shader) draws a full-frame camera plane **inside the same Three.js WebGLRenderer and scene** as tracked PBR accessories, depth occluder and mesh makeup.
- Background geometry is depth-write disabled and rendered first; 3D objects and face depth operate as before.
- The integrated camera plane uses the same mirror and cover-crop uniforms as the legacy camera.
- Photo capture and MediaRecorder use the fully composited Three canvas directly for the QA path, avoiding the per-frame Canvas2D readback used in Stage 1.
- Tracking and segmentation remain local to the device. No camera pixels are uploaded.
- 5 new test cases protect shader uniform parity, crop, and opt-in behavior.

## How to test
Open your Vercel deployment's camera URL with `?realityGpu=2`, select a 3D lens (ideally the authored crown), allow camera permissions, and compare preview, captured photo and recorded video with the same URL WITHOUT `realityGpu=2`. Compare selfie mirroring, Y-direction, colors, beauty masks and occlusion with an Android and iPhone device.

## Hard limitations
- This is an explicit **QA opt-in**, not the default production pathway. Automated build success cannot prove correct orientation, sRGB fidelity, media recording support or 30/60 FPS on real hardware.
- The current full-canvas opacity technique for 3D lens strength is not yet GPU-equivalent. Integrated mode keeps opaque camera at full strength, so AR alpha/strength requires a future GPU blending pass and measurement.
- A second legacy WebGL renderer may still be allocated to provide instant safe fallback, but it is not used to draw frames while GPU v2 is active.
- The world does not yet have real scene-depth sensing, reliable hair/hand occlusion, realistic calibrated scene lighting, or a measured photorealistic gemstone refraction result. MeshPhysicalMaterial can use in-scene background when transmission is supported; check actual visuals before making a claim.
- Face processing remains single-person with the MediaPipe 478 points.
- Direct video capture is subject to mobile WebGL driver and MediaRecorder behavior; check recorded first/last frames and audio sync.

## QA hardening — orientation, output color, and segmentation allocations
- Verified and locked the top-left video UV convention mathematically: the Y-down Three orthographic camera maps PlaneGeometry local -Y / UV 0 to screen top. A second UV flip would invert the video; the existing shader orientation is retained and regression-tested.
- GPU2 runs the same creative sRGB grading, then converts the final graded color into the linear working space before `#include <colorspace_fragment>`. This avoids double gamma correction and allows physically based scene rendering to interpret the background consistently; real-device comparisons remain mandatory.
- Face tracking with an invalid head pose now hides the mesh, crown and makeup rather than leaving a stale object visible.
- MediaPipe mask updates reuse the existing GPU texture while width/height are unchanged, avoiding repeated texture creation per segmentation result.
- The unit tests cover correct UV handedness, sRGB/linear round-trip invariants, and shader variant separation.
