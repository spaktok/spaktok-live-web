# Spaktok Studio — GPU-free unified production foundation
Date: 2026-10-29

## Purpose

Implement the **creator workflow now**, and plug in GPU inference when the
creator/operator later has a compatible, licensed GPU budget.
One source image or GLB can serve many departments, without repeating
generation for every target.

### What exists in GitHub

**1. Studio AI Director V1** (`/spaktok-word#ai-director`, also Reality Studio)

- Reads a prompt in Arabic/English and routes to avatar, live, AR filter,
  gift and/or Spaktok world. Parsing is currently deterministic rules;
  it is NOT a trained LLM or model of complex creative intent.
- Handles a creator-owned GLB with **zero GPU**.
- Handles an image using an explicit **free on-device 2.5D relief**
  option; outputs a real GLB with UV, normals, PBR and image texture.
  This does NOT reconstruct an anatomical face/backside, unlike 360 AI.
- Has a separate paid 360 GPU option via existing fail-closed Fast 3D
  proxy; disabled until a licensed host and explicit transfer/compute
  consent are configured. No RunPod or GPU was purchased.
- Always audits the result and distinguishes a structural pass from
  native-device runtime readiness, rig and legal rights.

**2. Reusable 5-target fanout**

`lib/filter-engine/spaktok-studio-fanout.ts` constructs a
`SpaktokStudioFanout` versioned JSON manifest containing:
- SHA-256 hash of the **exact** GLB bytes, size and technical metrics.
- Model provenance (`existing-glb`, `browser-2.5d`, `ai-360-gpu`).
- Requested destinations, anchors and runtime integration blockers.
- Image-to-model job count (0 for existing GLB/local relief).
- Conservative release gate, always `published: false`, including
  unverified user-rights attestation vs moderator review.
- Optional Rodin head preview height (.34m) **only** for its exact
  calibrated-file SHA. It is not a real anatomical measurement.

No source image, 3D bytes, API keys or GPU credentials are embedded in
the manifest. It is NOT a signed release credential.

**3. Browser-only 24-hour draft handoff**

`reality-local-asset-handoff.ts` writes the GLB and its manifest in
one IndexedDB transaction after validating SHA-256. All actions are
same-origin; assets are NOT synced to other browsers or Android.
Drafts expire after 24h and have explicit deletion controls. IndexedDB
is not encrypted, so users should clear their data on shared devices.

**4. Existing target studio handoffs**

- Avatar: preview imported GLB; MediaPipe can move the head and will
  animate only morph channels actually present in the imported mesh.
  Face Rig Builder exists in Word (starter & expressive profiles)
  but requires manual calibration/visual review and is not a verified
  fully automatic anatomical rigging service.
- Live: private avatar preview only, no Agora public stream from this
  workflow.
- Filters: GLB imported as a private face-mask draft, nose-bridge
  anchor assumed and requires AR occlusion/calibration on an actual
  camera.
- Gift Studio: new private WebGL 3D viewing stage with optional local
  spin/float display and JSON transform export. Motion is NOT baked
  into GLB and no coins/payment/store purchase occurs.
- Spaktok World: new private WebGL 3D scene viewer with grid, position
  and preview-scale controls. No collisions, multiplayer, public world
  release or authoritative world state.

### How to test WITHOUT a GPU once deployment is available

1. Open `/spaktok-word#ai-director`.
2. Use **a GLB you own** or select an image and choose **free 2.5D**.
3. Enter e.g. `أفاتار للايف مع فلتر وجفت وعالم`; selected target
   checkboxes auto-follow the description until manually overridden.
4. Check source rights. For local mode, there is no network image
   transfer or GPU compute.
5. Click create/audit. Review the 5-target private manifest, GLB
   metrics and unfinished production requirements.
6. Download the GLB and JSON, or save both locally for 24 hours.
7. Open target previews. The same fingerprinted GLB is used; no
   five-way inference expense. Use the explicit delete option when
   finished on a shared device.

### Mobile/production constraints

- The publicly connected `spaktok/Spaktok` repo currently exposes
  Expo/React-Native application sources, **not** the user-requested
  `apps/native_android` Kotlin source tree. This web implementation
  must not be described as deployed into native Android.
- Before public release: creator/moderator rights review, auth, scoped
  R2 assets, policy/moderation, real device FPS & thermal tests, face
  rig QA, gift animations, event store & fraud checks, colliders/world
  service, Agora streaming protocol where relevant.
- Mobile preview technical budgets: 15 MiB handoff, <=150k triangles,
  <=12 embedded image assets, UV/normals/PBR. These are **heuristic
  gates**, not guaranteed FPS or fidelity.
- We cannot claim "better than Rodin" without blind comparisons on
  identical user images, proper texture/rig quality and actual GPU
  runtime invoices.

### GPU later — plug in without restarting the app

1. Choose a permitted commercial image-to-3D model, deploy it to a
   secure GPU worker and test **source-to-GLB end to end**.
2. Connect through the existing fixed-host Fast 3D gateway, with
   D1 quota, account spending cap and provider-side auto-shutdown.
   No paid tasks without explicit image transfer and GPU consent.
3. Add background orchestration (Cloudflare Queues/Workflows + D1),
   private R2 output, retry/idempotency and isolated worker lifecycle.
4. Route better models into the same `SpaktokStudioFanout` pipeline.
5. Add verified topology/rigging, real native runtimes and public
   moderation/release API only after the corresponding QA is passed.

### Deployment status and tests

Source was committed to GitHub `main`. Older Vercel builds showed
52 passing gate tests but exposed a strict TypeScript indexing error
in the fanout validator, which was patched in later commits. GitHub
Vercel statuses also expose a `build-rate-limit` requirement for
newer pushes. **No successful latest-source Vercel/Android production
deployment should be claimed until reverified.** The issue is not
related to GPU or the creator's RunPod payment method.

No GPU was provisioned, no automatic commercial model use and no
content was published to spectators during this work.
