# SpakTok adaptive streaming — integration, October 2026

## What is live in this commit

- Legacy video URLs (MP4, WebM, existing R2 links) keep using the browser native player.
- An existing video's `media_url` may point to a complete **HLS master manifest**
  (URL whose path ends in `.m3u8`, including time-limited signed query params).
  No schema migration is required for the player.
- HLS.js loads only for an active HLS reel on supporting MSE browsers.
  Apple devices with native support use native HLS.
- Automatic level selection uses measured bandwidth and player dimensions.
  Save-Data/restricted connections request a low initial level and small buffer.
- Inactive HLS instances are destroyed, so they do not continue segment downloads.
- HLS manifests cannot be downloaded as `.mp4` via the old download button.
- Fatal stream errors show a manual retry action; never silently loop network traffic.

## Infrastructure required before claiming multi-resolution playback

An HLS URL is a *playlist*, not an encoded video. A transcoder/provider must
produce multiple encoded representations (e.g. 360p, 720p, 1080p, device
and aspect-ratio dependent) and a master manifest. Cloudflare Stream offers
this, but will **bill** for storage/delivery. For a custom R2 pipeline, upload
processed HLS segments and playlists and configure CORS and delivery
cache policies appropriately.

For Cloudflare Stream, use the per-video URL supplied by the dashboard/API:
`https://customer-<CODE>.cloudflarestream.com/<UID>/manifest/video.m3u8`
Never invent a customer code, UID, token or Cloudflare binding. Read manifests
from their provider directly; Cloudflare advises against caching them yourself.

Signed URLs and restricted videos require separate auth/authorization review.
Do not add public access to private video data. Use staging accounts and files,
confirm decoding on Safari/Chrome/Android, and benchmark bandwidth/quality.

## Package manager note

The project already contains diverging `bun.lock` and `pnpm-lock.yaml`.
This change pins `hls.js@1.7.3` in package.json; the connected Vercel project
currently runs `bun install` automatically. Regenerate and commit both
locks with the chosen package manager in a separate, controlled migration
before enabling frozen-lockfile builds. Do not edit lock integrity hashes by hand.

## Validation

- Vercel production build must report READY.
- Exercise old MP4 videos, a real Cloudflare Stream HLS video and a broken manifest.
- Test playback and cleanup while rapidly scrolling between reels.
- Confirm quality changes under throttling and Save-Data.
- Use `?perf=1` to compare startup/rebuffer before and after rollout.
