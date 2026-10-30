# Spaktok multi-LOD PRIVATE workflow — from one real GLB (2026-10-30)

## What is implemented, what is NOT

The first **actual** TRELLIS.2 512 output is saved in Cloudflare R2.
New `build_private_lods.py` creates three **distinct GLB files**
from one local source **without running another TRELLIS.2 inference**:

- `lod0.glb`: byte-exact copy of the source.
- `lod1.glb`: requested 50% geometry ratio via meshoptimizer/gltfpack.
- `lod2.glb`: requested 20% geometry ratio via meshoptimizer/gltfpack.
- `pack.json`: actual output byte lengths, triangle counts, SHA-256,
  texture count and provisional per-department LOD recommendations.

**These percentages are simplifier requests, not guaranteed achieved
values.** Each output is parsed after generation and must have fewer
triangles, embedded PBR/UV/normals and original PBR texture slots; if the
source has skins, morphs or animations they MUST still exist in each output.
The pack is committed to a new directory only after ALL validations pass.
Source is never modified. A failure never creates a partial official pack.

Source code: `services/forge-gpu/build_private_lods.py`.
GPU-free contract tests: `services/forge-gpu/test_build_private_lods.py`.

**Not yet done:** no source GLB has been processed into this pack
on the owner's Vast instance, and the three LODs are not yet uploaded to
R2 or bound to per-target browsers/native Android. The existing five-target
Studio fanout still shares one validated GLB; it does NOT silently produce
LOD geometry. No rig, animation, AR or native FPS is automatically ready.

## Cost-safe invocation on the existing Vast instance

Check whether the meshoptimizer `gltfpack` native tool is installed.
Use only the official meshoptimizer release, and verify its provenance;
no `curl | bash`, arbitrary third-party binary or secrets.

```bash
cd /workspace/spaktok-live-web
git pull --ff-only
command -v gltfpack
```

If it is installed, run once with the **existing** pilot GLB:

```bash
python services/forge-gpu/build_private_lods.py \
  --source /workspace/spaktok-first.glb \
  --output /workspace/spaktok-private-lods-20261030
```

Expected marker:

```text
SPAKTOK_LOD_PACK_CREATED_PRIVATE
lod0 triangles=...
lod1 triangles=...
lod2 triangles=...
published=false; rigged=false; androidQA=not-tested
```

If `command -v gltfpack` returns no path, first download the
authentic signed/released meshoptimizer `gltfpack` binary for Linux
from the official project (no new GPU inference required):
https://github.com/zeux/meshoptimizer/releases

See also https://meshoptimizer.org/gltf/ . This CPU-side packaging
process itself should not start inference, but **an active Vast machine
continues accumulating rental fees** until manually stopped.

Do not overwrite any pack. The script refuses an existing destination.
To reprocess, use a new, empty output directory name after deciding
what should happen to the old private drafts.

## Safe next integration

1. Inspect `pack.json` and compare turntable renders of all 3 LODs.
2. Review mobile performance and visible silhouette/PBR artifacts.
3. Use a signed private R2 upload path to store all three GLBs and the
   pack manifest under an owner-private key, with permissions and
   content hashes. Do not publish public bucket links.
4. Add per-target private selection to Spaktok AI/Studio and native
   Android. Do not wire final avatars into Agora, AR, gifts or world
   without rigging, tracking/collision and physical device QA.
5. Record achieved LOD size and FPS savings, not just requested ratios.

## Rodin comparison caveat

Rodin Gen-2.5 officially accepts up to **five images**, text prompts,
polycount controls and PBR; formats include GLB, USDZ, FBX, OBJ and STL.
The user-supplied claim that Rodin has directly equivalent "1024/1536"
voxel-resolution tiers should NOT be used as a validated apples-to-apples
metric: TRELLIS.2's 512/1024/1536 are reconstruction grid resolutions,
Rodin exposes different model tiers, poly budgets and texture settings.

Sources: https://docs.hyper3d.ai/en/api-specification/rodin-gen2-5
and https://github.com/microsoft/TRELLIS.2 .

Do not claim Spaktok beats Rodin until matched-reference blind
quality, render and total-workflow trials are completed and repeatable.
