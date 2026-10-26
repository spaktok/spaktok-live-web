# Reality Engine — Stage 1: Unified Preview/Capture Composition

Date: 2026-10-26

## Actual source changes
- Camera GPU color/beauty now renders even when a 2D or 3D face AR effect is active.
- The preview displays that GPU-graded camera behind the current face mask and Three.js overlay.
- One deterministic compositor draws the GPU-graded camera, 2D face AR, and 3D scene, in that order, for photos and live/video recording.
- If GPU rendering fails, recording and photos fall back to native video with the face effects still composited; a single failure does not terminate camera access.
- A centralized execution plan drives inference requirements and face-AR modes. Dedicated tests cover layering, fallback and feature combinations.

## Scope and limitations
This is output/pipeline *composition parity*, **not yet** one shared GPU/WebGL context. The camera shader and AR scene still use separate GPU contexts, and AR recording performs a 2D readback. This may limit performance on low-end phones. The next stage is a GPU render-graph migration (camera texture, PBR geometry, masks and output render targets in one device context), with feature-flag rollout and comparative mobile benchmarks. Do not claim 99% realism, 60 FPS, or competitor superiority without actual test data.

The AR scene is still single-face MediaPipe with forehead anchoring and does not yet have robust hair/hand occlusion. See FACE_COUTURE_3D_2026.md for existing functionality.

## Verify on device before calling production fully validated
1. Open camera; select crown; add contrast/beauty; compare preview to recorded video and captured photo.
2. Switch between selfie/rear cameras and all orientations; verify crop and mirroring.
3. Rotate/tilt head with glasses/crown; look for stale geometry and incorrect occlusion.
4. Check WebGL failure fallback, permissions denied and camera recovery.
5. Compare device temperatures, sustained FPS, recording stalls and memory on Android/iOS.
