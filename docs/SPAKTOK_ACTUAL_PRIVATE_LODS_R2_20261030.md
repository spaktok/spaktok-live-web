# Real Spaktok R2 private LOD files — produced and independently verified

Date: 2026-10-30. Owner approved action to produce LODs from the first
already-generated TRELLIS.2 asset. **No Vast GPU inference occurred.**

Account: Spaktok Cloudflare. Bucket: `spaktok-private-drafts`.
Prefix: `studio/private/pilot-20261030/lods/`.

| object | bytes | triangles | vertices | SHA256 |
| --- | ---: | ---: | ---: | --- |
| `lod0.glb` | 5,343,540 | 117,887 | 105,337 | `33be391ce222f90d00316b26b5ff6c3f21b30f230122d8e87f94b26992f619aa` |
| `lod1.glb` | 2,825,124 | 54,132 | 50,544 | `3c0cb4c850450dd60195639199ec96f1260303cf7f4cf9272ff879e5d9b2ed8b` |
| `lod2.glb` | 1,448,404 | 18,651 | 20,826 | `bfadca41f907c577be9de6590f07cf95ff6f2e17c56ce518fd008e0cbd8c8742` |

Manifest is **actually present** at
`studio/private/pilot-20261030/lods/pack.json`.
Post-upload GET and SHA-256 verification succeeded on all GLBs.
Each GLB passed structural header / geometry count / PBR embedded WebP
presence and byte-for-byte original WebP image retention checks.

## Additional topology audit (performed after creating the assets)

The Cloudflare R2 file hashes were reverified. A second pass counted
undirected triangle edge incidence across each actual GLB:

| Variant | Boundary edges | Non-manifold edges (incident to >2 faces) |
| --- | ---: | ---: |
| LOD0 (source) | 80,771 | 0 |
| LOD1 (prototype clustering) | 42,048 | **825** |
| LOD2 (prototype clustering) | 19,627 | **400** |

These edges confirm the experimental simplifier introduced geometry defects.
The Cloudflare R2 `pack.json` was updated with these exact values and
`requiresProfessionalRetopology: true`. The Spaktok AI import now
forces **needs-optimization** across ALL five private Studio targets for
LOD1/LOD2. No downstream system may call these live-ready assets.
Remediation: run real gltfpack/meshoptimizer or rig-aware retopology on
authorized hardware, then repeat structural, PBR, edge and visual checks
before replacing versions. Retain the originals until successful.

## Technique and limitations — do not misrepresent as gltfpack

The remote-generated LOD1/LOD2 came from the repository's private
`services/forge-gpu/private_spatial_uv_lod_operator.js` prototype,
operated by an explicitly authorized Cloudflare account connection.
It uses 3D/UV spatial clusters, discards collapsed/inverted/duplicate
faces and re-compacts POSITION/TEXCOORD_0/NORMAL/indices while
retaining both embedded original WebP PBR images. Its approach can
introduce topology seams, shading issues and UV distortions.
This is **not** a meshoptimizer/QEM-grade simplification and has
**not** passed Blender/Three.js visual review. Do not say these are
production/AR/live-ready. The separate `build_private_lods.py`
gltfpack tool remains unrun; it is a separate alternative that requires
the installed native gltfpack executable.

The variants are private preview assets only. No rigging/ARKit morphs,
mesh skinning, live tracking, gift animation, collision, Android FPS,
thermals or multi-view fidelity have been validated. The files were not
published to consumers.

## Integration under PR #15 (draft / not deployed)

- `lib/filter-engine/spaktok-first-gpu-lods.ts` pins the verified keys,
  SHA256, bytes and triangle counts for 3 selectable private versions.
- `cloudflare/workers/spaktok-private-studio-asset.mjs` adds owner-signed
  exact `/v1/pilot/lod0.glb`, `lod1.glb`, `lod2.glb` reads against a
  read-only R2 binding; the server must configure exact HTTPS origin and
  Ed25519 verification public key.
- `app/api/spaktok-studio/pilot-ticket/route.ts` validates the logged-in
  native account and a pinned `SPAKTOK_STUDIO_PILOT_OWNER_ID`, and signs
  one exact LOD read for 60 seconds.
- `components/spaktok/spaktok-ai-director.tsx` offers a private LOD
  dropdown and one-click import, verifies the exact SHA-256 after download,
  and saves a 24h local preview bundle for selected studio sections.
- Registry unit tests are bound to the Vercel build gate.

**Do not call the UI integration live yet**. The separate signed LOD read
Worker is not yet deployed, Preview native auth D1 secrets are not yet
configured, the latest PR commit is not the latest Vercel READY preview,
and GitHub Actions jobs are not running.
Avoid copying production D1/auth secrets to an unreviewed Preview.
No unauthenticated public R2 URL should be created.

To complete the owner-only UI acceptance:
1. Repair Preview auth safely with separate access and migrations;
   review the PR and bring tests green.
2. Deploy the dedicated read-only Worker using exact existing bucket
   binding, a verified sign/verify Ed25519 pair, and one exact Spaktok
   HTTPS origin. Test unsigned and wrong-user GET both fail.
3. Deploy the reviewed Preview branch; sign in as authorized pilot owner.
4. Select LOD1 in Spaktok AI, download by signed ticket, verify
   2,825,124 bytes and SHA-256, inspect render and open the five
   private Studio previews. Repeat LOD2/LOD0 if visual QA warrants.
5. Prior to public release perform face rigging, UV/shading/blender
   turntable inspection, Android hardware FPS, rights, and content QA.

No fresh GPU rental is required for selecting precomputed LODs.
