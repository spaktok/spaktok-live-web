-- Additive schema for owner-private Spaktok Studio GLB drafts.
-- The R2 objects are not public; each UUID is scoped to the authenticated owner.
-- Applies to spaktok-primary D1. Safe to re-run; do not drop media tables.
CREATE TABLE IF NOT EXISTS studio_asset_drafts (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL,
 object_key TEXT NOT NULL UNIQUE,
 sha256 TEXT NOT NULL CHECK(length(sha256)=64),
 bytes INTEGER NOT NULL CHECK(bytes >= 28 AND bytes <= 15728640),
 rights TEXT NOT NULL CHECK(rights IN ('original','licensed')),
 targets_json TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'issued'
  CHECK(status IN ('issued','stored','failed')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 confirmed_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_studio_drafts_owner_created
 ON studio_asset_drafts(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_studio_drafts_owner_status
 ON studio_asset_drafts(user_id,status);
