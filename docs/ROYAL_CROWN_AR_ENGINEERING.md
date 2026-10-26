# Royal crown: real three-dimensional model and tracked camera

**2026-10-26 verified:** The authored 3D crown GLB is generated automatically at build time by `scripts/build-couture-glb.mjs`; it is deliberately not checked in as a binary. The production GLB URL returned HTTP 200 (1,477,388 bytes). Chromium loaded the generated asset as `hd` and rendered 7,095 real 3D crown pixels using 478 facial landmarks. Thus GitHub source absence does *not* mean production lacks the asset.

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

The crown base is calibrated to the source GLB at y=-0.55 with regression-tested roll, yaw, pitch, and head translation. Production uses versioned URLs and week-long asset caching; the camera warns if the real model failed and a simpler fallback is displayed.
