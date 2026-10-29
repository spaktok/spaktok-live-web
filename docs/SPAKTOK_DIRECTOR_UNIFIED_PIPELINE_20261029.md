# Spaktok AI Director — Unified Studio / Avatar / Live / Filters / Gifts / World / Video 3D

**Date:** 29 October 2026  
**Scope:** Draft feature branch, no production deployment or automatic public publishing.
**Real sample:** `spaktok-trellis1-preview-mobile.glb` — 2,842,496 B,
28,379 triangles, PBR, UV and normals; owner-private real model from A100.
This original media is NOT committed into GitHub.

## What was implemented in this iteration

### 1. One source => six existing preview consumers

- AI Director's Arabic/English command parser recognizes individual departments
  and now expressions such as `جميع الأقسام` / `all studios`.
- `spaktok-director-dispatch.ts` provides deterministic, auditable per-target
  commands for Avatar, Live, Reality Filters, Gift, World, and Video 3D Studio.
- After an audited GLB is created or imported, the Director **automatically
  stores ONE SHA256-bound asset + full per-target manifest** in a single
  browser IndexedDB transaction for 24 hours. The same file is reused; there
  are no 5 redundant paid GPU jobs.
- `loadVerifiedDirectorHandoff(target)` rechecks SHA256 and destination.
  Existing Avatar, Reality, Gift and World importers use this validation for
  AI Director handoffs. Live uses Avatar Studio's existing local rig preview,
  NOT an actual Agora broadcast.
- Per-target state shows `private-preview-staged` or `blocked-geometry`,
  with unfulfilled rig/animation/face-tracking/LOD/collision/Android QA blockers.
- Video 3D Studio imports the same SHA256-verified GLB as a private timeline layer; the creator supplies the video, keyframes and output. No video is rendered or published automatically.
- No public release, gift monetization, world deployment, camera tracking,
  avatar body rig, or live streaming is triggered automatically.

### 2. Optional cross-device R2 + durable D1 workflow (NOT ACTIVE YET)

**Cloudflare D1 `spaktok-primary` table `studio_asset_drafts` was created
and its ten expected columns verified directly via the connected account.**
Existing chat/video/face tables were untouched.

Code added for a separate private GLB Worker:
- `cloudflare/workers/spaktok-private-studio-assets.mjs`
- owner-bound Ed25519 signature with domain `spaktok-studio-draft-v1`,
  explicit 15 MiB cap, exact allowed HTTPS Origin, short TTL, SHA256 verification,
  glTF 2.0 mesh/UV/normal/PBR validation, no public listings.
- Workers R2 binding `STUDIO_DRAFTS` should point to the existing
  **private** `spaktok-private-drafts` bucket.
- New authenticated Vercel API `/api/studio/private-assets`:
  D1-scoped limited reservations, no GLB bytes traversing Vercel.
  `/api/studio/private-assets/{id}/confirm` server-verifies signed R2 HEAD,
  size and checksum before recording `stored`.
  Owner-scoped GET returns only a signed time-limited direct GET ticket,
  DELETE removes the private R2 object and D1 record.
- Opt-in `StudioPrivateCloudPanel` has separate creator consent to cloud
  transfers. It supports upload, owner-private listing, integrity-verified
  download and delete **when enabled**.
  Restored assets require a new explicit rights confirmation before fanout.
- Default server flag `SPAKTOK_STUDIO_R2_ENABLED` is **OFF**.
  The new Worker `spaktok-private-studio-assets` does **NOT** exist in the
  connected Cloudflare account as of this audit. So the new R2 sync is
  source code and D1 preparation, **NOT yet a live storage service**.

### 3. Real GPU result

- Microsoft TRELLIS v1 + DINOv2 on owner A100 successfully generated real GLB,
  then finalized vertex normals. This is model inference evidence, unlike
  merely passing a CUDA compiler test.
- `trellis1_engine.py` now automatically finalizes future **preview** GLBs,
  using existing CPU-only normals utility; no second inference.
- A real uploaded file with a wooden foliage-covered garden trellis serves as
  a **World decorative prop candidate**, not a rigged humanoid avatar.
- No head/bone rig, lip-sync, AR filter or coins/Agora usage has yet been built
  from this World prop. The sixth Video 3D target only imports the same model
  as a private editable timeline layer, without a pre-existing video source.

## Architecture

```text
Creator image or GLB + instructions + verified rights
    │
    ├── Existing GLB: zero GPU
    ├── Browser 2.5D relief: zero GPU, not full 360 geometry
    └── TRELLIS v1: GPU once, explicit consent and operator provisioning
         ↓
GLB structural audit / GPU preview mobile normals finalizer
         ↓
AI Director detects departments + builds one immutable fanout manifest
         ↓
Atomic browser-private GLB+SHA256+manifest (24h)
         ├── Avatar: preview, rig and facial animation marked needed
         ├── Live: same avatar preview, actual Agora integration needed
         ├── Filter: mask preview, anchors and occlusion marked needed
         ├── Gifts: 3D preview, animation and payments marked needed
         ├── World: placed scene preview, collision and LOD marked needed
         └── Video: GLB layer prepared for local timeline, needs source video, keyframes and export QA
         ↓ [OPTIONAL, EXPLICIT CREATOR CONSENT ONLY]
R2 worker signed direct upload (<15 MiB) + D1 owner job metadata
         ↓
authenticated owner-only read ticket / delete
         ↓
human acceptance + real Android benchmarks before any publish
```

## Required private-R2 deployment steps (operator canary ONLY)

1. Select a **stable exact** production/staging Spaktok Studio HTTPS origin.
   Do not use a temporary Vast or Jupyter `trycloudflare.com` portal.
2. Review Worker code/license/data residency & ownership; create the Worker
   `spaktok-private-studio-assets`, bind R2 `STUDIO_DRAFTS` to
   `spaktok-private-drafts`, set `STUDIO_ALLOWED_ORIGIN` to the exact origin.
3. Ensure the Worker public Ed25519 key corresponds to the Vercel server's
   `SPAKTOK_D1_BRIDGE_SIGNING_KEY`. It uses a separate signed domain, not
   the existing `spaktok-private-face-assets` route.
4. Canary test wrong origin, missing signature, wrong sha256, oversized GLB,
   duplicate ID, cross-user read, expired ticket, forced overwrite, malformed
   GLB, DELETE and D1 confirmation.
5. Only then enable `SPAKTOK_STUDIO_R2_ENABLED=true` **in a private Vercel
   preview**. Do NOT automatically enable it in public production.
6. Test one consenting authenticated creator with the real 2.84MB GLB.
   Test owner-only retrieval on a second device and explicit deletion.
7. Add formal retention, GDPR deletion workflows, R2 location/jurisdiction,
   moderation and rate/abuse telemetry prior to open release.

**Do not enter credential values into git or ChatGPT messages.** Rotate any
previously disclosed Vast/provider secrets.

## Known blockers to a full native/production integration

- This iteration wires existing **web** studio preview targets. The native
  Kotlin Android source tree is not available in the connected GitHub repos.
  No native APK, FPS/memory/thermal or Agora broadcast is verified.
- AI Director text understanding is deterministic routing rules, not a
  complete autonomous LLM that authors meshes/rigs or edits textures by text.
- Actual facial/body rigging, lip sync, gift animation, filter tracking,
  collision geometry, world streaming, LOD, publishing and payments still
  require individually implemented adapters and device acceptance.
- No persistent Cloudflare Queues/Workflows GPU scheduling or provider
  auto-provisioning/auto-destroy has been integrated. GPU feature flags
  remain off; one-time manual Vast trial was successful.
- GitHub Actions on the latest feature branch commit are still **failing**;
  Vercel previews of **earlier** commits reached READY, but the complete new
  six-department/R2 source is not yet demonstrated as passing the full
  strict TypeScript/security gate or ready for production.
- Until tests and model licensing/rights assessment pass, **keep PR draft,
  cloud flag off and no automatic publication**.

## One-cycle private acceptance

1. In `/spaktok-word#ai-director`, import the owner's first 2.84 MB GLB.
2. Enter `أرسل المجسم إلى جميع الأقسام`, choose rights correctly and confirm.
3. Click `فحص المجسم وتجهيزه للأقسام` (zero GPU).
4. Check the six dispatch states and SHA256. Each selected Studio can open
   the **same** private file from the same browser with `?from=ai-director`.
5. Check the world viewer as a prop; leave Avatar/Gifts/Live/Filters blockers
   visible. No real rigging or public publish occurs.
6. Test any R2 upload only after the new isolated Worker and signed API
   canary are live and operator authorizes its private feature flag.
