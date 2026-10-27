# SpakTok Live Personal Mesh Sculpt — Beta (2026-10-27)

## Goal
Make production-style, face-specific jaw/chin slimming, eye enlargement and nose narrowing for the person in LOCAL live camera preview. Reuse their MediaPipe 478-point triangulation and do not enforce universal face proportions.

## Implemented
1. Mesh deformation core: bounded individual vertex displacement based on the creator's cheek width, inter-eye spacing, nose, jaw and chin, all tracked on this live face. Each modified triangle defines an inverse UV sampling field (160x160 RGBA8) feathered at its edges. Pixel colors remain sourced from the person's own camera image.
2. Shared shaders: normal WebGL camera and integrated Three.js GPU2 both read the exact same displacement texture before the usual beauty, color, filter and video recording stages. Older generic facial morph/shape warps are bypassed when the personal mesh warp is active.
3. Live hook: reuse one existing FaceLandmarker inference. Invalid/old landmarks and folded triangles turn the warp off rather than rendering corrupt contours.
4. Creator controls: independent jaw, chin, eyes, nose sliders; positive opt-in and one-action global reset, with compare-to-original. Source video and landmarks remain on-device.
5. Unit regression tests for direction of each feature, clamped magnitudes, triangle field creation, mirrored camera-coordinate contract, invalid input.

## Limitations and QA
- This is a genuine per-triangle displacement map, not a biometric scan, a million-point measured head or complete image restoration.
- Face deformation is optional, and does not score beauty, infer ethnicity or apply a global face target.
- When the head turns far away, is covered by hair/hand, the camera loses tracking or the GPU fails, do not extrapolate a guessed face. Untouched video is the fallback.
- Camera Live is explicitly a local preview, NOT yet Agora/WebRTC streaming to remote viewers. Native Android integration is not complete.
- 1x/4x/16x previous QA mesh subdivision doesn't improve original camera details; the new inverse UV field needs far fewer sampled values than one million triangles.
- Test real Android/iOS devices, yaw/pitch/roll, wide smiles, low light, device heat, 30fps stability, captured video parity, GLB lens alignment, webcam mirroring and frame crop. Compile success alone does not certify aesthetic quality.
