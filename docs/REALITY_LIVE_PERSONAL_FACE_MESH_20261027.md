# SpakTok Live Reality — Per-Broadcast Participant Mesh, First Working Slice
Date: 2026-10-27

## Problem
The original Face3D engine creates one dynamic 478-point MediaPipe-triangulated occlusion face only while a 3D face effect is selected. The camera 'live' mode is a LOCAL preview, not an actual Agora/WebRTC broadcaster. Prior million-triangle support was only a virtual LOD budget, never a real geometry allocation.

## What this slice implements
1. Local live preview runs FaceLandmarker even if no 3D wearable is selected. The current participant's own 478 tracked points define a changing face mesh, not an imported model or universal beauty ideal.
2. From MediaPipe ordered face triangles, build real indexed geometry once. Subdivision levels 0/1/2 produce 1x/4x/16x source triangle counts. Adjacent face triangles share edge vertices, avoiding cracks.
3. Each fresh inference populates an XYZ Float32Array projected with the same Y-down cover-crop and one-selfie-mirror convention as the camera. Bad input or missing tracking clears the mesh, not reusing another participant's previous frame.
4. Adaptive subdivision is gated by measured preview FPS and device cores/memory. Start at level zero before a valid FPS sample; low devices remain at base, midrange reach level 1, faster devices may reach level 2.
5. Live preview shows actual vertex/triangle **buffer** counts and optional sampled wireframe using Canvas2D for QA. The wireframe does not become part of recording or the outgoing frame.
6. Existing color, skin, morph and other effects remain unchanged. Mesh generation by itself does not 'beautify' skin, enforce face geometry or fake camera detail. Creators must consent to any morphology changes.

## Acceptance and remaining limitations
- Geometry pure unit tests for counts, watertight shared edge reuse, projection, mirroring, invalid tracking and FPS downgrade are committed, not yet claimed to have run.
- No guarantee on-device FaceLandmarker, shader or recording stability until Android/iOS QA.
- New mesh is a real dynamic typed-array topology but NOT a GPU-drawn million-triangle surface, not a scan of pores/skull, and not yet a pixel-remapping algorithm.
- Existing live preview does NOT send streams to external viewers or Agora.
- There is no objective universal or international face beauty standard. Use natural illumination improvements; never force anatomy changes or whitening.

## Next
1. Reuse dynamic mesh in FaceMesh3DEngine for GPU depth, shadows and makeup so there is one tracking result per person and one shared compositing frame.
2. Controlled optical lens undistortion and appearance restoration, with reversibility and source-vs-modified image QA.
3. Connect an actual, tested audio/video live broadcaster on Agora or WebRTC, including viewer-side parity.
4. Add real FPS/GPU load/thermal telemetry before raising triangle density. Ultra dense LOD stays opt-in and should only be used if input information benefits from it.
