# Spaktok Original High-Fidelity LIVE Filter Pack — 2026-10-31

## Installed in the LIVE selector

12 original authored PBR surface material looks, IDs `3d-premium-*`, packaged into the existing Spaktok web app. They share exactly one 478-point on-device Face Mesh tracker, existing face/eye/lip occlusion and a 256×256 mipmapped microdetail texture. They do not download external GLBs, reuse another app's protected filters, or transmit camera frames to Cloudflare.

Filter finish names: Platinum, Royal Gold, Rose Gold, Silk Pearl, Sapphire, Emerald, Ruby, Obsidian, Bronze, Opal, Champagne, Ice. All appearances are computed from original palettes and PBR shader code, not copied TikTok, Instagram or Snapchat filter artwork.

The effect catalog contains 72 face entries including the neutral effect. Some of the pre-existing wearables and overlays remain experimental and require separate device and rights QA; being present in the catalog is not a certification of visual quality.

## TikTok Effect House published reference ceilings (checked 2026-10-31)

- Effect package no more than **8 MB**.
- Image no more than **1025 KB** and **1024×1024** pixels.
- Recommended meshes **under 12,000 triangles** for smoother performance in constrained cases; broader maximums depend on model/animation.
- The Effect House tool's documented highest supported effect FPS is **30 FPS**.

Source: https://effecthouse.tiktok.com/learn/guides/getting-started/technical-guidelines/technical-optimization

These are **reference constraints**. The Spaktok platform cannot claim TikTok Effect House certification, visual equivalence, measured 30 FPS, legal rights to TikTok proprietary assets, or all effects existing on TikTok.

## Future externally sourced GLB downloads

An external asset must pass `reviewLiveFilterImport()` with original/verified commercial-use rights, verified attribution and source provenance, embedded GLB geometry, PBR/UV/normals, total package and texture bounds, and separate Android device review. The review result can only be `blocked` or `device-qa-required`; **never auto-publish**.

Khronos's glTF Sample Assets repository provides individual license records, but the assets are mostly test objects and not necessarily face-calibrated. Some are CC0; others CC BY or have trademark restrictions. Do not bulk-import them as production-ready LIVE filters without rights, fit and performance inspection.

Source: https://github.com/KhronosGroup/glTF-Sample-Assets

## Remaining acceptance

- Camera Chrome/Android target: compare FPS to baseline **19 FPS**, warm/dim and daylight environments.
- Verify proper eye/lip openings, yaw, pitch, roll and no texture waves.
- Visual review by the owner; no high-end-device certification from build tests.
- Future studio pipeline: licensed high-resolution albedo/normal/roughness with mobile LODs and per-effect cache, rather than loading every asset at start.
