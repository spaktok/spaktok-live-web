# SpakTok Reality Studio — Priority implementation status (2026-10-27)

## Overall
The requested multi-stage plan is **not completed end-to-end**.
This increment implements P0 preview logic and early editor/graph foundations,
preserves opt-in GPU2/hand QA, and defines release/rights gates. Competitive
parity with Lens Studio/Effect House is NOT claimed.

## P0 — First corrective vertical slice: live user's OWN face
- **Implemented:** `face-morph` catalog effect, with six bounded authoring
  controls (cheeks, jaw, chin, eyes, nose, lips) and strength.
- `reality-face-morph.ts` creates a bounded, deterministic sculpt config.
- The existing legacy full-frame WebGL shader now inverse-warps ORIGINAL
  camera pixels near face landmarks. No foreign photograph is sampled.
  The same GLSL is reused inside optional GPU2. Face pose and expression
  drive sampled regions in real time.
- The new effect requires FaceLandmarker but **does not** allocate the old
  3D face overlay. Photo-face is hidden from the catalogs. Legacy
  `3d-photo-face` render is neutralized so old routes do not paint a fake
  face on the user anymore. User-provided GLB is now a private authoring
  reference, not an automated identity-morph target.
- Its camera output stays in the regular WebGL recording/photo path because
  the execution plan no longer requests a separate 2D AR overlay.
- **Not yet solved:** geometry-aware target fitting from a different scan;
  true personalized 3D facial rig/ARAP/MLS deformation; optical flow and
  spatially accurate expression-preserving face morph to the external
  picture; iris/teeth/hair 3D reconstruction; physical depth; real mobile QA.

## P1 — GPU and tracking stabilization
- Existing GPU2 render pipeline remains opt-in via `?realityGpu=2`
  because mobile quality, power, color and recording parity are not proven.
- The new P0 morph uses the existing shared shader code for parity.
- **Not yet solved:** one always-on universal render graph, documented
  fallback/thermal profile, benchmark suite on physical Android+iOS.

## P2 — Creator Studio foundation
- **Implemented:** local Scene Hierarchy with typed object kinds; inspector
  for transform/enable; safe versioned `SpakTokRealityProject v2` export.
- **Not yet solved:** actual drag-drop scene parenting, shader graph
  previews, PBR authoring, rig editor, offline/cloud project sync or
  externally distributed plug-ins.

## P3 — Physically interactive accessories
- Earlier experimental hand pinch/grab/release and articulation hooks
  remain available in the camera QA path.
- **Not yet solved:** actual hand/finger-to-object collision physics, precise
  depth and hair segmentation, non-rigid bone/cloth solver or mobile parity.

## P4 — Visual scripting, timeline and AI authoring
- **Implemented:** safe typed graph links `event -> action`, bounded
  keyframe tracks, deterministic interpolation and JSON export. No arbitrary
  authored JavaScript, shader code, or outbound URL execution.
- **Not yet solved:** runtime wiring from face/hand events to exported scene,
  GPU VFX graph, GenAI asset creation with rights/provenance and budget
  management.

## P5 — Creator platform and release
- Existing owner-private Cloudflare R2/D1 stores a user's self-imported GLB.
- **Implemented in project contract:** authors cannot mark an unverified
  rights source as review-submitted. Export explicitly `published:false`.
  There is no client-side capability to approve/publicize effects.
- **Not yet solved:** official moderation/reviewer service, publishing
  pipeline, versioned public CDN, creator permissions/analytics, DSA/GDPR
  verification, model scanning and face-biometric privacy DPIA.

## Device QA acceptance
1. Default camera loads unchanged; `face-morph` selected explicitly.
2. User's original face remains and changes *shape*; no imported female
   photo/head ever covers them.
3. Blink, mouth open, rotation, rapid movement and temporary tracking loss:
   no stuck mask, no flipped warp and no unnatural tearing.
4. Preview photo, MediaRecorder capture and recorded upload show same
   morph at 720p; verify selfie orientation and gamma.
5. At least 30 stable FPS on target mid-range Android with no 2x memory
   or high thermal throttle; aim 60 FPS on supported faster hardware.
6. A photographer/creator can build/export a valid *draft* in studio;
   publishing requires verified rights and mobile benchmark sign-off.

## Explicit limitations
The original photo-textured GLB produced from a single stock portrait
contains a standard canonical face mesh. That cannot encode the woman's
unique 3D bone proportions, so it cannot be a correct morph target on its
own. To reach reference-driven shapes, we must add consented target
geometry/landmark correspondence, neutral-expression fitting, smooth
nonrigid deformation and UV-safe camera space image warping. In particular,
the present six-handle warp is a practical **first iteration**, not a fully
competitive nonrigid face solver.
