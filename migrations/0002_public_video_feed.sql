-- D1 public-video catalog. Staging only; apply after 0001_initial.sql.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL,
  thumbnail_url TEXT,
  description TEXT NOT NULL DEFAULT '',
  music TEXT,
  view_count INTEGER NOT NULL DEFAULT 0 CHECK(view_count >= 0),
  like_count INTEGER NOT NULL DEFAULT 0 CHECK(like_count >= 0),
  comment_count INTEGER NOT NULL DEFAULT 0 CHECK(comment_count >= 0),
  share_count INTEGER NOT NULL DEFAULT 0 CHECK(share_count >= 0),
  status TEXT NOT NULL DEFAULT 'processing' CHECK(status IN ('processing','review','published','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS videos_public_feed_idx ON videos(status,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS videos_creator_idx ON videos(user_id,created_at DESC);
