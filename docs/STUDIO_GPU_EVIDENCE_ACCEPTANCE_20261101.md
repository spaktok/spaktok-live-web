# Studio GPU evidence acceptance — 2026-11-01

## Purpose
Record **one** actual owner-approved GPU generation with reproducible, verifiable local evidence. This is a release **blocker** for marketing 3D quality claims, not permission to spend GPU credits.

## Implemented on main
- `services/forge-gpu/rodin_parity_ladder.py` includes an explicit operator-declared source commit, model revision and SHA-256 of the source image on executed runs.
- `services/forge-gpu/verify_gpu_evidence.py` rehashes **actual local GLB bytes** and the source image, checks the GLB header, output size, required runtime metrics, successful per-profile reports and exact commit/model labels. Refuses symlink outputs and does not print private media paths. It never uploads or publishes content.
- `test_verify_gpu_evidence.py` exercises tampered media, wrong commit, wrong source, partial jobs and unsafe file paths. The main quality workflow now includes these tests.

## Operator sequence (GPU inference is paid; explicit approval required)
1. Check that a GPU is already running, the exact repo commit is checked out and licensed model weights are available; separately record actual model version, device identity and inference logs.
2. Use an **authorized** owner photo (no private photo or key in GitHub). Preflight without paid inference:
   `python rodin_parity_ladder.py --image /workspace/owner/ref.png --profiles mobile-preview`
3. When the operator explicitly approves a single job, provide the **actual** Git SHA and deployed model revision; run one profile, with no automatic retries:
   `python rodin_parity_ladder.py --image /workspace/owner/ref.png --profiles mobile-preview --commit <exact-40-hex-sha> --model-revision <actual-model-revision> --execute`
4. In the output directory (default `/workspace/spaktok-ladder`), verify:
   `python verify_gpu_evidence.py --report /workspace/spaktok-ladder/ladder-report.json --source-image /workspace/owner/ref.png --commit <same-sha> --model-revision <same-revision>`
5. Retain **private**: machine and CUDA versions, the successful worker stage logs, consent record, owner-only GLB, output hash, topology/PBR report and elapsed time. Do not publish the source or GLB to a public repo.
6. Run 20-case blind Rodin comparison on the same authorized inputs; then test mobile LOD, rigging, AR FPS, thermal behavior and live capture in real devices. Structural evidence is insufficient to declare Rodin parity or release approval.

## Interpretation
- `verified: true` proves only that recorded bytes match a locally available report and operator-declared provenance. It does **not** prove that the GPU actually generated those bytes, that the hardware identity is genuine, that a photo is licensed, that visual output is superior to Rodin, or that Android/AR works.
- The validator intentionally fails closed on missing, incomplete, wrong-hash or unsafe outputs. It does not trigger extra GPU jobs.
- GitHub Actions failures with no job steps are an infrastructure blocker: **do not waive required checks**. A successful Vercel build cannot replace security, real GPU or Android QA.

## Current status
No paid GPU inference, public GLB release, automatic production deployment, or full Rodin side-by-side benchmark was performed by these source changes.
