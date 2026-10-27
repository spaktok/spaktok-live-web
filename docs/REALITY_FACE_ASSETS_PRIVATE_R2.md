# SpakTok — Owner-private face draft assets in Cloudflare R2 (2026-10-27)

## Deployed infrastructure
- New isolated Worker `spaktok-private-face-assets` at
  `https://spaktok-private-face-assets.spaktok.workers.dev`.
- The Worker has `FACE_DRAFTS` R2 binding -> **spaktok-private-drafts**.
- Cloudflare D1 `spaktok-primary` contains the `face_drafts` table + owner/time index.
- Existing `spaktok-media-upload` and its video flow are not modified.
- Production Vercel already carries the native auth session configuration and
  `SPAKTOK_D1_BRIDGE_SIGNING_KEY` signing key used by the established video flow.

## Upload-once, reuse automatically
1. User must be logged into native SpakTok account, with a valid secure cookie.
2. On camera screen, selecting a local GLB immediately previews it and uploads
   one private copy via `POST /api/reality/face-drafts`.
3. Vercel verifies origin, cookie, 12 MB limit, glTF 2.0 binary header,
   a single solid 468 vertex, 2694-index triangle surface and embedded texture.
4. D1 records a random UUID key under authenticated user. The Vercel Node.js
   server issues short-lived Ed25519-signed requests to the Cloudflare Worker.
5. Worker verifies signature, expiry, user ID, UUID, content-length, glTF
   topology and checks no existing object can be overwritten.
6. User revisiting camera: `GET /api/reality/face-drafts` returns only THEIR
   latest private draft and the browser rehydrates GLB through an authenticated
   server proxy `/api/reality/face-drafts/{assetId}`, NOT a public R2 URL.
7. User can remove a stored asset via authenticated DELETE request. The
   camera continues to work locally if auth or R2 is temporarily unavailable.

## Privacy and licensing
- All face draft files are PRIVATE. No anonymous GET/PUT R2 access.
- Zero presigned URLs returned to the browser; edge URL is known only on
  the Vercel server. R2 object keys include authenticated user UUID.
- Draft images may carry third-party image licenses (e.g. Pngtree).
  Private storage is **not a redistribution license**. Requires rights review
  before public effect gallery/marketplace publication.
- No user face biometrics or landmarks are sent to R2 automatically; a stored
  user-supplied face-model image itself may still be sensitive personal data.
- EU residency must be separately checked in R2 bucket settings before
  claiming EU-only data storage. Do not promise GDPR compliance solely
  because this system stores in Cloudflare.
- Cookies are HTTP-only (native SpakTok auth); server verifies access to each
  object on every retrieval and deletion; all responses set private no-store.

## Operational notes
- Preview/demo accounts without native session can still use the local GLB
  importer. They do NOT automatically receive owner-private R2 persistence.
- 12 uploads per account per rolling 24-hour period; max 12 MB each.
- The Worker cannot be exploited for arbitrary R2 objects: validates
  exact signed method, user, file UUID and byte length with a short expiry.
- Rollback: stop Worker subdomain or change Vercel route, leaving private data
  intact. Users should be able to delete uploaded objects from within app.
- The user-provided GLB bytes in this ChatGPT chat are NOT directly
  available to Cloudflare's connector; to store the exact binary, select it
  once in the signed-in camera or upload via a securely authenticated pipeline.
- Not a substitute for full visual QA on Android device.
