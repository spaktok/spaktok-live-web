# SpakTok Live Avatar Studio — 2026-10-27

## What is delivered on main
- Browser-local '/avatar-studio' under Reality Studio, independent from sign-in and Cloudflare D1.
- Original procedural demo head whose pupils, lids and mouth animate with head pose/blink/jaw.
- Import self-contained GLB <=15MB, inspect named morph targets and map supported ARKit / generic / VRM-style aliases onto local FaceLandmarker 52 blendshape coefficients. Unsupported expressions stay neutral; imported meshes without compatible morph targets rotate the whole head but do not gain nonexistent face rigging.
- Camera opt-in, local face model via existing SpakTok Cloudflare WASM/model CDN, no camera frames or tracking sent to server. Separate stop button closes camera stream and drops tracking state.
- Smooth, bounded head pose and expression transitions; reset to neutral after tracking loss. Strength adjustment and selfie mirroring.
- Unit tests of morph binding, coefficient validation, pose bounds, temporal easing and loss cases, with workflow entry.

## Hard limits / next phases
- Local WebGL avatar preview, **not** a real Agora/WebRTC publisher. The scene cannot be viewed by public livestream spectators yet.
- No portrait-to-3D AI generation, no rear-head reconstruction or auto-rigging. The 3D model must already be fitted for facial animation; the demo head is simplified original geometry, NOT a user likeness.
- Different vendor rigs may require a manually authored mapping to morph target names, VRM avatar expression support and per-character zero-pose calibration. Current dictionary mappings cover selected ARKit, standard and VRM-style names only.
- Angular head position is inferred from measured face landmarks and is not a calibrated 6DoF head solution; a full facial transformation matrix, face-to-camera depth and occlusion are future tasks.
- Hair, eyes, teeth, shoulders, body motion, hand/voice sync, blendshape quality, facial identity, and GLB compression compatibility require QA.
- Need real Android Chrome tracking, scene memory, blinking under sunglasses, strong yaw, mouth movement and 10-minute thermal/FPS tests. Existing GitHub Actions workflow has previously failed before any runner steps; a Vercel build verifies build/TS only, not unit tests or tracking fidelity.
- Never expose user's images, face, private GLB or biometric landmarks to remote generation vendors without an explicit opt-in and data retention terms.

## Planned next milestones
P1: animation driven by actual facial transformation matrices, avatar face calibrator and strict Morph Targets compatibility diagnosis.
P2: avatar model optimizer and GLB/VRM export with named rig channels, improved original parametric heads for varied character styles.
P3: conditional third-party or self-hosted GPU portrait-to-3D pipeline with consent and sample-driven validation. Single-image unseen depth requires estimated geometry and can't be asserted exact.
P4: one encoded video/audio pipeline into Agora/WebRTC, native Kotlin/Android parity, end-to-end broadcast and multi-user performance tests.

## Acceptance
Visit '/avatar-studio' in mobile Chrome, press 'تشغيل الكاميرا', grant camera, face the device and blink/open mouth. Select a rigged local GLB to preview expression retargeting. A viewer-side or native release is not ready.
