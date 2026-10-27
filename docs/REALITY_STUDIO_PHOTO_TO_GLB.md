# SpakTok Reality Studio — Image-to-3D reference authoring

2026-10-27: local PNG/JPEG/WebP photo import added to /reality-studio.

## User-requested workflow
1. Choose an original image: PNG, JPEG/JPG, or WebP. We inspect the actual file
   signature because some user-provided .png images contain JPEG bytes.
2. Studio displays original photo alongside a THREE.js preview with the
   468-point canonical MediaPipe reference mesh (true triangle geometry).
3. Adjust texture zoom, X/Y position and horizontal flip, toggle wireframe,
   inspect the preview from other angles, then export a standalone .glb.
4. The exported GLB includes textured canonical geometry. It is an honest
   PHOTO-PROJECTION REFERENCE: a 2D image supplies only frontal color/texture,
   not real scan geometry, independent side/back photo material, personalized
   craniofacial measurements, expression rigging, hair simulation or occlusion.
5. A separately generated user-owned GLB from the provided Apple OBJ +
   their third photo is available to the creator as a downloadable working
   artifact. This is not automatically distributed from our public repo.
6. To productionize, review licensing for sourced imagery, retarget face
   deformation from actual tracked landmarks and run real-device recording QA.

## Security & performance
- Image file size ≤12 MB, pixel resolution ≤16 MP; photo texture ≤1536 px.
- Image header sniffing recognizes JPEG/PNG/WebP independent of extension.
- No base64 photo data is inserted in public GitHub, no personal image is
  transmitted to Cloudflare, and imported image remains local to browser.
- GLB export is initiated explicitly by the creator.
- Both WebGL preview and image URLs are disposed on file replacement.
- Authored/ licensed 3D accessories are required for truly volumetric effects.

## Notes
The user also sent two stylized network illustrations. Those are references
for visual topology aesthetics, not 3D models, and contain visible provenance
watermarks. Do not remove those watermarks or distribute them as production
texture assets without rights.
