# For You ranking — 2026-11-03

Before this change `GET /api/feed?source=forYou` ordered videos strictly by
`created_at DESC`, so it behaved like a chronological channel rather than a
recommendation feed. This slice adds a deterministic ranking pass over a
bounded candidate window.

## What changed

- `lib/feed/ranking.ts` — pure scoring, diversity and keyset paging.
  - Engagement is log-damped and weighted: likes ×3, comments ×5, shares ×6,
    plus a small prior so a new upload is never scored into a dead zone.
  - Recency halves reach every 36 hours (`0.35 + 0.65 × recency`).
  - Exploration: videos under 2 hours get ×1.6, under 12 hours ×1.25, so new
    creators still receive first impressions.
  - Quality: like-rate against views (8% treated as excellent), neutral under
    50 views to avoid judging tiny samples.
  - Affinity: already-followed creators ×1.35, verified ×1.05.
  - Author diversity: never more than two consecutive videos from one creator.
    Nothing is dropped, only reordered.
- `lib/feed/rank-cursor.ts` — opaque, validated cursor carrying
  `(score, id, at)`. Pinning `at` keeps later pages scored against the same
  clock, which is what makes keyset paging exact.
- `app/api/feed/route.ts` — `forYou` scores at most 300 published videos from a
  21-day lookback and returns the requested page. `following` stays
  chronological, and a shared `videoId` deep link still resolves one video.

## Personalisation from real likes

- `lib/feed/interests.ts` — builds a viewer interest profile from the hashtags of
  the last 40 videos that viewer liked, decayed with a 72-hour half-life
  (`likes  join videos` on the `likes` primary key, newest first).
  Weights are normalised to the strongest interest, capped at 20 tags, so one
  binge cannot permanently define the feed.
- Content sharing those interests gains up to +18% (9% per unit of matched
  interest weight). It is a lift, never a filter: unknown topics still compete.
- The interest read is best-effort. If that query fails the feed still renders
  with the non-personalised ranking instead of erroring.
- Anonymous viewers, and viewers with no likes, keep the follow/engagement/
  freshness ranking unchanged.

## Explicit limits (do not overstate this)

- No watch-time, completion-rate or skip signal exists, so interests are
  inferred from likes only; a silent viewer is still unpersonalised.
- There is no "already seen" memory, so a refreshed feed can show the same
  videos again in a new order.
- Cold start for a brand-new viewer is the same as for everyone else.
- Interest matching is hashtag-based: captions without hashtags carry no
  topic signal.
- Candidate cap 300 / 21 days is a deliberate cost bound, not a full corpus
  scan. Older videos are reachable through profiles and search, not For You.
- No anti-manipulation work (coordinated likes, view inflation) is included.
  Counts are trusted as stored.

## Evidence

`lib/feed/ranking.test.ts`, `lib/feed/rank-cursor.test.ts` and
`app/api/feed/route.test.ts` cover scoring bounds, engagement vs freshness,
like-rate quality, follow boost, determinism, author diversity, cursor
tampering and full pagination without repeats. No deployment, D1 migration or
secret change was executed for this slice.
