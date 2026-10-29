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

## Actual AI agent architecture (NEW — not live until flag + auth)

The original UI used simple regex routing and could respond convincingly even
when no model was connected. **It was not an autonomous AI agent.**

The new code implements a bounded planner / executor / observation loop:

```text
Chat text + optional consented 320px photo preview + recent conversation
 -> POST /api/studio/director/agent/step
 -> authenticated, rate-limited Vercel AI Gateway model
 -> ONE typed tool action (structured output)
 -> STRICT independent policy validation
 -> browser-local tool executes REAL work
 -> observation: true mesh/texture/GLB/sha256/3D GPU result or real failure
 -> model sees observation and chooses next action (max six steps)
 -> result GLB + private specialist handoff + viewer IN THE CHAT
```

AI tools:
- `inspect_asset`: real GLB structural QA.
- `generate_relief`: actual image-based local 2.5D geometry.
- `generate_3d_gpu`: TRELLIS on private paid GPU, after separate approvals.
- `recolor_asset`: actual change to PBR GLB material using three.js.
- `dispatch_asset`: signed SHA256 audit and same-asset six-studio handoff.
- `finish`: state what actually happened; no fake output.

Security: no shell commands, file deletion, publishing or unbounded tool calls.
No silent GPU reruns, no inferred permission to upload an image, no source
bytes sent to an LLM unless creator has explicitly opted in to **a small
JPEG image preview**, and no changing unrequested colors. Registered
user required with 15-minute quota. Six-step max. Model action schema and
policy are tested. Recent chat history sent as bounded TEXT only.

**Operational gate:** `SPAKTOK_DIRECTOR_AGENT_ENABLED=true` must be
enabled on the deployed environment, with a working Vercel AI Gateway
and the native D1 session/auth config. These are NOT configured in
the protected Preview at the time of writing. The front end checks
`GET /api/studio/director/agent/step` and explicitly says whether
the model-driven agent is enabled, or whether the user is only using
a deterministic local rule engine. Do not claim that this feature is
currently a running LLM until live calls and real GLB are verified.

Final compile/regression test and browser end-to-end test still pending
because GitHub workflow runs have empty step summaries and latest Vercel
check is `build-rate-limit`. This new agent code is committed to a
**draft PR**, not merged into the production web or Kotlin app.

### Operator canary to verify real AI rather than a scripted chatbot

1. With a private authenticated preview, configure AI Gateway and set
   `SPAKTOK_DIRECTOR_AGENT_ENABLED=true` for THAT preview only.
2. GET capability must say `enabled:true`; inspect model request counts.
3. Attach a test GLB and ask: `غيّر خامته إلى الذهبي وأرسله للعالم والهدية`.
4. Observe model tool outputs: `recolor_asset` -> `inspect_asset`
   -> `dispatch_asset` -> `finish` and verify file SHA256 differs.
5. Try `360` from an image with GPU offline: the agent must state that
   compute is unavailable and must not create any 2.5D placeholder.
6. Ask for all six targets; exactly six private results should appear.
7. Test vision opt-in OFF then ON with a nonsensitive test image; verify
   that only the reduced JPEG, never the full photo or model, reaches LLM.
8. Test rate limits, no session, hostile origin, invalid AI action, fake
   tool success, repeated GPU spend, and abort. No public publish.
9. Only after this pass consider production activation and native Android.

## Next engineering objectives (not completed)

- Implement real per-domain adaptors for rigging, eye/mouth morph, filter
  placement/occlusion, 3D animated gifts, World physics/LOD, video keyframe
  generation/export, and Agora/native Android after separate safety gates.
- Durable project history and GPU job scheduler/queues on D1/R2/Workers
  without always-running GPU.
- Moderated creator asset publication pipeline and per-domain QA.
