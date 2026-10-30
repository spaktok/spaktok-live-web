# Spaktok 3D — verified GPU asset in private Cloudflare R2

On 2026-10-30 the owner demonstrated successful upload:
`R2_GLB_UPLOADED_PRIVATE` and `R2_FANOUT_MANIFEST_UPLOADED_PRIVATE`.

We independently queried the connected Spaktok Cloudflare account after
upload. The existing bucket `spaktok-private-drafts` contains:

- `studio/private/pilot-20261030/33be391ce222f90d00316b26b5ff6c3f21b30f230122d8e87f94b26992f619aa.glb` — **5,343,540 bytes**.
- `studio/private/pilot-20261030/manifest.json` — **1,501 bytes**.

This confirms R2 persistence, NOT live mobile or web app publication.

## One authenticated Web Studio import (draft code, gated)

Code is included in PR #15 but is **NOT merged/deployed**:

1. Browser's `SpaktokAIDirector` shows
   "استيراد GLB الخاص من R2 وتوزيعه على الأقسام الخمسة".
2. The owner marks source-rights confirmation, then the browser sends an
   authenticated same-origin POST to `/api/spaktok-studio/pilot-ticket`.
3. Next.js verifies native `getNativeUser()` and a single owner ID
   specified by **private server env**
   `SPAKTOK_STUDIO_PILOT_OWNER_ID`; it refuses if the env flag
   `SPAKTOK_STUDIO_PILOT_ENABLED` isn't `true`.
4. Next.js signs a short-lived Ed25519 read permit from existing
   `SPAKTOK_D1_BRIDGE_SIGNING_KEY` used by face drafts. Distinct message
   domain `spaktok-studio-pilot-read-v1` prevents cross-use with face tickets.
5. Browser directly downloads the **private** R2 GLB from the pinned
   Cloudflare worker at
   `spaktok-private-studio-asset.spaktok.workers.dev`. The signed
   request uses custom headers, is bound to the specific origin/user/object
   and is valid for **60 seconds**. The 5.34 MB payload bypasses Vercel
   response body limits; it is not stored in a public R2 bucket.
6. Worker checks signature, expiry, exact origin and exact object key.
   It has read-only request handling and binds to the existing R2 bucket.
7. Browser checks response content type, exact byte count and known
   SHA256, runs GLB QA and saves ONE IndexedDB draft bundle/manifest with
   five `published:false` targets:
   `avatar`, `live`, `filter`, `gift`, `world`.
   UI previews remain in the same browser until native cross-device
   per-owner synchronization is implemented.

## Deployment steps — to be performed only after tests and review

1. Deploy Worker from `cloudflare/workers/spaktok-private-studio-asset.mjs`
   with an R2 binding:
   `STUDIO_ASSETS` -> existing `spaktok-private-drafts`. Expose only
   `spaktok-private-studio-asset.spaktok.workers.dev`.
2. Configure exact deployed Spaktok web app origin as Worker secret/var
   `SPAKTOK_WEB_ORIGIN`. **Do not use ephemeral trycloudflare links.**
3. Confirm Worker embedded Ed25519 public key matches the private key
   configured as `SPAKTOK_D1_BRIDGE_SIGNING_KEY` on Spaktok server;
   never copy the private key into frontend/client or GitHub.
4. On Spaktok server: set `SPAKTOK_STUDIO_PILOT_ENABLED=true`,
   `SPAKTOK_STUDIO_PILOT_OWNER_ID` to the actual logged-in native auth
   UUID of the authorized operator, and
   `SPAKTOK_D1_BRIDGE_SIGNING_KEY` in server secret storage.
5. Merge/deploy PR only when GitHub CI is green and review passes;
   do not assume the existing deployment has this endpoint.
6. Test the owner-only POST and one browser download; assert it rejects
   unsigned GETs, cross-origin POSTs, wrong users and expired signatures.
7. Test all five **private** Studio previews. For Android/live/AR/gifts/world
   additional rigging, animations, collision, mobile FPS/thermal and rights
   review remain mandatory.

Current Cloudflare bucket does NOT become public automatically. No model
weights or GPU server need to remain running for this R2-to-Studio import.

## Security notes

- The photographed clipboard showed part of an API credential earlier in
  the session. Revoke and rotate that temporary REST token promptly.
- The short-lived browser read signature cannot authorize writes/PUT/DELETE.
- Pilot is intentionally single-model and owner-only. Replace static
  object IDs with per-owner ACL/audited provenance before productizing.
- Serving content from Cloudflare Worker is only possible **after explicit
  deployment of the Worker with its correct R2 binding and origin**.
