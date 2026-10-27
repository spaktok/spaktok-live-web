# SpakTok Reality — Live Local GLB Face Filter (2026-10-27)

## This is a live camera filter, not another static studio preview
- Camera now has a private local selector **تحميل وجه GLB وتحريكه على الكاميرا**.
- Select either user-uploaded `-Pngtree-...-canonical-preview.glb` variant
  or the previously fixed `1000033208-canonical-preview-fixed.glb`.
- The imported binary remains **on the user's device**. No Pngtree photo or
  unlicensed image is added to the public GitHub repo or Cloudflare R2.
- The filter is registered as `3d-photo-face` in the standard face catalog,
  so MediaPipe full-face inference, 3D preview, still capture and composite
  recording run on the existing camera path.
- The original textured GLB **UVs, triangle indexes and PBR texture** are
  retained; its neutral 468 position buffer is overridden per detected
  frame by the same stabilized 468 FaceLandmarker XYZ coordinates used for
  face depth/makeup. The overlay is animated with head rotation, face
  translation, eye closing and mouth movements of the tracked mesh.
- Robust validation verifies the 468 neutral source vertex IDs against the
  public MediaPipe neutral reference OBJ after scale/translation
  normalization. A different mesh with the same vertex count is rejected.
- GLB validation allows only self-contained images/buffers, 1 triangle mesh,
  embedded base color texture and ≤12 MB. The loaded model stays local.
- No face detected => photo mesh hidden, not frozen.
- Switching lens or removing the file leaves all standard filters intact.

## What this does NOT achieve yet
- The uploaded photograph is not a metric face scan or an expression rig.
- Tracking 468 vertices deforms the mesh geometry, but the 2D *photo texture*
  is still a painted frontal texture. A closed eye in the live face does not
  reconstruct realistic hidden eyelid content from an open-eye photo.
- Upper/head side/ears/hair in the GLB are not real scanned surfaces.
- Eye/mouth/lip alignment and depth require real-device QA with the *actual*
  GLBs. Some images with face beautification/watermarks may register poorly.
- Commercial redistribution of sourced Pngtree imagery may require a
  license. This experimental private photo filter must not be published
  as a public effect without verifying appropriate permissions.

## To try
1. Open SpakTok Camera, tap **تحميل وجه GLB وتحريكه على الكاميرا**.
2. Choose the actual GLB file on your phone (not a PNG).
3. Allow local validation, turn your face, smile, blink, open the mouth.
4. Use the normal camera shutter to take a photo or record a local video.
5. If the file fails canonical verification, return to Reality Studio
   and export using the genuine MediaPipe canonical 468 reference.
