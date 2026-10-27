# SpakTok Reality Engine — Phase 6: Canonical Authoring + Interactive Hands

2026-10-27. Opt-in hardware-QA rollout. Scope: shared GLB authoring
contracts and portable interaction mechanics; no claim of photoreal hair
physics or measured true-depth finger collisions.

## The platform, not a crown filter
- `reality-canonical-head.ts`: meter-based, versioned authoring coordinate
  contract (GLB/glTF Y-up, PBR requirements, safe 3D grip pivots).
  The nominal 63 mm interpupillary reference is a **model assumption**,
  NOT a biometric measurement of anyone's real eye distance.
  A monocular camera has scale-depth ambiguity and cannot reconstruct a
  person's metric head reliably without calibration/intrinsics.
- FaceMesh3DEngine now evaluates an estimated pixels-per-meter for future
  editor/asset authoring QA; existing crown/glasses scaling is deliberately
  unchanged to prevent regressions.
- GLB assets must be properly sculpted/retopologized, UV-textured, rigged
  (if articulated) and validated; procedural previews are not marked HD.

## Hand interaction
- Real MediaPipe Hand Landmarker with **21 landmarks per hand**, up to 2 hands,
  sourced from the official pinned model bundle. Video landmark inference
  runs locally in the browser at a capped ~115 ms interval.
- Activation for device tests: `?realityHands=1` and any 3D wearable
  (try `3d-lux-glasses`). Selecting hands DOES NOT turn the effect off.
- Gesture: bring pinched thumb and index tips near the glasses/prop,
  hold for two distinct ML detections, move your hand, twist your finger
  axis to incline the rigid object; open the fingers to release.
- `RealityHandPhysics` hysteresis, candidate checks, screen-space
  relative drag, orientation and exponential spring home return prevent
  one-frame snapping. Release also occurs after tracking goes stale.
- Short face occlusion by a hand preserves the currently grabbed item
  for <=650 ms using the last pose, while disabling stale face depth.
- UI displays optional QA hand state on the camera view.

## Limitations and next quality gates
- Relative movement and roll/pitch/yaw are a plausible REAL-TIME rigid
  prop manipulation, **not** fully calibrated 3D hand/object contact.
- A physically bendable spectacle frame or realistic moving hair locks/
  strands needs its OWN SkinnedMesh/bones/blendshapes with the grip-point
  constraints and secondary motion. Those authored rigged assets are not
  present in the app today, so this does not pretend to be hair simulation.
- Fingers are NOT yet segmented as foreground occluders, so an object
  can paint above real fingers during a grip. Next step: hand/body
  occlusion mask, contact shadow, per-material collisions and rigs.
- Gesture pinch uses a 2D palm-relative heuristic, not ground-truth
  3D finger-to-object contact. Multiple subjects/occluded hands are
  unverified. Main-thread synchronous inference can affect mobile FPS.
- Privacy: video and landmarks stay device-local, but the external model
  is downloaded via HTTPS; third-party MediaPipe metrics are subject to
  upstream SDK behavior/policies.
- Memory/performance: load hand model lazily ONLY for QA participants;
  old camera/video/AR behavior remains default, GPU2 remains separate.
- Device checks: Android Chrome and iOS Safari, selfie mirroring,
  two hands, camera switching, leaving/returning with glasses, false
  grabs, prolonged occlusion, recording/stream sync, thermal/GPU load,
  portrait/landscape. Do not enable by default until performance passes.

## Next big platform feature
Canonical rig editor (author-specified grip and release constraints),
per-object friction/inertia, retargeted bones, per-vertex hair deformation,
hand/person depth segmentation, R2 effect publishing/versioning and tests
with real captured camera clips.
