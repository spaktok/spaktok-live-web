# Spaktok → Rodin parity: measured A100 resolution ladder (2026-10-31)

Baseline already verified: TRELLIS.2 + DINOv3 + ZhengPeng7/BiRefNet on
Vast A100 80GB produced a private 5,343,540-byte GLB now in R2.
The next gap to Rodin Gen-2.5 is **measured quality**, not connectivity.

## What changed
- `trellis2_quality.py`
  - New `studio-ultra`: `1536_cascade`, 4096 PBR texture, 500k faces,
    needs 70 GiB VRAM. `async_only=True`, so the synchronous browser
    ticket API can never run it.
  - `POLY_BUDGETS` (20k/50k/120k/200k/300k/500k) + `with_poly_budget`.
    These work like Rodin poly controls, but a budget can only lower a
    profile's ceiling.
- `trellis2_engine.generate_with_quality`: the generation core is now
  shared. `make_glb` keeps the old behavior and the 35 MiB limit.
- `rodin_parity_ladder.py`: loads the model once and runs one image
  through 512 → 1024 → (optionally) 1536. For each profile it records
  wall time, peak VRAM, bytes, SHA256, whether the file fits the 35 MiB
  web limit, and a structural report from `benchmark_glb_quality`. It
  stops at the first failure, does no automatic retries, uploads
  nothing, and leaves `winner: null`.

## Run on the existing A100 (paid GPU time)

    conda activate /workspace/trellis2-env
    export HF_HOME=/workspace/hf-cache
    cd /workspace/spaktok-live-web && git pull --ff-only
    cd services/forge-gpu
    python -m unittest test_rodin_parity_ladder -v
    # 1) dry run (free)
    python rodin_parity_ladder.py --image /workspace/ref.png
    # 2) 512 + 1024 measured
    python rodin_parity_ladder.py --image /workspace/ref.png --execute
    # 3) only if step 2 passes: 1536 / 4K
    python rodin_parity_ladder.py --image /workspace/ref.png \
      --profiles studio-hd,studio-ultra --allow-ultra --execute

Report: `/workspace/spaktok-ladder/ladder-report.json` plus one GLB per profile.
Then compare against a Rodin GLB made from the same image:

    python benchmark_glb_quality.py \
      --spaktok /workspace/spaktok-ladder/spaktok-studio-hd.glb \
      --rodin /workspace/rodin-same-input.glb

## Async job queue (built)
`forge_jobs.py` + `/v1/jobs` in `server.py` (TRELLIS.2 engine only,
operator Bearer token only, requires `FORGE_GPU_HD_ENABLED=yes`):

    TOKEN=...; GPU=https://<tunnel>
    curl -H "Authorization: Bearer $TOKEN" -F image=@ref.png \
      -F profile=studio-ultra -F poly_budget=300000 $GPU/v1/jobs   # 202 {id}
    curl -H "Authorization: Bearer $TOKEN" $GPU/v1/jobs/<id>       # poll
    curl -H "Authorization: Bearer $TOKEN" -o out.glb $GPU/v1/jobs/<id>/glb

One GPU job at a time (shares the sync lock), queue depth 8, no retries,
photo dropped from memory when the job starts, result 0600 on disk,
expires after 1 h, errors are categories only. Output limit 256 MiB.
Env: `FORGE_GPU_JOB_DIR`, `FORGE_GPU_JOB_QUEUE`, `FORGE_GPU_JOB_TTL`.
Then push the GLB to R2 with `push_first_glb_to_spaktok_r2.py`.

## Remaining Rodin gaps (not built yet)
1. ~~Studio UI + Next route for `/v1/jobs`~~ built. Still open: automatic
   push of results to R2.
2. Multi-view (up to 5 references): TRELLIS.2 is single-image only.
   Options are TRELLIS v1 `run_multi_image` or view fusion.
3. ~~Text-to-3D~~ built: `/api/spaktok-forge/text-image` (AI Gateway
   `openai/gpt-image-2`, 1024², single-object clean-background prompt,
   auth + 6/15min rate limit). The user reviews the concept image, then it
   becomes the source for the A100 Studio HD/Ultra job.
4. ~~Shape-conditioned re-texturing~~ built: official
   `Trellis2TexturingPipeline` (`texturing_pipeline.json`) as async job kind
   `retexture` via `POST /v1/jobs/retexture` (image + GLB v2/PLY, magic-byte
   sniffed, <=2M faces). Opt-in `FORGE_GPU_RETEXTURE_ENABLED=yes`, requires
   >=40 GiB VRAM (second pipeline). Web upload cap 4.25 MB image+mesh total
   (Vercel body limit). Studio panel has a "إعادة تلوين مجسّم" mode.
5. Quad remesh, rigging, FBX/USDZ export.
6. Blind study (20+ images, 5+ raters) before any "≥ Rodin" claim.
