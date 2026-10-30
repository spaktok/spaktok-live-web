# Spaktok Studio — verified source and deployment inventory (2026-10-30)

**Purpose:** separate demonstrated runtime deployment, code that has passed an
isolated test, and capabilities that have NOT been implemented or tested.
This document does not expose credentials, personal owner IDs or GLB media.

## Verified live account observations

| Surface | Evidence observed | What it DOES NOT prove |
| --- | --- | --- |
| GitHub `spaktok/spaktok-live-web` | Public repo; default `main`; PR #15 `feat/forge-vast-trellis2-adapter-20261029` remains draft/unmerged | Branch-only Forge features do not run in `main` |
| Cloudflare Workers | Existing: `spaktok-d1-bridge`, `spaktok-director-ai`, `spaktok-word-rodin`, `spaktok-private-studio-assets`, others | A Worker name does not prove live GPU generation or valid owner ticket signing |
| Signed owner-only GLB Worker | Exact expected name `spaktok-private-studio-asset` was NOT found in connected account | Private R2 to browser signed canary NOT validated |
| Cloudflare R2 | `spaktok-private-drafts` contains 5 test models in `studio/private/pilot-20261030/lods/` and `professional-candidates-v1/` plus private JSON reports | None are endorsed for paid gifts, public AR, real-time Avatar or production publishing |
| Runpod account | Read-only `list_pods` returned **0** Pods and `list_endpoints` returned **0** Serverless endpoints | Does not say anything about unrelated Vast.ai providers/accounts |
| Vercel env names | 39 env entries visible; preview branch has several `SPAKTOK_FORGE_GPU_*` names; production has `SPAKTOK_D1_BRIDGE_*` and `SPAKTOK_AUTH_PEPPER` names | A defined variable does not imply GPU model is online or configured correctly |
| Vercel owner-pilot config | Neither `SPAKTOK_STUDIO_PILOT_ENABLED`, `SPAKTOK_STUDIO_PILOT_OWNER_ID` nor dedicated `SPAKTOK_STUDIO_PILOT_SIGNING_KEY` appeared in the listed env names | The owner-only pilot cannot be called ready |
| Vercel deployments | Some older feature commits READY, latest feature HEAD received `Deployment rate limited — retry in 24 hours` | Latest PR commit not deployed, even when isolated Next build succeeds |
| Android | Neither `main` nor feature branch in THIS WEB repo contains `apps/native_android` | Native Android APK/FPS/thermal and camera/live behavior NOT tested here |
| Legacy Supabase | `@supabase/ssr` and `@supabase/supabase-js` still in `package.json` and legacy helper files `lib/supabase/client.ts`, `server.ts`, `proxy.ts`. No app/runtime import of these helpers found in grep, and legacy auth callback simply redirects. | Cloudflare-only dependency removal is not complete; absence of imports is not a comprehensive security audit |

### Real five GLB objects

All in `spaktok-private-drafts`, not public URLs:

| Key suffix | Bytes | Status |
| --- | ---: | --- |
| `lods/lod0.glb` | 5,343,540 | Owner-private TRELLIS.2 origin, no rig/live approval |
| `lods/lod1.glb` | 2,825,124 | Experimental LOD: indexed nonmanifold edges, reject production |
| `lods/lod2.glb` | 1,448,404 | Experimental LOD: indexed nonmanifold edges, reject production |
| `professional-candidates-v1/lod1-conservative.glb` | 5,087,128 | CPU gltfpack conservative, LOD target unmet and position-weld review needed |
| `professional-candidates-v1/lod2-conservative.glb` | 4,992,732 | CPU gltfpack conservative, LOD target unmet and position-weld review needed |

## Present in source (NOT proof of fully deployed Rodin-equivalent functionality)

- TRELLIS.2 model adapter `services/forge-gpu/trellis2_engine.py` and GPU
  ticketed FastAPI `server.py`.
- Unified *local private draft* creator `spaktok_studio_production.py`: a GLB
  or ONE explicitly approved local GPU inference, optional CPU gltfpack LODs,
  private manifests for five destinations, sparse four-view wireframes.
- `rodin_blind_benchmark.py` 20-case paired-image evidence protocol;
  20 real owner-approved cases and 100 actual ratings NOT yet collected.
- GLB PBR/UV, normals, edge-index and position-weld topology audits, plus
  private WebGL preview and browser handoff prototypes.
- Browser prototype face rig / morph targets; not an automatic anatomically
  validated full-body rig.
- Signed GLB Worker source and its 19 synthetic local Ed25519 tests.

**Explicit non-capabilities:** verified Rodin Gen-2.5 parity, automatic
multi-view fusion, semantic text-guided mesh editing, professional quad
retopology / normal baking, mobile live avatar AR tracking, 20-case blind
quality proof, public release approvals, and deployment to Android.

## Changes made after these runtime checks

1. Added a **dedicated** `SPAKTOK_STUDIO_PILOT_SIGNING_KEY` signer. The
   shared SQL `SPAKTOK_D1_BRIDGE_SIGNING_KEY` is no longer used to sign
   Studio GLB grants in the feature branch.
2. Studio ticket `GET` now returns a redacted, safe status and only reports
   server-side prerequisites; `workerVerified:false` remains true until a
   genuine Cloudflare signed-R2 canary occurs.
3. Browser disables the owner-only R2 import button when pilot prerequisites
   are absent and explains why in Arabic, rather than suggesting it works.
4. Five added signer security tests are included in the Next build test gate.

**Executed evidence (isolated Frankfurt CPU sandbox, commit
`0c371561ca3b387b4e78dd6c608e35d8aa83beeb`):**

- 111 / 111 Vitest JavaScript tests passed.
- 19 / 19 Node Ed25519/Worker contract tests passed.
- Next.js production build and its TypeScript phase passed.
- A real local HTTP GET to `/api/spaktok-studio/pilot-ticket`, with
  missing owner-pilot configuration, returned precisely
  `{enabled:false,reason:"pilot_operator_not_configured",workerVerified:false,private:true}`.
- The earlier branch was tested with 91/91 Python offline contracts; that
  suite is not a live paid-GPU/model-quality benchmark.

## Remaining safe activation gates (in sequence)

1. Decide and provision a distinct owner-preview Ed25519 key pair **in a
   secret manager**, plus actual owner ID, and deploy the exact isolated
   signed GLB Worker with its matching public key and private R2 binding.
   Never expose private key or personal owner ID in GitHub/chat.
2. Verify a real authenticated owner R2 fetch with negative cross-user,
   expired-token and wrong-origin cases, and re-check GLB SHA-256 client-side.
3. Provision an explicitly approved GPU provider (Runpod Pod/Serverless OR
   Vast) and verify measured TRELLIS.2 inference, PBR image outputs, runtime,
   cost and quality.
4. Compare multiple angles with Rodin on identical authorized inputs,
   inspect topology, UV seams and actual visual appearance, then improve
   rigging, AR, normal baking and low-poly meshes.
5. Validate the official Android app in its separate codebase and on real
   phones; only then approve limited distribution and consider merging PR #15.

**No real GPU was started, no production secrets copied, no private GLB
publicly published, and no PR merge was performed for this verification.**
