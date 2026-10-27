# Reality Engine Phase 8 — Canonical Retarget + Experimental Pixel Mask (2026-10-27)

## Canonical retarget preparation
- Bundled MediaPipe's original 468-vertex canonical neutral OBJ from the
  Google AI Edge MediaPipe repository, with the upstream Apache-2.0 license
  preserved alongside the file. The model's neutral dimensions are reference
  *centimeters*; they are not measured biometric geometry of a user.
- `reality-canonical-retarget.ts` parses uploaded OBJ vertices, UV face
  references and polygon triangulation; generates a source-vertex → one
  canonical 468-vertex triangle + barycentric weights + neutral Z-offset.
  The map is computed **once at authoring time**, not every camera frame.
- Creator Studio `/reality-studio`: import the user's Apple sample
  ARFaceGeometry.obj locally and choose *Generate Retarget Map*. The model
  is not uploaded. The downloaded JSON contains correspondences and
  projection-error metrics. Never mistake its 1,220 synthesized output
  vertices for 1,220 independently tracked measurements.
- The two reference meshes have different topology/UV unwrap/neutral
  anatomy. An XY-normalized closest-triangle mapping is an APPROXIMATION.
  It preserves relative movement from MediaPipe landmarks but does not
  guarantee precise lip, eyelid and ear registration. Before production:
  semantic landmark alignment, anisotropic calibration, non-rigid
  deformation regularization and real-frame visual QC are required.
- We intentionally do not copy the user's Apple OBJ into the public GitHub
  repository. The sample license in the conversation requires copyright
  and license notices if the model is redistributed.

## Optional point-guided segmentation
- A dedicated on-device MediaPipe InteractiveSegmenter (MagicTouch, int8
  model v1) can segment pixels around a point prompted by tracked hand
  landmarks. THIS MODEL IS GENERAL OBJECT SEGMENTATION, NOT a dedicated
  hand recognition model. HandLandmarker still provides hand identity.
- Segmentation is activated only with ALL the opt-in flags:
  `?realityGpu=2&realityHands=1&realityHandOcclusion=1&realityHandSeg=1`
  and only after the hand has entered the grabbed state.
- The mask is CLIPPED to a modest bounding region around the observed 21
  joints, filtered by confidence, aged out after 680ms, and rejected if the
  hand moved too far. Failures fall back to the original 21-joint matte.
  No camera images or tracking data are sent to SpakTok's server.
- Max attempt rate ~1 per 1.5 seconds (not a true 30/60 fps hand matte).
  The official MagicTouch benchmark on Pixel 10 is approximately 208ms
  CPU / 581ms GPU. This QA-only CPU implementation can cause a frame
  stall, uses an external model download, and may not initialize with
  all mobile browsers due to WASM/GPU restrictions. DO NOT switch this
  on for all users without worker offloading/performance qualification.
- Accurate contact depth, finger-over/under geometry, 3D physics and
  self-occlusion remain open engineering challenges.

## Testing
- Pure retarget parser/map/deformation tests and semantic confidence
  clipping/freshness tests are in `reality-phase8.test.ts`.
- Source imports, test suite and TypeScript are checked independently in
  a Vercel sandbox before considering a release complete.
- Real device camera segmentation, model loading on Pixel/Samsung/iPhone,
  latency heat maps, gesture timing and recording parity have not been
  demonstrated by any unit test.
