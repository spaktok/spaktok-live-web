# SpakTok Reality Engine — Effect Manifest, Runtime, Face Anchors

Date: 2026-10-27 | Phase: universal registry + runtime integration

## An effect is not a sticker
The registry in `reality-effect-manifest.ts` is versioned and includes all current
face filters, tracked 3D wearables, 3D makeup styles, color presets, post-FX and
background modes. Each entry declares a category, rendering technology, quality
provenance, tracking requirements, 3D pivot, asset, occlusion mode and expression
bindings where supported.

A **real, detailed 3D effect requires a model file** (GLB/glTF) authored with
actual geometry, correct UV, PBR textures and physical dimensions. No code can
convert a lone icon into production-photoreal geometry by itself.

## What is actually authored today?
- `3d-gold-crown`: owner's mobile GLB, custom band calibration. Real imported geometry.
- `3d-crystal`: existing first-party GLB. Imported geometry; production visual fidelity not benchmarked.
- Other 3D wearables: flagged `procedural-preview`; **NOT yet approved as photoreal**.
- Eight 3D makeup looks: tracked face-surface shader, **not imported volume meshes**.
- 2D masks, color looks, background and post-FX: shader or canvas effects.

## New runtime
`reality-effect-runtime.ts` loads the author-approved local GLB from the manifest,
applies its declared calibration and invokes a safe existing fallback if loading
or calibration fails. A malformed file cannot inject an external executable
shader or remote object URL. No user camera frames or face landmarks are uploaded
to this registry.

## Facial anchors and motion
`reality-effect-anchors.ts` resolves named anchors with tracked MediaPipe
landmarks: forehead, eyes, temples, nose, jaw, lips, chin, approximate ear/head
positions. It uses object-fit:cover and one selfie-X mirror, then repositions
the mesh's authored local anchor point through yaw, pitch, roll, translation
and head-width scaling. The generic solver is regression tested against the
original crown placement.

**Limitations:** Face Mesh does not measure exact ear or hair/scalp surfaces.
Hand/hair occlusion and reliable head-side attachments require segmentation
and/or additional detectors. 6DoF pose is estimated and the head model has
not been calibrated metrically for every device.

## Onboarding a truly photoreal new effect
1. Model and texture the object in a 3D authoring package (correct thickness,
   UVs, normals, physically meaningful PBR maps and material properties).
2. Export a GLB with known pivot/axis and target dimensions. Bake or optimize
   geometry, generate device quality variants, and test material transmission.
3. Publish to first-party, immutable HTTPS/CDN asset path (`/face-assets/*.glb`
   today). External URLs and path traversal are rejected.
4. Add a manifest entry with anchor, source provenance, occlusion,
   calibration, expression bindings and supported quality profile.
5. Validate against face pose, mirror, real-device video capture, FPS, render
   budget, heat and front/back visibility before promoting the asset to HD.
6. Keep a clearly labeled fallback and do not misrepresent a geometric preview.

## Compatibility
Existing filter IDs and frontend catalog are unchanged. GPU v2 remains an
explicit QA mode (`?realityGpu=2`). Cloudflare assets/R2 publishing remains
future integration; this change does not modify live D1/R2 data.
