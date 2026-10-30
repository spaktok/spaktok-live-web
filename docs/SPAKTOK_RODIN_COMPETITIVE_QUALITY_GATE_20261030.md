# Spaktok AI vs Rodin — measurable quality gate (2026-10-30)

## Competitive baseline — do not invent feature parity

Rodin Gen-2.5 public documentation advertises text/image-to-3D,
up to five reference views, PBR + mesh topology / poly controls,
partial editing, enhanced textures and several export formats.
Sources: https://docs.hyper3d.ai/en/get-started/features and
https://www.rodin3ds.com/

Microsoft TRELLIS.2 provides image-conditioned 512, 1024 and 1536
generation and native PBR, including complex/open topology:
https://github.com/microsoft/TRELLIS.2
**Higher voxel resolution alone does not guarantee better fidelity.**

## New working-code components in this PR

- `services/forge-gpu/trellis2_quality.py`:
  - `mobile-preview`: 512 resolution, 120k face decimation target, 1K texture.
  - `detail-preview`: 512 resolution, 200k target, 2K texture.
  - `studio-hd`: **opt-in 1024_cascade**, 300k target, 2K texture.
    Requires >=60 GiB GPU VRAM **and** `FORGE_GPU_HD_ENABLED=yes`
    on rented GPU plus `SPAKTOK_FORGE_GPU_HD_ENABLED=true` in Vercel.
    All are still bounded by the 35 MiB GLB delivery limit.
    The 1024 profile has **not** been benchmarked on the owner's A100.
    Profile opt-in is not a promise of 1-click production readiness.
- Backend unsigned inputs cannot override engine/pipeline CLI settings:
  the finite quality ID is included in an origin-bound SHA256/HMAC
  single-use GPU job ticket; Vercel rejects HD before D1 reservation unless
  GPU and Vercel both opt in. No default HD or silent paid reruns.
- `SpaktokAIDirector` has mobile/detail/HD selector with an HD
  readiness gate, and a downloadable 3D-quality evidence report.
- `services/forge-gpu/benchmark_glb_quality.py`: compare two
  **user-owned** GLBs offline without GPU, API, upload, or auto-winner.
- `lib/filter-engine/spaktok-forge-quality-evidence.ts`: JSON
  structural and mobile-readiness evidence with explicit missing tests.
- All five Spaktok sections can consume the same private local draft.
  This is a workflow differentiator, not a validated superiority claim.

## Run a zero-cost structural baseline

On the existing Vast instance with the previously generated model:

```bash
cd /workspace/spaktok-live-web
git pull --ff-only
python services/forge-gpu/benchmark_glb_quality.py \
  --spaktok /workspace/spaktok-first.glb
```

If the owner can legally obtain a Rodin GLB **generated from the same
reference image**, run:

```bash
python services/forge-gpu/benchmark_glb_quality.py \
  --spaktok /workspace/spaktok-first.glb \
  --rodin /workspace/rodin-same-input.glb
```

The tool outputs triangle counts, UVs, normals, PBR slots, textures,
skins, morphs, animations, hashes, bytes and mobile size budgets.
It sets `winner: null` because polygon count / file size are **not**
visual or artistic quality scores. Don't upload proprietary Rodin output
to public GitHub or disclose reference photos or private keys.

## Fair blind study required before claiming Spaktok > Rodin

Create at least 20 **rights-cleared** reference images distributed over:
single stylized characters, photorealistic heads, complex accessories,
transparent objects, clothing, hard-surface objects, and side/back views.
For each input and available multi-view references:

1. Generate a Rodin asset using documented settings; record price,
   workflow time, revision count and exact input references.
2. Generate Spaktok 512, then (only after operator cost approval)
   1024 HD on the same content. Record VRAM, timings, failure/timeout,
   output bytes and actual triangle/texture metadata.
3. Show 360-degree turntable renders under identical cameras, scale,
   PBR environment, distance, lighting and neutral background.
4. Have at least 5 blind raters assess source similarity, silhouette,
   unseen-side anatomy, texture errors and asset completeness.
5. Separately test automatic retopology, rigging, blendshapes,
   animations, AR face anchor, Agora live, gifts, world collisions,
   Android device FPS/thermals and creator permission flags.
6. Record success rate, mean/median total cost, time to usable result,
   mobile mesh limits and exact GLB/PBR conformance.

**Threshold proposal (not achieved):** show >=60% blind preference
in a preregistered representative comparison, with equal/less median
cost per accepted asset and no greater outright failure rate.
Report confidence intervals and sample counts; never claim victory
if key features such as five-view fusion, text-only 3D, rigging or
FBX/USDZ conversion have not been built and validated.

## Important unresolved items

- Preview authentication is not configured; do not copy production
  auth/DB secrets to an unreviewed Preview branch.
- Worker ingress for GPU and one-click browser return is unverified.
- GitHub Actions runners have failed to start; tests should be
  verified in an isolated CI environment or reviewed runner account.
- Latest Git branch is not confirmed deployed to Vercel Preview.
- High-resolution GPU output may exceed a 35MiB result bound and
  fail closed. 1536 is **not** enabled for this browser synchronous API:
  async queue, timeout strategy, VRAM measurements, and output delivery
  must precede it. No automatic expensive retries.
- Current TRELLIS.2 output does NOT automatically produce a complete
  human rig, ARKit blendshapes, clothing sim or face animation.
  Do not publish to consumers from private drafts without review.
