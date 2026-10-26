-- Additive private R2 upload tracking; existing tables remain untouched.
CREATE TABLE IF NOT EXISTS media_uploads (
 id TEXT PRIMARY KEY,
 user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
 object_key TEXT NOT NULL UNIQUE,
 nonce TEXT NOT NULL UNIQUE,
 bytes INTEGER NOT NULL CHECK(bytes BETWEEN 1024 AND 20971520),
 mime_type TEXT NOT NULL CHECK(mime_type IN ('video/mp4','video/webm')),
 status TEXT NOT NULL DEFAULT 'issued' CHECK(status IN ('issued','uploaded','rejected')),
 created_at TEXT NOT NULL DEFAULT (datetime('now')),
 uploaded_at TEXT
);
CREATE INDEX IF NOT EXISTS media_uploads_by_user ON media_uploads(user_id,created_at DESC);
CREATE INDEX IF NOT EXISTS media_uploads_status ON media_uploads(status,created_at);
