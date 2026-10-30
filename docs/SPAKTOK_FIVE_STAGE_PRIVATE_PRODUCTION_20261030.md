# Spaktok Studio / Forge — unified private production candidate (2026-10-30)

**Status:** code implemented on draft feature branch PR #15, NOT merged or publicly deployed.
This is a functional offline owner-controlled pipeline around the existing
Trellis.2 one-image GPU endpoint, CPU gltfpack quality gate and private
Spaktok Studio five-department manifests. It **does not establish parity with
Hyper3D Rodin Gen-2.5** and should never be advertised as an automatic
production-ready image-to-rigged-avatar service.

## One command on a creator-owned existing GLB (NO GPU, NO cloud upload)

```bash
cd services/forge-gpu
python3 spaktok_studio_production.py \
  --glb /private/owner-model.glb \
  --output /private/spaktok-owner-draft \
  --rights-confirmed
```

`/private/spaktok-owner-draft` must **not exist**. Source stays untouched.
An atomically committed private directory contains:

- `source.glb` exact original or **one** approved GPU result
- `manifest.json` with SHA256, geometry, PBR/UV/normal audit, index topology,
  position-weld topology warnings, optional actual triangle budgets and
  department status/remaining tasks
- `review-views/front.svg`, `back.svg`, `left.svg`, `right.svg`
  as **sparse orthographic wireframe review images**, never falsely labeled
  PBR or likeness judgments
- Optional `lods/lod0.glb`, `lod1.glb`, `lod2.glb`, `lods/pack.json`
  when **preinstalled** gltfpack produces quality-checked candidates
- Optional `rodin-comparison.json` for a same-reference pair

The five destination contracts: `avatar`, `live`, `filter`, `gift`, `world`.
Every destination remains `needs-optimization` and `published:false`.
No monetization, live camera permission or public URLs are granted.

## Exactly one operator-approved image-to-3D generation attempt

**This initiates a possibly paid GPU request. Never run it without active
owner-approved locally operating Forge GPU service, valid source rights and
understanding of GPU compute/data transfer costs. It does not boot GPUs or
download weights.** Default source uses the operator-only
`http://127.0.0.1:8000/v1/generate` with existing `FORGE_GPU_TOKEN`.

```bash
cd services/forge-gpu
export FORGE_GPU_TOKEN="<provide locally through a secret manager>"
python3 spaktok_studio_production.py \
  --image /private/reference-photo.png \
  --output /private/spaktok-private-from-photo \
  --rights-confirmed --permit-image-transfer --execute-gpu-once
```

No retry of a charged call; initial byte/dimension validation still depends
on the GPU service. No image bytes stored in `manifest.json`. Only the source
photo's SHA-256 and count are included, within the private bundle.

The source image remains outside the bundle and is never uploaded by this
postprocessing script. If GPU generation fails, the output directory is not
created. The client authorization and one-use replay guard of `server.py`
remain separate, with current trial-only limitations.

## Optional matched Rodin structural comparison

Add `--rodin /private/owner-rodin-same-image.glb --same-reference-confirmed`
to the GLB command. It reports file hashes, triangles, PBR and texture
structure separately, and always writes `winner:null`. Geometry and sizes
cannot prove visual or artistic superiority. Rodin access remains external
to this pipeline and **no Rodin API credentials are included**.

For independent blind quality evaluation:

```bash
cd services/forge-gpu
python3 rodin_blind_benchmark.py --create-template /private/rodin-study-20.json
# Owner fills 20 legally sourced same-image GLB pairs, real cost/latency,
# and 5 individual blind votes per case (no invented results).
python3 rodin_blind_benchmark.py \
  --audit /private/rodin-study-20.json \
  --output /private/rodin-evidence.json
```

The benchmark requires 20 paired rights-confirmed cases and 100 blind
ratings for a `readyForReview` status. It presents a 95% Wilson lower bound
as diagnostic evidence, but **never sets winner or public approval**.

## What each of the five Rodin-competitiveness tracks now contains

| Track | Now implemented/tested | NOT yet established |
| --- | --- | --- |
| 1. 3D inference | Existing TRELLIS.2 one-image engine, opt-in operator GPU bridge, one-use delivery; private unifying orchestrator | Repeated quality/reliability on user photos, 2–5-image fusion, arbitrary prompt editing, running 24/7 |
| 2. Geometry/PBR/LOD | GLB structural/PBR checks, positional seam evidence, UV area, gltfpack conservative retries, private wireframe review | Professional quad retopology, real normal-bake pipeline, image-aware PBR texture enhancement, mobile-grade low-detail meshes |
| 3. AI editor | Existing deterministic AI Director, target routing and downloaded QA reports | Text-guided anatomical/local 3D editing comparable with Rodin Bang |
| 4. Avatar & AR | Existing browser calibration/morph prototype and destination-specific blockers | Validated automatic rig, facial landmarks, production ARKit morphs, hardware camera-tracking and Agora sync |
| 5. Production automation | New atomic creator-private pipeline, explicit GPU approval, 5 destination manifests and 20-reference comparison harness | Authenticated generic owner-only R2 uploader for new packages, background job queue, retry/idempotency, browser GPU/CPU orchestration, approved public release |

## Verification and hard safety gates

The new orchestration/benchmark/wireframe modules are in the
`Forge GPU Contract Checks` GitHub PR workflow, **no GPU needed**.
The latest isolated tests using synthetic data should be inspected in CI
before merging. Actual owner-created R2 LODs were previously audited on the
connected Cloudflare account; THIS orchestration is not yet tested with
newly generated creator photo assets or an active GPU.

For now:

- Private drafts only; no public endpoint or irreversible transfer.
- No Runpod/Vast GPU instance started, paid inference or secret stored.
- CPU SVG previews are geometry sampling, not PBR material previews.
- Existing private Studio 360-degree WebGL viewer handles PBR rendering for
  files imported by the authorized owner; normal-bake, automated rigging and
  visual QA are still separate.
- The latest PR #15 remains draft and cannot be labeled production-ready.
- TRELLIS.2 can generate intentionally nonmanifold and open geometry; welded
  face-incidence flags must be interpreted with the asset's material seams,
  not blindly treated as holes.
- Some third-party dependencies have licenses distinct from the
  open-source TRELLIS.2 core; verify commercial model and rendering rights.

## Next must-pass operational checks

1. Authorize a **private** owner ticket end-to-end with a correctly
   deployed and verified signed Worker, without publishing GLB objects.
2. Run the orchestrator on actual newly generated owner-approved photo
   output; benchmark GPU runtime, errors, billed duration and PBR image bytes.
3. Inspect true rendered PBR screenshots across multiple views, including
   transparent geometry and seams, and validate quad retopology needs.
4. Calibrate and animate face morphs; test actual Android FPS/thermals,
   filters, avatar, gifts and world integration separately.
5. Complete 20 matched-reference Rodin study and only then consider
   quality claims or controlled limited release.
