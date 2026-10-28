-- Spaktok Word Rodin authoring tasks, private by creator. Do not publish
-- generated results without independent rig/visual/rights QA.
-- Apply to existing spaktok-primary D1 only after review and worker secrets.
CREATE TABLE IF NOT EXISTS word_rodin_jobs (
 id TEXT PRIMARY KEY NOT NULL,
 user_id TEXT NOT NULL,
 idempotency_key TEXT NOT NULL,
 status TEXT NOT NULL DEFAULT 'queued'
  CHECK (status IN ('queued','submitting','submission_uncertain',
   'processing','polling','needs_review','failed')),
 tier TEXT NOT NULL,
 mesh_mode TEXT NOT NULL,
 quality TEXT NOT NULL,
 material TEXT NOT NULL,
 rights TEXT NOT NULL CHECK (rights IN ('original','licensed')),
 approved_credits REAL NOT NULL CHECK (approved_credits>0 AND approved_credits<=100),
 source_key TEXT NOT NULL,
 source_type TEXT NOT NULL CHECK (source_type IN ('image/png','image/jpeg')),
 source_bytes INTEGER NOT NULL CHECK (source_bytes BETWEEN 128 AND 8388608),
 provider_uuid TEXT,
 subscription_key TEXT,
 result_key TEXT,
 error_code TEXT NOT NULL DEFAULT '',
 next_check_at TEXT,
 tries INTEGER NOT NULL DEFAULT 0,
 created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
 UNIQUE (user_id,idempotency_key)
);
CREATE INDEX IF NOT EXISTS idx_word_rodin_owner
 ON word_rodin_jobs(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS idx_word_rodin_poll
 ON word_rodin_jobs(status,next_check_at);
