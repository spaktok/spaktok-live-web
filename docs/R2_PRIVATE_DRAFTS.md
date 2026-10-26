# R2 private content intake, limited beta

This feature transfers raw recorded videos directly to a new private R2 bucket
`spaktok-private-drafts`, bound to Worker `spaktok-media-upload`.
The D1 database stores reservations in `media_uploads` only. No draft video is
publicly readable, indexed in the feed, served via R2.dev, or approved automatically.

The Worker checks strict production Origin, MIME, Content-Length, a 10-minute
Ed25519 ticket, and atomically consumes the D1 nonce before storing objects.
The Vercel server authenticates the D1 account cookie and limits reservations
to five per user per 24 hours (20 MiB each). No Cloudflare API token is used.

**The R2 bucket uses WEUR as a location hint, NOT EU jurisdiction.** Do not
promise EU-only media storage/processing or GDPR compliance on that basis.
Add verified R2 EU jurisdiction and a formal GDPR assessment before storing
regulated/production user media. For safety this is an opt-in pilot controlled
by `SPAKTOK_R2_UPLOADS_ENABLED=true` (Production server environment variable).

Unfinished before public production:
- Moderation preview, approval, transcoding into HLS, thumbnail generation,
  video publishing, reporting, takedown, DSA/GDPR user deletion, orphan cleanup.
- End-to-end device video upload and Cloudflare live R2 verification.
- Stronger anti-abuse/quotas for large scale, cost controls and alerting.
- The current worker only offers private upload, GET /health, no video playback.
