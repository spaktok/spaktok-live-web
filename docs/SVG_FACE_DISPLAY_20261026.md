# SpakTok SVG viewer surface — 26 October 2026

The visible live-effects presentation is now an **SVG root element**:
- Native selfie camera remains a separate live HTML video behind the SVG.
- The existing MediaPipe-tracked 2D effect canvas and the THREE.js
  transparent WebGL 3D/makeup canvas render *inside* SVG `foreignObject`.
- Crown sparkle accents are actual vector SVG paths anchored to live
  face landmarks in screen space; we mirror horizontal alignment once.
- The same light accents are drawn by the capture compositor into
  JPEG/recorded video alongside the physically based 3D canvas.
- When no face is detected, only the SVG vector accent group is hidden;
  the camera stays live and the 3D engine continues to protect stale poses.

### An essential distinction
The outer visible layer is SVG, but **the photo-realistic crown, reflective
gemstones, 3D makeup and depth occlusion are still WebGL/THREE raster
pixels embedded in that SVG**, not native SVG vector paths. Exporting
the complete crown as *pure SVG paths* would not preserve real-time
perspective, physical materials, depth buffer or glass refraction.
The preview composites to JPEG / MP4/WebM, not a standalone SVG image.

SVG `foreignObject` supports HTML Canvas children on mainstream modern
browser engines; physical mobile-device tests are required, especially
older Safari and embedded in-app browsers. Don't claim 99% realism or
superior frame rate until measured with real faces on supported devices.
