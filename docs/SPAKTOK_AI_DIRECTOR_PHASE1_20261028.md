# Spaktok AI Director — first executable release (2026-10-28)

## Intent and scope

User input: one PNG/JPEG/WebP image OR a previously generated, owned GLB,
plus an Arabic/English sentence such as:
"حوّل صورتي إلى أفاتار لللايف وفلتر وهدية وعالم".

The V1 Director is a deterministic, auditable prompt-to-workflow ROUTER,
NOT an agentic large language model. The text selects target departments
and does not condition Stable Fast 3D geometry. It does not guarantee
Rodin-quality fidelity.

One approved generation request is shared between requested outputs;
no new GPU request is made per destination. Pre-existing GLB files need
zero GPU requests.

## Implemented now

- `lib/filter-engine/spaktok-ai-director.ts`: Arabic/English intent
  parsing; stage plan; technical QA; mandatory draft/publish gate.
- `lib/filter-engine/spaktok-ai-director.test.ts`: repeatable routing,
  source rights, no-cost GLB reuse, missing-rig and release tests.
- `components/spaktok/spaktok-ai-director.tsx`: image/GLB picker, prompt,
  automatic target discovery with manual override, client-side QA,
  explicit rights and remote-compute consents; no hidden charge.
- Component is embedded in `/spaktok-word` and `/reality-studio`.
  The authenticated web camera exposes `AI 3D Studio` shortcut.
- If a licensed GPU is configured, POSTs a **single** image to the existing
  `/api/spaktok-forge/gpu` route after user approval. The route enforces
  authenticated users, one reservation per owner per UTC day, an explicit
  global cap, and an allowlisted HTTPS host. No API keys reach browsers.
  **GPU mode is disabled by default**; V1 has not been tested on an actual
  GPU and is not a commercialized production model.
- If existing GLB provided, audits embedded geometry at zero GPU cost.
- Source images are not uploaded merely by generating a plan or previewing
  a local GLB. After explicit generation the remote GPU gets image bytes;
  currently no photo is permanently stored by this route.
- A valid GLB can be transferred via the existing browser-specific
  `saveLocalStudioGlb` IndexedDB handoff under the 15MB limit.
- `/avatar-studio`: current local 3D preview + 51-blendshape retarget
  mapping WHEN the imported GLB actually has corresponding morphs.
  No fake morphs on missing meshes. No Agora live publishing in this path.
- `/reality-studio`: imports the private handoff into a face-mask
  draft with unverified estimated nose-bridge anchor. Manual calibration
  remains essential.
- `/gift-studio`: private 3D viewing stage. **Not** a paid gift,
  animation or store item.
- `/spaktok-world`: private 3D world-stage viewer. **Not** a multi-user
  scene, collision-enabled asset, native Android renderer or publish event.

## Release gate

Never auto-publish source images or 3D results. All of these are required
before public creator release:
1. Verified creator rights and policy/legal review.
2. Correct 360 geometry and texture-quality comparison using the SAME
   creator source as Rodin. Current browser-local 2.5D Relief is not
   equivalent to an AI 360 object.
3. Properly authored face morphs and/or skeleton for an animated avatar;
   tested expressions; gift visual animation for gift use.
4. Tested anchor/occlusion, scale/collision, assets LOD and Android
   FPS/thermal budgets on real hardware.
5. Public publication pipeline, moderator review, R2 object lifecycle,
   native Android download/cache integration and (for live) Agora.
6. Operator-enforced GPU budget + provider-side auto-shutdown and
   spend limits; the D1 cap alone does NOT limit idle GPU rental bills.

## Next production milestones

P1: Deploy one licensed GPU inference endpoint; verify Stable Fast 3D
against a curated authorized image benchmark. Record cold-start, runtime
GPU invoice, GLB quality, texture coverage, and fail rate. Preserve user
source files only with explicit retention/privacy consent.

P2: Deploy TRELLIS.2 on compatible hardware (MIT license with separate
dependency license review), add a model router and measured quality
selection. No claim of superior Rodin fidelity until blind quality tests.

P3: Cloudflare Worker Queues/Workflows + D1 job states + private R2 bucket
with scoped user authorization and short-lived download grants. Update
web with status/progress and cancellation semantics (GPU charges may
already accrue after starting a job).

P4: Auto-rigging service (quality-controlled topology, 52 MediaPipe
blendshapes with neutral convention, optional full-body skeleton) and
automatic retarget QA. Implement real gift animation, real filter
placement, streaming/world integration and strict content review.

P5: Native Android (not Flutter) integration with signed manifest,
private R2 fetch, cache/LOD, camera renderer, Agora streaming and asset
release workflow. The current web repo is NOT proof the Android app
can display these assets.

## Runbook

1. Open https://v0-spaktok-elite-app.vercel.app/spaktok-word#ai-director
2. Select your own GLB (e.g. a generated Rodin mobile model) or an image.
3. Type Arabic intent, or check specific destinations; ensure rights.
4. For GLB: click "فحص المجسم وتجهيزه" — zero remote AI.
   For image: execution is disabled until the operator configures
   licensed Stable Fast 3D and creator separately approves transfer and
   GPU cost. There is no paid fallback to Rodin.
5. Inspect actual GLB audit. If structural QA passes and size is <=15MB,
   use destination buttons to open Avatar / Reality / Gift / World.
6. Treat all results as private previews, not public published content.

No credentials, privately supplied source images or commercial assets
are committed to GitHub.
