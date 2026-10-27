# SpakTok Reality Engine Phase 7 — Render Graph, Hand-Foreground Compositor, Canonical OBJ Inspector

Date: 2026-10-27. Feature-gated hardware QA. No Cloudflare database/storage mutations.

## What changed
1. `reality-render-graph.ts` defines strict, dependency-checked stages:
   camera → beauty/color → face depth → 3D objects → hand foreground → output.
   This is a portable execution *contract*. The Three.js runtime currently
   uses the plan for the final optional hand-composition decision; face
   depth/AR objects remain inside the existing Three.js scene. It is
   NOT yet a fully user-editable effect-graph editor.
2. `reality-hand-matte.ts` builds a low-resolution hand **approximation**
   on-device from the Hand Landmarker 21-joint geometry. It draws a conservative
   palm and five finger chains to a CanvasTexture, uploaded only on new hand
   detections.
3. `reality-gpu-blend.ts` now combines its normal PBR effect mix with an
   optional hand alpha mask, selectively restoring the camera frame above
   the object where the hand is estimated to be in front.
4. `face3d.ts` uses these operations only when a 3D wearable is *grabbed*
   and `?realityGpu=2&realityHands=1&realityHandOcclusion=1` are present.
   Legacy effects and standard production recording remain unchanged.
5. `/reality-studio` can inspect a LOCAL .obj reference model as well as GLB.
   OBJ files cannot be exported as production-ready effect packages until
   converted to glTF/GLB and rigged. Nothing is uploaded to SpakTok.

## Apple sample and canonical reference
The user-provided Apple ARFaceGeometry.obj is a **STATIC** OBJ template with
1,220 vertex positions, 1,220 UV entries and 1,152 quad polygons; triangulation
would produce 2,304 triangles. It does not contain a live ARKit face anchor,
metric calibration, blendshape retarget correspondences, hand segmentation,
texture maps or PBR materials. This phase enables local visual inspection and
UV/topology diagnostics; **it does not assume direct vertex identity** with
MediaPipe's 478 tracked landmark output.
The attached Apple license grants broad use and requires preserving its
copyright and license notices with any distributed copies. We do not add
the supplied OBJ itself to the public repository in this phase.

## Accuracy and occlusion caveats
HandLandmarker provides joints, not per-pixel hand segmentation. The new
mask is conservative skeleton-based foreground matte. It cannot guarantee
precise finger edges, front/back order at the grip, or full 3D hand/object
contact. Real TikTok-like hand segmentation requires an independently
validated hand pixel-mask model (or camera depth) with measured latencies.
The sampled camera pixels stay on-device. Two full-size GPU color targets are
allocated while this opt-in compositing mode operates; power/GPU cost can
rise and needs mobile device profiling.
The face mesh and 3D wearable have no new unverified absolute depth claims.

## QA instructions
- Normal behavior: camera, choose a 3D lens; no URL flag needed.
- Tracking/physics QA: `?realityHands=1`. Pinch for two ML frames near glasses,
  move, tilt, open fingers. Verify no sudden effect cancellation.
- Compositor QA: `?realityGpu=2&realityHands=1&realityHandOcclusion=1`.
  Only after grabbing, photographed hand regions are reconstructed in front
  of AR from the video. Compare skin colors and visible finger boundaries.
- OBJ QA: open `/reality-studio`, import provided ARFaceGeometry.obj locally.
  Inspect wireframe and polygons; no server upload or auto-retargeting.
- Test mobile Chrome and Safari for camera orientation, layer color parity,
  frame pacing, recording parity, lost tracking, and arm/glasses occlusion.

## Next milestone: true hand segmentation and authoring
Obtain a verifiable, license-compatible **per-pixel hand segmentation model**
and integrate it into the same mask texture contract. Use temporal smoothing,
motion boundaries, depth/confidence, and occlusion tests with hand/glasses
recordings. Add actual canonical-to-MediaPipe correspondence authoring rather
than pretending these incompatible mesh index schemes match.
