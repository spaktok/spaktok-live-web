-- Exact verified Royal Crown 01 GLB private QA results.
-- The Worker writes one immutable structural result and keeps all assets private.
CREATE TABLE IF NOT EXISTS vast_crown_qa_results (
 asset_id TEXT NOT NULL PRIMARY KEY,
 status TEXT NOT NULL CHECK(status IN ('succeeded','failed')),
 quality_json TEXT NOT NULL,
 completed_at INTEGER NOT NULL,
 error_code TEXT
);
-- Temporary private review download tickets; no general R2 listing/read API.
CREATE TABLE IF NOT EXISTS vast_crown_review_tickets (
 token TEXT PRIMARY KEY NOT NULL CHECK(length(token)=64),
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 used_at INTEGER
);
