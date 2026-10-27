# SpakTok Studio — Production Director architecture and ownership
Date: 2026-10-27
Repository: spaktok/spaktok-live-web
Branch: main

## User goal
SpakTok Studio should be one creator workflow: authorized image → original/licensed design → 3D geometry and textures → ARKit-like face expressions and rig → anchor to the person's face/head/body in camera, recorded video and live → visual QA and governed publishing.

**Do not misrepresent any of these:**
1. Editing/recoloring/removing a watermark does not remove copyright or clear commercial licensing. Rights must be authorized before exporting/reviewing. A new design using general style guidance can be original but still needs an actual similarity/licensing review, not automatic magic legal clearance.
2. A single photograph projected onto the 468-vertex neutral MediaPipe canonical face is a front-textured 3D preview. It is NOT a reconstructed personalized 360° head, exact skin, side/back hair, or blendshape-ready live avatar.
3. A stored GLB may rotate with the user's head in Avatar Studio, while independent morph targets only animate if authored inside its geometry. Camera's private 478-point mesh and its 852/898 canonical triangles must not be confused with additional measured pixels/pores.
4. The current browser **live-preview** is a local video preview, not an Agora stream to public viewers. No claim of real on-air deployment parity.
5. A Vercel READY build checks compilation and types, not animation fidelity, privacy or frame-perfect mobile performance. GitHub Actions runners may fail before tests execute.

## Unified production data
- `lib/filter-engine/reality-production-pipeline.ts`: one versioned production contract for source, rights evidence, material/rig checks, mount anchors, preview destinations and QA. All packages are candidate-only; `published` always false. Moving to another source resets approval.
- `lib/filter-engine/reality-production-glb-audit.ts`: nonexecuting binary inspection of glTF 2/GLB: actual referenced geometry accessors and BIN chunk, triangle primitives, materials, UV, normals, PBR factors, morph target counts, skins/animations, embedded vs external resources, extensions. It does not parse arbitrary JavaScript or claim visual correctness; suspicious models cannot pass the technical gate.
- `lib/filter-engine/reality-local-asset-handoff.ts`: one creator-initiated IndexedDB local GLB handoff from browser to same-origin Avatar Studio (<=15MB, expires 24h); not encrypted at rest, not cross-device, not server upload. Clears after attempted handoff; public-sharing and device-user isolation remain separate concerns.
- `components/spaktok/reality-production-director.tsx`: production cockpit with eight steps, review warnings, rights selection, controlled anchors, audit results and no accidental auto-publishing.
- `components/spaktok/reality-creator-lab.tsx`: orchestrates source file selection, director and existing GLB/OBJ/PNG/JPEG/WebP inspectors, the previous project/event graph and the all-effects audit.
- `components/spaktok/reality-image-reference.tsx`: locally projects authorized source image onto canonical geometry, authorable PBR roughness, clearcoat and specular parameters, validated GLB export and one-click transfer into avatar preview. It MUST not claim true photogrammetry or full face expressions.
- `components/spaktok/reality-avatar-studio.tsx`: pulls transferred GLB when creator explicitly clicks import; tracked face drives head pose, supported Morph Targets drive individual expressions; rigs missing targets only rotate.
- `components/spaktok/reality-video3d-studio.tsx`: independent video compositor (currently no unified file transfer or live video-to-3D). Treat as a downstream preview requiring future parity.

## Production workflow and readiness checks
1. Source intake: accept images/OBJ/GLB, detect actual bytes and size; never trust extension alone.
2. Rights: author declares ownership or permitted license and reviews origin; keep metadata and review evidence; verify on server before any marketplace publication. No watermark-removal-as-rights-clearing.
3. Geometry: topology, UVs, normals, anchors, material channels and GLB binary must be structurally valid. For true human avatars, a trained multi-view/model/artist pipeline is still needed.
4. Materials: skin/hair/cornea/makeup physically-based channels; separate normal, roughness, metalness, specular, anisotropy, alpha and color-space checks, render QA under multiple lighting setups.
5. Rig: 52 ARKit-compatible shape channels or formally mapped equivalents, jaw/eye occlusion, blendshape conflict handling, neutral-rest pose, expression QA, hair/ears/teeth rig as needed.
6. Mount: same MediaPipe coordinate system and named head/face anchors for camera/live/video; body tracking or hand tracking cannot be asserted complete using face landmarks alone.
7. Device QA: real Android Chrome and native Android tests; 30fps sustained targets, GPU draw calls, thermals, memory, camera pause/resume, low light, sunglasses, strong yaw, multiple people, audio/video alignment.
8. Reviewed release: backend-signed creator rights review, moderation, Cloudflare private R2 public artifact promotion, immutable versions and revocation; current route produces no release.

## Backlog in strict implementation order
- P0: Stabilize the existing tracking and PBR/GLB authoring on physical phones, recover CI runners; validate camera portrait-video-crop and source UV coordinate conventions.
- P1: Shared `AssetLibrary` with audited license and immutable source/version, R2 private drafts, D1 ownership/review; permissioned collaboration and deletion.
- P2: Professional 3D model generation from portrait(s) via local/connected GPU retopology, depth estimate, multiview synthesis and normal/roughness texture baking. Must QA uncanny-valley mismatch and occluded surfaces; never advertise a generated guess as the true back of head.
- P3: Rig authoring with pre-configured brows/jaw/eyelids, named 52 target authoring in Blender or controlled model pipeline, expression sliders, visemes, user-authored export to GLB/VRM.
- P4: One compositing/render graph across camera, recorded video and real Agora/WebRTC live publisher; same asset version and mount calibration; avoid multiplying inferencers for stacked filters.
- P5: Creator marketplace, content/IP reporting and revocation, approved uploads, billing/licensing controls and testing.

## Ownership protocol
Work directly on `main` only when specifically authorized (already requested here), but do not claim success without a successful build, runnable tests and real-device QA. After every change record commit, deployment SHA and gaps. Never store user uploads or private identity-related references in public Git history. Use a private storage workflow with user consent for actual uploaded assets.
