# Spaktok — actual private gltfpack 1.3 LOD retry, CPU-only (2026-10-30)

Status: **real execution completed; private QA candidates only, NOT production-ready**.

## Reproducible source

- Cloudflare bucket: `spaktok-private-drafts` (private)
- Original key: `studio/private/pilot-20261030/lods/lod0.glb`
- Source SHA-256: `33be391ce222f90d00316b26b5ff6c3f21b30f230122d8e87f94b26992f619aa`
- Source: 5,343,540 bytes, 117,887 indexed triangles.
- Tool: official `zeux/meshoptimizer` release **gltfpack v1.3** (2026-09-25), using a short-lived CPU-only Vercel sandbox in Frankfurt (`fra1`). **No GPU rental/inference**.
- Offline repository QA: **24/24 Python unit tests passed**, covering technical GLB comparator, topology, UV area, and multi-LOD contracts.

## What actually happened

The repository's existing default `build_private_lods.py` attempt (`-si 0.50`, `-si 0.20`, `-noq -kn -km -ke -slb -sv`) **rejected the real source's simplified LOD** with `lod_topology_nonmanifold_or_degenerate` and left **no partial output pack**.

A controlled offline sweep of professional gltfpack settings showed that aggressive simplification introduces index non-manifold edges even with locked borders. For example:

| Command variation | Observed triangle count | Index non-manifold edges | Status |
|---|---:|---:|---|
| `-si 0.50` (default error) | 58,940 | 8 | rejected |
| `-si 0.80` (default error) | 94,308 | 3 | rejected |
| `-si 0.95` (default error) | 111,992 | 0 | topology passes |
| `-si 0.50 -se 0.0014` | 109,406 | 0 | candidate LOD1 |
| `-si 0.50 -se 0.00165` | 106,428 | 0 | candidate LOD2 |
| `-si 0.20 -se 0.0023` | 95,878 | 1 | rejected |

All commands also used `-noq -kn -km -ke -slb -sv` unless otherwise noted. `-se` caps simplification error, which can prevent the requested triangle ratio from being reached. The two passing files are **NOT** 50% and 20% triangle-count LODs.

## Files actually uploaded to private R2 and independently verified

New isolated prefix:

`studio/private/pilot-20261030/professional-candidates-v1/`

| File | Bytes | Triangles | SHA-256 |
| --- | ---: | ---: | --- |
| `lod1-conservative.glb` | 5,087,128 | 109,406 | `765011185736c0d2f53e9252b51346b10f4107d3128934ccbbbee7b1f9cd3bbd` |
| `lod2-conservative.glb` | 4,992,732 | 106,428 | `6b434a87299c2ad653efe10969cffb11b14c9608fb5574eb40b0228d2444ca23` |
| `pack.json` | 1,999 | — | `2eb0ac149c194b7fa7520f8069ba0cc1fa25a1559f7e490c28c37b5cf0a489c1` |

Both GLBs were re-read from R2 independently and matched their exact expected sizes and SHA-256. `pack.json` was read back as JSON and its version, exact file hash references and `productionReleaseApproved:false` were confirmed; its upload-time SHA-256 is recorded above.

### Technical comparison (CPU structural, not visual)

| Metric | Original LOD0 | LOD1 conservative | LOD2 conservative |
| --- | ---: | ---: | ---: |
| Indexed triangles | 117,887 | 109,406 (−7.19%) | 106,428 (−9.72%) |
| Bytes | 5,343,540 | 5,087,128 (−4.80%) | 4,992,732 (−6.57%) |
| Index non-manifold edges | 0 | 0 | 0 |
| Degenerate index triangles | 0 | 0 | 0 |
| Index boundary edges | 80,771 | 79,644 | 78,972 |
| UV-collapsed triangles | 6 | 3 | 2 |
| 3D triangle surface area sum | 6.407537 | 6.406988 (−0.00857%) | 6.407081 (−0.00712%) |
| Original embedded WebP images | 2 | both byte-identical | both byte-identical |
| PBR materials | 1 | 1 | 1 |
| Visual / Android FPS QA | unverified | unverified | unverified |

**Caution:** Zero non-manifold *index* edges does not imply the geometry is watertight or clean after vertex welding; high boundary-edge counts remain. Unchanged WebP bytes do not establish UV-seam-free appearance. Summed triangle areas do not establish surface-to-surface geometric fidelity. These passes do not establish rigging, AR tracking, animated gifts, iOS/Android performance, or public-release suitability.

The experimental R2 LOD1/LOD2 files in `studio/private/pilot-20261030/lods/` remain unchanged, known-defective and blocked from distribution. The new candidate files are **not wired to the public app**.

## Security/cost cleanup

- Access to the original R2 GLB was granted briefly through an authenticated, read-only, single-object temporary Worker.
- The Worker was switched to an authenticated, SHA256/size-allowlisted uploader for only the three new private object keys, rejecting overwrites.
- After upload and verification, the Worker subdomain was disabled and the **temporary Worker deleted successfully**.
- The temporary Vercel CPU sandbox was **stopped**, with nonpersistent storage. No lingering serving route.
- This work initiated no paid GPU job. Vercel CPU and Cloudflare request/storage usage may contribute to the account's bill; no zero-charge claim is made.
- No source artwork, generated GLB, signed transfer credentials or secrets are placed in public GitHub.

## Next gates

1. Do **not** label these as low-cost Live/AR LODs or activate `SPAKTOK_FORGE_GPU_ENABLED`, `SPAKTOK_FORGE_GPU_DIRECT_ENABLED` or public publication.
2. Perform private turntable rendering from at least four angles (both PBR and wireframe) and seam inspection against original; check texture mapping and shape changes, not only byte hashes.
3. Investigate topological defects created by aggressive simplification and consider component-aware retopology/mesh-splitting with explicit welded-position diagnostics (never merely duplicate indices to mask defects).
4. Build truthful LOD registry metadata from actual SHA-256, sizes and **achieved** triangle counts; keep conservative candidates marked `needs-optimization` until the target reduction and visual QA pass.
5. Verify signed owner-only R2 import, WebGL/Android FPS and thermals before any feature-flag change or PR merge.


## Verified automated conservative replay — actual private source (2026-10-30)

This follow-up was **executed**, not merely proposed.

- Added opt-in `--conservative` to `services/forge-gpu/build_private_lods.py`.
- Repeatedly runs real `gltfpack v1.3` with bounded `-se` caps per LOD, testing every GLB for triangle ordering, index-manifold edges, UV, normals, PBR, and existing material slots before accepting one.
- An unsafe attempt is discarded from scratch before retrying. A fully failed pack never becomes visible.
- Every variant records `requestedTriangleRatio`, `achievedTriangleRatio`, `triangleTargetMet`, `maxSimplificationErrorUsed`, and sanitized `optimizationAttempts`.
- The package records `triangleTargetsMet:false`, `needsOptimization:true`, `published:false`, `review.automaticDistributionBlocked:true`, `review.requiresVisualReview:true`, and **empty** `privateStudioRecommendations` if target ratios are not reached.
- Fresh EU Frankfurt `fra1` CPU-only sandbox cloned exact GitHub commit `9a9ab3f6d35c1a322960c10d506d61626cd1e83e`; **27/27 Python contract tests passed**, including 3 new conservative tests.
- The actual owner-private `lod0.glb` was fetched with temporary 120-second authenticated, single-object, read-only Worker, and its SHA-256 verified before running the new CLI.
- **Real command succeeded:** `build_private_lods.py --source /vercel/source-private.glb --output /vercel/conservative-pack --gltfpack /vercel/gltfpack-bin/gltfpack --conservative`.
- Reproduced the **same exact SHA-256 files** as saved earlier:
  - LOD1: 109,406 triangles, 5,087,128 bytes, `765011185736c0d2f53e9252b51346b10f4107d3128934ccbbbee7b1f9cd3bbd` (accepted cap `0.0014`, 1 attempt).
  - LOD2: 106,428 triangles, 4,992,732 bytes, `6b434a87299c2ad653efe10969cffb11b14c9608fb5574eb40b0228d2444ca23` (accepted cap `0.00165`, 6 attempts).
- Real `pack.json` explicitly reported `triangleTargetsMet:false` and `needsOptimization:true`.
- **The temporary Worker subdomain was disabled and Worker was deleted; sandbox session was stopped.** No new GPU job, no public GLB exposure or credentials in GitHub.

## Draft Studio integration — gated and unmerged

The separate preview-only registry `lib/filter-engine/spaktok-first-gpu-lods.ts` now has five SHA-256-pinned entries: original LOD0, two previous **defective** clustering prototypes LOD1/LOD2, and professionally simplified but **budget-unmet** `lod1c`/`lod2c`. Unknown drift/UV area comparisons remain `null`, not fabricated zeros.

The existing operator-only pilot signing route and read-only R2 Worker **source** now recognize exact `lod1c`/`lod2c` object keys and byte sizes. The Spaktok AI UI labels their measured status, performs byte-length+SHA-256 checks, and can load their private turntable viewer **once a properly authenticated signed Worker pilot is actually deployed**.

`spaktok-studio-fanout.ts` independently recognizes those candidate file hashes. Regardless of caller flags, all five private handoffs stay `needs-optimization` with `conservative_lod_triangle_budget_unmet_requires_qa`, and the manifest validator rejects forged ready states. Existing prototype LODs remain blocked as non-manifold. Unit tests reproduce both failure categories.

**This is not an active released feature.** The owner-pilot Worker remains undeployed and the signing/auth Preview configuration is not verified; no feature flags or public routes enabled. A successful full Vercel build and authenticated owner-only signed read canary must precede any limited pilot. Visual turntables on real Android/WebGL, UV seams, welded-position topology, rights and FPS still require testing.


## Isolated full web-app build verification (2026-10-30)

A short-lived Vercel CPU sandbox in `fra1` cloned exact code commit
`e2101ee924b0e3e35bde4d14df715aeb19da260f`, installed the pinned
Bun dependencies, ran `bun run test:word:gate` and ran a full
`next build` with Google Fonts network access allowed.

- **105/105 JavaScript Vitest cases passed** in 21 test files.
- **Next.js 16.0.10 compiled successfully**, completed its app TypeScript check,
  and generated all 20 static pages; the route table included
  `/spaktok-word`, `/spaktok-world`, and
  `/api/spaktok-studio/pilot-ticket`.
- An additional repository-wide `tsc --noEmit` was **not clean** because of
  preexisting strict-type errors in separate test-only files
  (`spaktok-glb-topology-audit.test.ts`,
  `spaktok-word-face-rig.test.ts` and `spaktok-word-rig-qa.test.ts`).
  Do not claim all repository TypeScript checks are green.
- The first standalone build attempt failed because the sandbox network
  policy disallowed Google's Cairo font host. Restricting network access to
  `fonts.googleapis.com` / `fonts.gstatic.com` then yielded a successful
  full Next build **without changing the application code**.
- The sandbox was stopped successfully after testing.
- **The exact pilot read Worker named `spaktok-private-studio-asset` is not
  currently in the connected account's Worker script list.** A differently
  named `spaktok-private-studio-assets` Worker exists; it is not evidence
  that this signed pilot route is deployed or working.
- The latest Vercel Git-linked deployment for this exact branch head was not
  available when checked. The isolated build is proof of buildability, not a
  live Preview rollout.

All feature flags and public GLB publication remain OFF; PR #15 stays draft.
Authenticated Ed25519 owner-ticket canaries, visual QA and Android hardware
tests still gate any release.
