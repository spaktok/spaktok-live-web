# SpakTok Face Couture — 3D Makeup & Premium Accessories (2026-10-26)

## Delivered

Eight original 3D makeup looks: Soft, Glam, Bridal, Smoky, Rose, Neon, Golden, Editorial.

Seven independently controllable cosmetic areas: foundation, lipstick, eyeshadow, eyeliner, blush, contour and highlights.  Each look defines a translucent pigment palette, coverage and subtle directional shimmer. The cosmetic mesh shares the same 478 MediaPipe face positions and normals as the 3D depth occluder, so blush and lipstick follow the tracked face mesh rather than screen-space coordinates. CPU updates only per new inference; all seven zones composite in one GPU draw call. Native skin texture remains visible.

Premium geometry: detailed PBR glasses with curved lenses, hinges and nose pads; faceted gemstone crown; layered space visor with illuminated edge and earpieces; stitched fabric cap with curved brim. Existing original 3D crystal and expression presets remain available.

UI: Makeup 3D is the initial bottom-picker category, with cosmetic face thumbnails, global intensity, and a collapsible seven-zone opacity editor. The camera remains visible when the advanced slider editor is closed.

## Verification

- TypeScript typecheck completed without errors after the current feature set.
- Focused automated suite: 16 passing tests for geometric projection, semantic masks, cosmetic strength, model fidelity and catalog.
- Chromium + reference face photo + MediaPipe: 478 landmarks, 17,461 changed makeup pixels in the Three.js framebuffer; GL error code 0.
- Chromium + reference face: all six accessory/other presets load and render without GL errors.
- Check Vercel production deployment READY on the latest GitHub main commit before declaring publicly available.

## Limitations

These are genuine depth-tracked original 3D makeup looks, but they are not a fully color-calibrated cinematic beauty studio or the proprietary TikTok/CapCut/Snap filter libraries. More realism will require professional GLB assets with UV PBR texture maps, camera lighting estimation, mobile calibration, skin tone fairness testing, face occlusion around hair/hands, 3D eye/eyelash geometry, device latency benchmarks and multi-face support. Do not claim 60fps parity or production-tested mobile accuracy without objective benchmarks.