# Feed modes — October 2026

- `source=forYou` preserves the current public chronological feed.
- `source=following` uses verified Supabase identity and nested PostgREST
  `!inner` joins on `profiles` and `follows!follows_following_id_fkey` to
  include **only** creators followed by the authenticated user.
- Both feed modes share keyset cursor pagination. Changing tabs remounts
  the feed and aborts in-flight page requests.
- Invalid modes return 400; anonymous following returns 401; query failure returns
  503 **without** falling back to public results.
- No database migration or new paid service is required for this step,
  assuming production uses `scripts/001_init_schema.sql` relations.
- Database FK names and query plans must be checked against the real production
  schema and tested with two accounts before marking functional acceptance.
- The "forYou" feed is **not yet an AI-ranking feed**; it remains chronological.
- Video metrics/ABR transcode remain future work, not claims about shipped code.
