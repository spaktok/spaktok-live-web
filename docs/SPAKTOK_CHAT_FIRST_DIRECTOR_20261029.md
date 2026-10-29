# Spaktok Studio — Chat-first AI Director Architecture

Date: 2026-10-29
Branch: `feat/vast-a100-forge-bridge-20261029`
PR: https://github.com/spaktok/spaktok-live-web/pull/14
**Status: feature branch, not merged or approved for mass production.**

## User-facing experience

Instead of opening six unrelated editors, the creator goes to
`/spaktok-studio` (or legacy `/spaktok-word`). The authenticated
Spaktok home also has an `AI Studio` quick-entry link.

The studio is now a premium chat-oriented composition UI. Creator:
1. Attaches a PNG/JPEG/WebP portrait/object photo, photographs from the
   mobile camera, or an existing `GLB`.
2. Types a natural Arabic, German or English creative request, e.g.:
   - `حوّل صورتي إلى أفاتار ثلاثي الأبعاد`
   - `أرسل المجسم إلى جميع الأقسام`
   - `اجعل هذا المجسم ذهبيًا ثم جهزه للهدية`
   - `حوّله إلى مجسم بارز 2.5D للفلتر`
3. The Director selects internal departments without manual checkboxes,
   chooses an available operation, and returns results **in the same
   conversation**: verified downloadable GLB, rotatable WebGL preview,
   one manifest, and per-specialist status.
4. The original specialist studio pages still exist for optional advanced
   engineering; they are not required for the normal GLB handoff.

## What executes now (real engines only)

| Command/source | Action performed | Result in chat |
|---|---|---|
| Existing GLB | Actual GLB structural/UV/PBR QA; SHA256; atomic private browser handoff to selected specialists | Rotating textured GLB, file download, per-specialist validation |
| Source image with explicit **2.5D/relief** request | Existing `createDirectorReliefGlb` mesh+PBR+UV+normals in browser, no GPU | Actual downloadable 2.5D GLB and viewer; honest notice it is not full reconstruction |
| Source image with 360/Avatar/3D request | Existing `generateForgeGpuDirect` to configured proprietary/private TRELLIS GPU; requires authenticated ticket, connected GPU and **two explicit consents** | Actual 360 GLB only when a GPU is really available and inference succeeds; otherwise an explanation and no fake output |
| Static existing GLB + clear material-color instruction | Real three.js `GLTFLoader`/PBR material edit/`GLTFExporter`, new file and QA | New downloadable recolored GLB and viewer. Preserves underlying texture but tints it; does not create a new generative texture |
| Natural-language all departments | One asset/manifest; six internal outputs; zero redundant GPU jobs | Individual internal status for Avatar, Live, AR Filter, Gift, World and Video 3D |
| No source | Requires a photo or model, does not pretend text itself generated a mesh | Helpful follow-up inside chat |

Private cloud drafts remain optional: `StudioPrivateCloudPanel` still
requires separate user approval and R2 flag. Never silently upload user
photos or models to the public internet.

## What does NOT execute automatically yet

The Director's downstream handoff is **not** autonomous mesh repair,
face/body rigging, lip-sync, realtime camera face tracking/occlusion, VR
world collision simulation, professional gift animation, Agora streaming,
a finished video render, coin/payment transactions, or public posting.

The cards explicitly show these as separate blockers. The real TRELLIS
sample (2.84MB GLB) is a World decorative prop, not a rigged human avatar.
Do NOT use the word "done" for nonexistent specialist output.

## Text AI vs computer-vision engine

- Local deterministic parser `routeDirectorChat` always works and is
  exercised by `spaktok-director-chat-router.test.ts`.
- Optional `POST /api/studio/director/interpret` uses the existing Vercel
  AI Gateway `google/gemini-3-flash` structured-output interface for
  TEXT-ONLY intent understanding if and only if
  `SPAKTOK_DIRECTOR_LLM_ENABLED=true` and a native authenticated session
  + D1 request budget are available.
- Disabled by default for cost control; the chat automatically falls
  back to the local rules if LLM service is unavailable or rate-limited.
- The LLM never sees the image, source file name or the user-supplied GLB.
  Its optional output may choose target departments; it cannot override
  rights checks, decide to spend GPU credit, bypass asset audits or
  publish a model.
- **This is not an image-understanding assistant yet**: the source image
  can be processed by the TRELLIS GPU after consent, but the routing
  parser does not recognize depicted objects from pixels.

## Privacy & safety

- Source file size: image 8 MiB, GLB 15 MiB.
- Browser-only generated GLB and manifests are stored in IndexedDB with a
  24-hour expiry. It is not encrypted at rest; don't use on shared devices.
- Source rights attestation is required before transforming or distributing.
- A new attachment resets rights and paid-GPU consents.
- When GPU is disconnected, a 360 request is blocked; never replace it
  silently with a shallow 2.5D relief.
- A charged GPU request is never automatically retried after a failed
  network response because the provider ticket may already be consumed.
- All dispatched specialist outputs remain private drafts with blockers.
- A fixed static-GLB material editor refuses rigged or animated assets
  instead of flattening skeletal/animation tracks.
- No direct cloud GLB upload from Word merely because the user asked an AI
  question. R2 requires its own explicit storage consent and authenticated
  owner flow. Its signed upload canary is not yet complete.

## Release/testing truth

- Older commit `4808b88063` successfully built on Vercel Preview,
  including the first chat UI and optional text-only interpreter.
  **The later 3D material engine, /spaktok-studio landing page, camera
  attachment and tests have not yet passed a new Vercel build.**
- GitHub Actions jobs on this feature branch have reported failures with
  no retrievable job logs and empty step summaries.
- Vercel has also returned `build-rate-limit` on subsequent commits.
  Do not label an unbuilt commit production-ready.
- `SPAKTOK_DIRECTOR_LLM_ENABLED` and `SPAKTOK_STUDIO_R2_ENABLED` remain
  OFF until credentials, authorization and live owner-only tests pass.
- The native Kotlin Android application is in a separate working tree,
  not in the connected GitHub web source; no native mobile AI Director
  deployment, frame rate test or Agora integration is claimed.

### Acceptance checklist for the next private preview

1. GitHub/Vercel production build and all new chat router/material tests pass.
2. Creator uploads the owner's reviewed `spaktok-trellis1-preview-mobile.glb`
   via the chat and writes `أرسل المجسم إلى جميع الأقسام`.
3. Verify the GLB appears in the chat as a rotatable real model, downloads
   intact, and exactly **six** specialist results appear with blockers.
4. In a follow-up chat message write `اجعله ذهبيًا`; verify it returns a
   NEW GLB with changed PBR materials (not an imaginary success).
5. Upload a photo and explicitly ask for `2.5D`; verify free local
   relief succeeds without a GPU ticket.
6. Ask for a real 360 avatar while GPU is offline; verify that no fake
   model or paid request is produced and the chat explains GPU needs.
7. If operator authorizes and starts GPU later, authenticate a creator,
   consent to image transfer and compute; test one real 360 run + asset QA.
8. Review accessibility, real image-to-output similarity, memory use,
   deletion, data residency, AR/Agora/rigging and Android performance before
   production or any public fan-out.

## Next engineering objectives (not completed)

- Implement real per-domain adaptors for rigging, eye/mouth morph, filter
  placement/occlusion, 3D animated gifts, World physics/LOD, video keyframe
  generation/export, and Agora/native Android after separate safety gates.
- Durable project history and GPU job scheduler/queues on D1/R2/Workers
  without always-running GPU.
- Moderated creator asset publication pipeline and per-domain QA.
