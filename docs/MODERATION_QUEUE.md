# Private admin moderation queue

This is a read-only administrative pilot. No public publication, playback
token generation, content deletion or approval actions exist yet.

Enabled only if ALL server-side requirements are present:

- `SPAKTOK_MODERATION_ENABLED=true`
- `SPAKTOK_ADMIN_USER_ID=<UUID of an existing authenticated admin account>`
- `SUPABASE_SERVICE_ROLE_KEY` (already used elsewhere in the project;
  MUST remain a server-only secret)
- Existing Supabase staging migration `scripts/005_stream_upload_reservations.sql`

Use `/admin/video-review` after login. The page returns no information
to anonymous visitors or users whose verified identity is not the configured
admin UUID. All service-role database operations occur after the admin check.

The queue only shows reservation IDs, dates, processing states and durations.
Stream videos retain `requireSignedURLs=true` and do not appear in the public
feed. This makes it possible to monitor processing without publishing
unmoderated uploads. Final approval, appeal, takedown, signed preview
and compliance processes must be developed before enabling a public feed.
