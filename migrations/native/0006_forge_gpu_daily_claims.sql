-- Spaktok Forge optional operator-GPU generation.
-- One reserved paid GPU inference per authenticated owner per UTC day.
-- Claim is atomic, retains an audit trail but stores NO source photo.
-- Operators may raise capacity only through a separately reviewed migration.
CREATE TABLE IF NOT EXISTS forge_gpu_daily_claims(
 owner_id TEXT NOT NULL,
 day_utc TEXT NOT NULL,
 job_id TEXT NOT NULL UNIQUE,
 image_sha256 TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'reserved'
  CHECK(status IN ('reserved','succeeded','upstream_failed','invalid_result')),
 created_at INTEGER NOT NULL DEFAULT (unixepoch()),
 completed_at INTEGER,
 PRIMARY KEY(owner_id,day_utc)
);
CREATE INDEX IF NOT EXISTS idx_forge_gpu_claims_recent
 ON forge_gpu_daily_claims(created_at DESC);
