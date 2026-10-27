# SpakTok Reality Studio — All-effect quality and calibration matrix

Date: 2026-10-27
Scope: **every registered camera effect**, not just the uploaded crown.

## What was implemented in this increment
- Generated a read-only audit inventory from the existing versioned `REALITY_EFFECTS` source of truth, covering the complete face catalog, 3D makeup, beautification sliders, color grades, post-processing and backgrounds.
- Added a searchable/filterable quality panel to `/reality-studio`.
- Per-effect metadata distinguishes authored GLB, procedural 3D, tracked face-surface and shader-only operations.
- Flags the disabled legacy external-photo face overlay, unverified GLB distribution rights, professional 3D asset gaps and device QA still to be completed.
- Every entry explicitly keeps **recording parity** and **physical-device performance** as outstanding gates.
- Added regression tests for all categories to the existing Reality Engine PR CI.

This changes **diagnostics and readiness visibility only**, not published camera rendering, existing model files, user face data, Cloudflare storage, or production defaults.

## Universal acceptance matrix

| Family | On-device calibration and visual acceptance |
| --- | --- |
| 3D accessories (crown, glasses, caps, crystal, face expressions) | Scale and pivot against live face, pitch/yaw/roll, occlusion behind nose/face/hair/hand, realistic glTF mesh/UV/PBR materials, no tracking freeze |
| 3D makeup | Region masks for lips, eye sockets, lashes, blush and contour; skin preservation, dark/light skin tone tests, mouth/blink accuracy |
| Face morph | Preserve the real camera identity, bounded smooth warp, no tearing at cheek/hair boundaries, expressions and rapid head motion |
| 2D face masks and reactive stickers | Single selfie reflection, aspect-ratio crop, stable landmark anchoring, reaction timing, graceful loss of tracking |
| Color looks | Preview-vs-capture gamma and colors, highlight clipping and dark-scene noise, correct intensity blending |
| Post effects | Correct time-dependent motion, GPU draw budget, video-recording parity, no shader oscillation at poor frame pacing |
| Backgrounds | Hair/finger edges, movement, partial occlusion, segmentation fallback and low-light performance |
| Beauty sliders | Natural skin and facial shape, no over-smoothing, consistent lens settings and fair skin tone behavior |

## Standard calibration workflow (all effects)

1. Audit the *definition* for every catalog effect and identify real asset versus shader/procedural approximation.
2. For face-attached effects, compare display coordinates to one MediaPipe source-video transform, including single selfie flip and CSS cover crop. For GLB, calibrate pivot, scale and material coordinate axes.
3. Verify front, 30–45° yaw left/right, pitch, roll, approach/retreat, blink, smile, open mouth, rapid motion and tracking loss; never reuse stale face geometry.
4. Test hand/face/hair foreground ordering for applicable items. Skeletal HandLandmarker is not equivalent to pixel-accurate hand segmentation.
5. Compare live preview, JPEG still and recorded WebM/MP4 after frame conversion; verify no orientation, gamma or effects mismatch.
6. Measure FPS, GPU memory, CPU/GPU time and thermals on at least one mid-tier Android and supported iPhone; aim 30 FPS stable on mid-tier hardware and 60 FPS where sustainable, but never claim these goals as measured.
7. Review source/texture licensing, face data privacy and automated model validation before any public publication.
8. Mark the item QA-complete only after a real-device test record. The current dashboard intentionally does **not** offer a "passed" status.

## Next engineering changes (not yet implemented)

- Per-effect transform and PBR calibration parameters in a shared creator inspector, persisted in versioned authoring projects.
- Dedicated authored GLB assets for procedural accessories, meshes/rigs for expressive effects, and proper multi-angle material quality checks.
- Accurate dense face/head 3D fitting, per-pixel hair/hand masks, mobile fallback budgets and platform-native camera pipeline support.
- Video comparison harness and telemetry with per-device QA results so readiness can be evidence-backed.
- Moderation, licensing verification and approved CDN publication service.

## Release safety
This increment is an isolated PR. Do **not** merge/deploy it automatically. The dashboard does not send face landmarks to the server. It does not imply production parity with Lens Studio, Effect House or other products.
