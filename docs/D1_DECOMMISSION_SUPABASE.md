# D1 transition - legacy provider retired in active Next routes

The original Supabase project was permanently deleted by the owner. We do not
attempt to authenticate against it. All newly configured user data is stored
in Cloudflare D1; the Next.js app still runs on Vercel.

## Still incomplete before public availability
- No Cloudflare D1 database, API token, or auth secrets are connected to this
  project yet. Do not claim that login is working.
- Old account IDs, passwords, media and chat histories cannot be imported
  without an independent backup.
- Registration is invite-only; email verification and password reset must be
  built before broad launch.
- Real-time chat, voice messages and encrypted ephemeral media are not yet
  available; text chat uses a D1 query/polling adapter.
- R2 uploads, transcoding and publish/moderation workflows are not active;
  prior Cloudflare Stream (paid) pilot is disabled in the free transition.
- Store only manually reviewed public media URLs in the `videos` table;
  newly inserted videos are `review` by default.
- Retired `/api/cloudflare/messages` and `/api/cloudflare/conversations` now
  return HTTP 410; UI uses the native text chat endpoint.
- The old Supabase OAuth callback is retired; email reset links won't work.
- Stripe remains a separate optional paid payment integration; not Supabase.
- Run full tests and actual D1 integration tests before the public launch.
