# Spaktok Studio / 3D Engine — Rodin benchmark v1
Status: **quality requirements only** — no claim of parity or superiority.
Owner priority: **visual similarity and material quality before polycount, GPU utilisation, or deployment links**.

## Verified starting point (2026-11-01)
- Real original crown PNG SHA-256: `883e3a1b5e00046f658ae81ffa1cb3c644a6e5ba334b9aacf5d5a370bff5992e`. The source is kept privately in Cloudflare R2.
- TRELLIS.2 crown v1: 117,788 triangles, one PBR material, `succeeded` structurally, **rejected by owner for visual mismatch**.
- Crown v2: 32,256 triangles, source PNG embedded; **2.5D approximate geometry, not evidence of full 3D reconstruction**. Six names/material groups are preliminary zones, not validated gem segmentation. Android face tracking and production filter delivery not yet QA-certified.
- Current code has profiles mobile-preview (512/1K), detail-preview (512/2K), studio-hd (1024 cascade/2K), studio-ultra (1536 cascade/4K). Presence of profiles is not proof that the latter two execute reliably or improve similarity. The first `generate_one` goes through the mobile-preview default.
- Existing mobile finalization failed on v2; do not treat it as production-ready.
- Do not deploy v1/v2 as visually approved public assets.

## Comparison rules — measure, do not claim
Benchmark 20 owner-licensed assets: 5 filigree jewelry/crowns, 5 organic characters/heads, 5 hard-surface props, 5 stylized gifts. Record the exact input bytes, SHA-256, reference directions, licenses and seed. Compare identical input sets, and separate **single view** from **2–5 view** runs. For unseen backsides on single-view inputs, do not report invented ground-truth similarity.
Baseline: current Rodin Gen-2.5 tier and settings, frozen in experiment metadata. A changed Rodin tier invalidates past comparisons. Record Rodin cost/credits, latency and output formats without storing service credentials in Git.
For each generated asset, use the same camera poses, ground plane, neutral/HDRI illumination, renderer, image resolution and tone mapping. Render front, left/right, 3/4 left/right, back, above and below (when geometry exists).
Measure:
1. **Front silhouette IoU** (higher better), key-detail landmarks on crown/gems, and render-to-reference LPIPS or DINO perceptual distance (lower better). Reference backgrounds must be masked consistently. Require human inspection: no automatic metric alone can certify aesthetics.
2. **3D structural correctness**: disconnected parts, open surfaces where expected, thickness, holes, floating gems, non-manifold topology, UV distortion, normals, geometry across views. Use Chamfer distance only if real multi-view/ground-truth geometry exists.
3. **Physical materials**: BaseColor/Metallic/Roughness/Normal/Opacity availability, texture blur, overly baked highlights, gem transparency, stone positions and independently adjustable semantic material zones. Material count alone is NOT a quality score.
4. **Runtime:** per-asset total GPU seconds, peak VRAM, net end-to-end cost, R2 storage bytes, delivery latency, GLB file size, Android preview FPS (on a named device). Repeated warm/cold runs separately.
5. **Stability:** failed/partial results, reproducibility across seeds and percentage accepted by independent reviewers blinded to provider.

### Claim threshold — narrow and falsifiable
Never claim "better than Rodin" globally. For one predeclared asset family, require at least 20 blind comparisons against the same Rodin configuration, a higher median independent reviewer score, a no-worse front fidelity median, and no regression in required PBR functionality. Report uncertainty and losing examples. Separately measure total cost and Android FPS.
For jewelry/crown pilot: set preproduction goals of silhouette IoU >= 0.95, **all manually indexed major gemstones present**, transparent spaces preserved and visually distinct metal/gem channels. These are goals, not measured achievements. No guarantee of 100% accuracy from a single image.

## Proposed quality-first architecture
1. **Source vault**: immutable PNG/multiview uploads and image alpha, photographer rights, D1 job lineage; never replace source with a freeform prompt. Distinguish original photograph from synthetic multiview guesses.
2. **Subject classification and segmentation**: decide hard-surface / ornamental / organic / avatar. For jewelry use foreground silhouette, line/symmetry cues and identified large gemstones. Masks are reviewed, not arbitrary UV grid partitions.
3. **Multi-candidate generation**: TRELLIS.2 as a baseline, controlled HD/Ultra *only after GPU preflight and per-job cost authorization*. Generate limited candidates with deterministic seeds, no blind retries.
4. **Reference-projection optimization**: render each candidate back to the original camera pose; minimize silhouette and key-feature error, improve mesh, preserve original photographed colors without baking shadows as metallic/roughness. No claims of perfect hidden geometry.
5. **Material-stage separation**: geometry first, texture refine second, 2K–4K PBR maps with isolated gem/metal regions and validation. Add multi-view reference when accessible. Protect original photo and original GLB.
6. **Master QA gate**: automatic metrics + side-by-side owner review. Failed candidates remain private and cannot be marked visually approved.
7. **Mobile derivative**: bake and decimate only *after* Master acceptance; verify UV, maps, normals, head anchor and steady FPS on target Android devices. Never use mobile-preview as the studio-quality benchmark.
8. **Studio user workflow**: Image -> Master -> review -> optional adjustments -> validated AR Filter/Live/Avatar/Gift export. Previews must be reachable, owner-only and tested on mobile before calling them working.

## Execution priorities (no GPU spending until baseline is clear)
P0. Fix/verify owner device preview and source-to-render side-by-side comparison; capture an actual frame, not only HTTP 200.
P1. Establish Rodin baseline using the same original crown input, exact job settings and downloadable results if the owner has rights to provide them.
P2. Verify TRELLIS.2 studio-hd and studio-ultra prerequisites on A100 once and assess cost/compatibility; do not auto-queue paid jobs or rerun rejected 512 jobs.
P3. Add render-based front fidelity, silhouette and stone-position quality gates; test on existing artifacts first.
P4. Implement image-guided refit and real semantic material segmentation for fine crowns. Compare blind outputs and iterate.
P5. Optimize mobile AR/streaming independently of raw 3D quality. Only then use an evidence-backed performance claim.

## External references (not private design details)
- Rodin API: https://docs.hyper3d.ai/en/api-specification/rodin-gen2-5
- Rodin capabilities: https://hyper3d.ai/features/api
- TRELLIS.2: https://github.com/microsoft/TRELLIS.2

**Non-goals:** "100% 3D from one photo", guessing unseen backside as fact, turning the input photo into a curved board and calling it geometry reconstruction, renaming material slots without semantic separation, assuming more polygons means more fidelity, reporting a page as working without mobile GLB/camera QA, claiming proprietary Rodin internals are known.
