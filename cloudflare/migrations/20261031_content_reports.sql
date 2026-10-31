-- Additive DSA notice-and-action schema (spaktok-primary D1).
-- One report per reporter per target; decisions carry a statement of reasons;
-- one internal complaint (appeal) per decision. Audit rows are append-only.
CREATE TABLE IF NOT EXISTS content_reports (
 id TEXT PRIMARY KEY,
 reporter_id TEXT NOT NULL,
 target_type TEXT NOT NULL CHECK(target_type IN ('video','comment','user','live')),
 target_id TEXT NOT NULL,
 target_owner_id TEXT,
 category TEXT NOT NULL,
 explanation TEXT NOT NULL DEFAULT '',
 status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','actioned','dismissed')),
 created_at_ms INTEGER NOT NULL,
 decided_at_ms INTEGER,
 decision_action TEXT CHECK(decision_action IN ('remove','restrict','none')),
 decision_ground TEXT CHECK(decision_ground IN ('illegal','terms','none')),
 decision_reason TEXT,
 appeal_text TEXT,
 appeal_by TEXT,
 appeal_status TEXT NOT NULL DEFAULT 'none' CHECK(appeal_status IN ('none','pending','upheld','reversed')),
 appeal_reason TEXT,
 appeal_decided_at_ms INTEGER,
 UNIQUE(reporter_id,target_type,target_id)
);
CREATE INDEX IF NOT EXISTS idx_reports_queue ON content_reports(status,created_at_ms);
CREATE INDEX IF NOT EXISTS idx_reports_appeals ON content_reports(appeal_status,created_at_ms);
CREATE INDEX IF NOT EXISTS idx_reports_reporter ON content_reports(reporter_id,created_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_reports_owner ON content_reports(target_owner_id,decided_at_ms DESC);
CREATE TABLE IF NOT EXISTS moderation_audit (
 id TEXT PRIMARY KEY,
 report_id TEXT NOT NULL,
 actor_id TEXT NOT NULL,
 event TEXT NOT NULL,
 detail TEXT NOT NULL DEFAULT '',
 created_at_ms INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_mod_audit_report ON moderation_audit(report_id,created_at_ms);
