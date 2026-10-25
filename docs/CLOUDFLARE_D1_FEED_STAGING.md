# SpakTok Cloudflare D1 feed (staging only)

This branch adds a **public, unpersonalized metadata-only feed** at `GET /api/cloudflare/feed`.
It does not switch the main application from Supabase; the existing `/api/feed`
and `components/spaktok/video-feed.tsx` remain unchanged.

## Setup (do not deploy to production)

1. Provision a dedicated Cloudflare **staging** D1 database.
2. In staging Wrangler config, add a D1 binding named `DB` with the real
   database UUID. Do not commit secrets or fake UUIDs.
3. Apply `migrations/0001_initial.sql`, then `0002_public_video_feed.sql`
   in staging after taking a backup. Confirm published records have a reviewed,
   **public** media URL; keep uploads unpublished by default.
4. Run project checks: `pnpm install --frozen-lockfile`, `pnpm test`,
   and `pnpm run cf:build`. These checks require project dependencies.
5. Try `/api/cloudflare/feed?limit=12` in staging, check `nextCursor`,
   then load another page using `?cursor=...`.
6. Verify absent DB fails closed with 503; invalid cursor gives 400;
   media requiring user authorization is **never** exposed here.

This release intentionally leaves `wrangler.jsonc` unchanged: the configured
production Worker has no known D1 binding ID, and guessed identifiers are unsafe.
The read-only endpoint remains disabled (503) unless staging has a real DB binding.

## Next phases

Separate, isolated Cloudflare sign-up/session pilot and private R2 upload
staging are prepared in local Phase 3/4 bundles, but should only be added after
review, tests, and verified infrastructure configuration. User migration,
GDPR controls, password recovery, video moderation and adaptive encoding are
outstanding. Do not delete Supabase or repoint DNS based on this commit.
