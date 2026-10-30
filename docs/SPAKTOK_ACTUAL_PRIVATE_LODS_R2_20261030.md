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

## A strict gltfpack topology gate is now in source (not yet run on production assets)

The CPU-only `services/forge-gpu/glb_topology.py` now audits actual
indexed triangle edges inside GLB binary chunks. It rejects unsupported
indices, external geometry, out-of-range vertex IDs, non-manifold edges
(>2 incident triangles per undirected edge), and degenerate index
triangles. The separate professional LOD builder
`services/forge-gpu/build_private_lods.py` now requires zero such
defects for the input and **every** generated LOD before atomically
revealing an output pack. It calls the official `gltfpack` with
`-slb` (lock mesh borders) and `-sv` (simplify with attribute
considerations), as well as the existing PBR preservation checks.
These options and counts are **not** a promise that the mesh will render
correctly: blind visual QA and mobile testing remain mandatory.

The Python test fixtures were replaced with genuine GLB binary index,
POSITION, UV, normal and embedded image views. Additional tests inject
three triangles sharing an edge to prove bad LODs are rejected without
leaving a partial pack. These tests are included in
`Forge GPU Contract Checks (no GPU)`; GitHub Actions jobs are currently
failing to start. There has been **no professional gltfpack run yet**
on the owner's actual GLB: the two earlier experimental LOD1/LOD2
remain present in private R2 but deliberately blocked.

## In-app private 3D viewer added to draft PR

The new client-only `components/spaktok/private-studio-glb-preview.tsx`
uses Three.js GLTFLoader and supports embedded `EXT_texture_webp`
textures, touch rotation, constrained automatic turntable, and a PBR ↔
Wireframe switch. It loads only the already-audited private `File`
in browser memory; it does NOT create public R2 URLs, trigger GPU,
claim automatic rigging or pass source images to services.

`SpaktokAIDirector` now displays this viewer once an owner imports a
validated GLB. For the known defective prototype LOD1/LOD2 hashes,
`createStudioFanoutManifest` and `assertStudioFanoutManifest`
both require `needs-optimization` and
`non_manifold_lod_requires_professional_retopology_and_visual_qa`.
The operator can still examine their local turntables and download
the GLB, but outbound buttons into the five Studios remain disabled
until a later verified, professionally simplified replacement is
produced. This is a **safety/QA boundary**, not proof that the current
prototype LOD meshes look correct.

The code is currently in the unmerged draft PR and has NOT been
verified in the published Preview app. Vercel latest READY deployment
still lags the latest branch head. Do not claim end-user availability.

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
