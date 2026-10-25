# Private Cloudflare Stream video intake — phase 1 (disabled by default)

This phase establishes a **private upload and processing pilot**, not public video publication.
It does not change the current `videos` table, user identities, feed, or legacy MP4s.

## Cost/security boundaries

- Signed, single-use direct upload URLs expire after 15 minutes. Browser uploads video bytes
  **directly to Stream**, not through Vercel or your application server.
- The cloud account token is only used inside a Node.js server function; never expose it
  via `NEXT_PUBLIC_` variables.
- Uploaded videos have `requireSignedURLs: true`. They cannot be publicly played
  until we design a moderation/publishing workflow and signed viewing-token access.
- Video length max: 60 seconds. Browser POST limit: **100 MiB**, compared with
  Cloudflare basic POST maximum of 200 MB; larger/resumable uploads will use tus later.
- An advisory-locked RPC limits reservations to **5 attempts per user per rolling 24h**.
  Reservations continue counting on failure; this trades some UX for cost protection.
- Client MIME/size/filename checks only improve UX. Cloudflare is the authority for
  whether the uploaded file is a playable video and <=60 s.

## Setup

1. Create a staging Cloudflare Stream account/billing configuration and an API token
   with Stream Write and Stream Read permissions, scoped to the intended account.
2. Apply `scripts/005_stream_upload_reservations.sql` in the existing
   **staging** Supabase database. Confirm RLS and `reserve_stream_upload` /
   `attach_stream_upload` from an authenticated test user.
3. Set secret server environment values:
   - `CLOUDFLARE_ACCOUNT_ID` (the 32-hex account ID)
   - `CLOUDFLARE_STREAM_API_TOKEN` (do not commit)
   - `SPAKTOK_STREAM_UPLOADS_ENABLED=true` **only after testing**
4. Confirm `GET /api/videos/upload/initiate` returns `{"enabled":true}` after deployment.
   Before configuration it returns false and POST returns 503 without DB writes.
5. For each authenticated short video, POST JSON
   `{"name":"clip.webm","bytes":123456,"mimeType":"video/webm"}`
   to `/api/videos/upload/initiate` from the same-origin browser.
   It returns a one-time upload URL plus a UUID reservation id.
6. POST a `multipart/form-data` request containing the field `file` directly to
   that URL. Poll `/api/videos/upload/status?id=<reservation UUID>` with the
   authenticated cookie. A successfully encoded video becomes `ready_for_review`.

## Not yet implemented

- No moderation/approval interface, public playback or upload-to-feed publication.
- No resumable tus implementation; do not request >100 MiB.
- No automatic cleanup/deletion of failed or abandoned Cloudflare reservations.
  Implement provider cleanup + orphan reconciliation before wide rollout.
- No Google/Apple device end-to-end test against a real Stream account.
- No production database migration is applied by pushing code to Git.
- This uses Supabase for temporary user identity and quota during migration; moving
  those records to Cloudflare D1 requires a separate, tested identity migration.

## Cloudflare references

- https://developers.cloudflare.com/stream/uploading-videos/direct-creator-uploads/
- https://developers.cloudflare.com/api/resources/stream/subresources/direct_upload/methods/create/
- https://developers.cloudflare.com/api/resources/stream/methods/get/
- https://developers.cloudflare.com/stream/viewing-videos/securing-your-stream/
