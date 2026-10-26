# Royal crown: real three-dimensional model and tracked camera

**2026-10-26**: The existing fallback crown was shown because the listed
`spaktok-royal-couture.glb` file had never been committed. Generate and
commit the real GLB from `face3d-premium.ts`. Retain the source generator.

The native video and two transparent canvases share the SAME cover crop,
mirroring and dimensions. Removed the obsolete SVG foreignObject, SVG
sparkle sprites, and 2D sparkle painting from recorded video. Actual gems,
raised settings, metal filigree, physical materials, environment lighting
and the depth occluder are the only elements in the real crown effect.

Face tracking uses 478 MediaPipe landmarks and the forehead anchor (10);
a single stabilizer drives both the 3D mount and occluder. Crown geometry
is batched by material with welded duplicate vertices for GPU performance.

Photorealism still requires actual mobile tests, accurate hair segmentation,
physically calibrated scene lighting and texture maps. Browser tests alone
do not establish 99% fidelity or comparative performance superiority.
