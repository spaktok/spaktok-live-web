# LUXA — Dense Image-Matched Face Mask Rig (27 October 2026)

## User request and product contract
The previous procedural LUXA demo looked like an unrelated cartoon head. The creator requires the **specific** supplied male/female editorial portraits to appear on a continuous facial mask while responding to the live user's tracked head pose, blink, mouth and expression. A pretty preview image is NOT a rigged mask.

## Working example assets delivered privately in this conversation
- `LUXA_Male_FaceMask.glb`: 10,810 front-surface vertices, 13,614 connected front triangles, 3,584 approximate back-volume triangles, embedded RGBA texture from the male reference image, and 7 named glTF Morph Targets.
- `LUXA_Female_FaceMask.glb`: 10,810 front-surface vertices, 13,092 connected front triangles, 3,584 approximate back-volume triangles, embedded RGBA texture from the female reference image, 7 named Morph Targets.
- Morph Targets: `jawOpen`, `eyeBlinkLeft`, `eyeBlinkRight`, `mouthSmileLeft`, `mouthSmileRight`, `browInnerUp`, `mouthPucker`.
- Both are real GLB 2.0 files with indexed geometry, position-delta morph targets, embedded cropped masks, and self-contained textures; loaded and structurally inspected with trimesh in the assistant workspace.
- The **actual source image files and built GLBs are NOT committed** to this public repo; their reuse/distribution rights were not confirmed. The creator can use the locally downloaded GLBs with the existing import UI.

## Workflow on main
1. Open `/avatar-studio` with browser Chrome HTTPS.
2. Under 'استيراد شخصية GLB احترافية', select either locally downloaded mask file.
3. Verify `Morph Targets: 7` and mapped channels. These masks can be previewed with camera off: use 'اختبار القناع الهندسي قبل الكاميرا' and enable manual animation, then adjust sliders for each face expression.
4. Disable manual animation, grant camera permission, and follow blink, smile, mouth open, brow and head yaw/pitch/roll on-device using MediaPipe. If detection fails, camera diagnostics and pose/expression tracking state explain why.
5. The GLB preview is **LOCAL ONLY**, not a public live stream. Actual sender tracks remain separate.

## Accurate claim boundaries
The 3D shape of the original reference portraits cannot be exactly reconstructed in depth or behind the head from a single source view. This first deliverable is a **photo-projected curved dense 2.5D frontal head mask** plus an estimated head-back volume, with manually approximated features and real vertex morph deltas. Frontal fidelity is preserved by the image texture. Strong side rotation, realistic inner mouth/teeth, unseen hair strands and realistic eyelid closure need a true 3D model/rig and multiple views.

Every mask is an image-referenced appearance, not the viewer's real identity. No beauty ranking or inference is performed. The input art assets and face measurements do not get uploaded by this browser feature.

## Follow-up before release
- Add user-controlled 3D mask authoring with front/left/right/back input, manual anchor authoring and export to a self-contained GLB.
- Replace estimated projection with artist-approved sculpted face meshes for both designs, UV/material layering, eyelids and socket interiors, realistic cornea/hair geometry and 52 ARKit morph targets (the current pair has 7).
- Calibrate GLTF morph target names, eye/mouth center anchors, facial pose matrix, on-device smoothing, loss-of-face fallback and mobile FPS.
- Actual Agora/WebRTC video/audio publisher and native Android transport, subject to camera/output capture QA.
- Public assets require explicit distribution permission; keep user-uploaded photo assets outside public GitHub history until permitted.
