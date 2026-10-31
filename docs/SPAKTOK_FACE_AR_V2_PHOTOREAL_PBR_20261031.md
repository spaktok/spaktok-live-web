# Spaktok Face AR V2 — camera-matched PBR pilot (2026-10-31)

## What ships

Two selectable LIVE-preview face-conforming filters:
- `3d-precision-cyber-mask`: titanium, high metallic reflectance with bounded GGX specular and clearcoat.
- `3d-photoreal-porcelain-mask`: ceramic/satin, low metalness, different roughness, coat and a *visual approximation* of subsurface softness.

Both use the exact current 478-point local MediaPipe mesh, existing face-depth occlusion, and the existing eyebrow/eye/lip/oval semantic feathering. Source data comes only from the user's own camera in memory. There is no identity replacement, face photo upload, added GPU cloud endpoint, or additional ML run.

### Static material coordinates and lighting

The 468 triangular face-surface UV pairs are derived once from the previously bundled public MediaPipe canonical OBJ. The ten iris points receive unused fallback UVs. The original source license is retained in `public/face-assets/MEDIAPIPE-CANONICAL-LICENSE.txt`.

An original deterministic 256×256 mipmapped microtexture is generated once per renderer and sampled in stable anatomical UV coordinates. Material shader uses simplified GGX microfacet reflectance, Fresnel, Smith visibility and a clearcoat lobe. This is **PBR-inspired realtime rendering**, not photographic texture capture, a calibrated HDR environment map, or a full BSSRDF skin model.

The existing 32×18 low-res camera light sampler updates the effect's ambient brightness, color temperature and lighting direction at most twice a second. It runs inside the browser in both GPU2 and legacy camera paths. Without camera access it falls back to fixed safe lighting.

### Verification

Unit tests cover stable UV coordinates, deterministic texture generation, mipmap configuration, shared live geometry, non-writing face-depth, two finish changes, bounded local light response, and effect manifest.
Run `bun run test`, `bun run build`.

### Real phone acceptance gate

On Android Chrome enable the camera, open `/live-studio-preview`, select **مجسمات 3D**, and switch between the titanium and porcelain masks. Rotate and lean head, open mouth and blink, then change from warm dim to cool bright light. Verify that details do not slide, that the eyes and lips remain visible, and that FPS and phone temperature are acceptable.

The server build and test suite do **not** prove actual photorealism, shader compatibility on every GPU, camera latency, or 30 FPS on target devices. Production-quality photorealism still needs professionally authored and licensed high-resolution albedo/normal/roughness materials, measured performance on target Android devices, and optional realistic environmental reflection/face-specific texture fitting.
