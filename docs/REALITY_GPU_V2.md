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

## Phase 4 — precise AR strength, scene light, performance probes (2026-10-27)

- Fractional 3D effect strength now renders (1) the integrated camera-plus-AR scene and (2) camera-only to two GPU linear-sRGB render targets, then mixes in a fullscreen pass on the same WebGL context. This avoids fading the camera when lowering crown opacity. The regular full-strength path still renders once.
- Scene-light sampling runs on-device on a 32×18 downscaled video frame no more frequently than every 500ms. A bounded, smoothed mapping controls key/fill/rim intensity, directional offset and color warmth. It does not claim HDR or real environment probes.
- QA HUD exposes CPU-side JavaScript render submission duration, draw-call count and pass count together with the existing preview FPS. These are not GPU execution time or thermal benchmarks.
- Camera images, sampled pixels and inferred facial landmarks are not sent to the lighting service or to Cloudflare.
- Feature remains behind ?realityGpu=2, awaiting Android/iOS real-camera comparison, screenshot/video parity, thermal profiling and regression tests.

## Risk controls
- A partial-strength AR effect requires three GPU render passes (full scene, camera only, compositor); low-end devices may slow down.
- Tests cover fractional vs whole opacity blending and bounded lighting response, but passing a Next.js build alone does not imply these tests have been executed.
- If frame pacing, color fidelity or transparency differs between devices, return to the default non-GPU-v2 camera without the QA flag.
