# SpakTok Video Reality Studio — Stage 1 (2026-10-27)

## Purpose

Reality Studio now has a separate local-first recorded-video authoring workflow at `/video-studio`, linked from `/reality-studio`. It is for creating **3D models and motion effects for an existing video**, complementing (not replacing) SpakTok's live face-camera filters.

## Delivered

- Import a locally owned MP4/WebM or browser-supported MOV/M4V file, <= 250 MB and <= 120 seconds, without uploading video or frames.
- Preview video within a common Three.js WebGL canvas along with user-defined 3D models. Output aspect matches source; maximum long edge 1280px. The working video plane is an sRGB, unlit texture; model layer has lighting and material.
- Author original mesh primitives (cube, sphere, torus, cone, octahedron) with editable material color; import and inspect self-contained GLB meshes (<=15 MB and <=150,000 triangles, no external URI resources).
- Create and order up to 12 3D model layers. For each, author automatic timeline keyframes by positioning the video playhead and adjusting normalized XY, scale, XYZ Euler angles or opacity. Smoothstep interpolation uses exactly the same deterministic sampling in preview and capture.
- Export a standalone GLB for studio-created primitives and a safe versioned `SpakTokVideo3DProject` JSON draft. JSON only includes file names, scene settings and keyframes. Local binary file bytes must be reimported to reopen a project; there is not yet a JSON import UI.
- Optional, browser-dependent silent WebM capture from the composited Three.js canvas with `captureStream(30)` and MediaRecorder, when supported. Audio is intentionally **not** captured or forwarded at this stage.
- Safety contracts and unit coverage for timeline interpolation, duplicate keyframes, bounded edits, asset size, allowed file paths, imported GLB restrictions, and color/aspect dimensions.

## Explicit non-goals / caveats

- **No automatic 3D reconstruction from arbitrary footage** or automatic face/body/object motion tracking. Current 3D animation uses manual keyframes; users must track movement manually.
- **No promised MP4 with original audio**, speech sync, AV transcoding, reliable export from every browser, GPU/encoder stability or mobile native build. WebM output should be treated as a provisional capability until device QA.
- **No public sharing, publishing or Cloudflare upload**; private local authoring only. Imported models need creator rights before redistribution.
- Camera filters and recorded-video authoring remain separate engines for now, so live FaceLandmarker 3D face effects are not claimed to work in uploaded videos.
- No public deployment; changes are on a draft feature PR with review, typecheck, unit and hardware QA gates.

## Next phases

1. **Real video tracking:** Move landmark extraction and temporal face/body pose stabilization to an offline timeline worker. Track confidence/loss and support manual corrections. Respect browser GPU, battery and privacy.
2. **Creator geometry tools:** Parametric 3D text/extrusions, materials, procedural particles, PBR asset inspector, bone animation, multi-object hierarchy and attachment anchors.
3. **Composition pipeline:** Native platform camera/video integration, true pixel hair/person/hand segmentation and video depth/occlusion with color-matched shadows.
4. **Media export:** Frame-accurate synchronized video+audio MP4/H.264 on supported hardware or documented privacy-safe on-device media pipeline; progress/abort/resume and long-video memory controls.
5. **Common asset format:** Unify `RealityProject`, `Video3DProject` and camera live manifests, with versioning, rights checks and approved creator publication on Cloudflare R2/CDN.

## Manual QA checklist

- Import portrait 1080x1920 and landscape 1920x1080 MP4 and WebM. Verify frame crop, orientation, material contrast and no letterboxing.
- Create each primitive, rotate all axes and animate from center to left to right at distinct timestamps; scrub/play/record and compare transitions.
- Upload a valid embedded GLB. Attempt an invalid .glb, malformed header, missing geometry and GLB with external images. Reject unsafe inputs.
- Test video open and editor cleanup repeatedly, GPU memory stability, frame time and thermal throttle on desktop Chrome and physical Android browsers.
- Test WebM with and without MediaRecorder support, autoplay restrictions, end-of-recording, early stop, consistent playback length and expected silence.
