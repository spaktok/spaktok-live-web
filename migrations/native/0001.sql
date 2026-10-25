-- SpakTok native data v1. Apply to a NEW empty Cloudflare D1 database.
PRAGMA foreign_keys = ON;
CREATE TABLE IF NOT EXISTS auth_users (
  id TEXT PRIMARY KEY, email TEXT NOT NULL UNIQUE COLLATE NOCASE,
  password_hash TEXT NOT NULL, password_salt TEXT NOT NULL,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES auth_users(id) ON DELETE CASCADE,
  expires_at INTEGER NOT NULL, created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS auth_sessions_user_idx ON auth_sessions(user_id);
CREATE INDEX IF NOT EXISTS auth_sessions_expiry_idx ON auth_sessions(expires_at);
CREATE TABLE IF NOT EXISTS auth_limits (
  id TEXT NOT NULL, bucket INTEGER NOT NULL, hits INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (id, bucket)
);
CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY REFERENCES auth_users(id) ON DELETE CASCADE,
  username TEXT NOT NULL UNIQUE COLLATE NOCASE, display_name TEXT NOT NULL,
  avatar_url TEXT, bio TEXT NOT NULL DEFAULT '', is_verified INTEGER NOT NULL DEFAULT 0,
  follower_count INTEGER NOT NULL DEFAULT 0,
  following_count INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS videos (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL, thumbnail_url TEXT, description TEXT NOT NULL DEFAULT '',
  music TEXT, view_count INTEGER NOT NULL DEFAULT 0, like_count INTEGER NOT NULL DEFAULT 0,
  comment_count INTEGER NOT NULL DEFAULT 0, share_count INTEGER NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'review' CHECK(status IN ('review','published','rejected')),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS videos_feed_idx ON videos(status,created_at DESC,id DESC);
CREATE INDEX IF NOT EXISTS videos_user_idx ON videos(user_id,created_at DESC);
CREATE TABLE IF NOT EXISTS follows (
  follower_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  following_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(follower_id,following_id),
  CHECK(follower_id <> following_id)
);
CREATE INDEX IF NOT EXISTS follows_following_idx ON follows(following_id);
CREATE TABLE IF NOT EXISTS likes (
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY(user_id,video_id)
);
CREATE TABLE IF NOT EXISTS bookmarks (
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  PRIMARY KEY(user_id,video_id)
);
CREATE TABLE IF NOT EXISTS comments (
  id TEXT PRIMARY KEY,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  video_id TEXT NOT NULL REFERENCES videos(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK(length(content) BETWEEN 1 AND 500),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS comments_video_idx ON comments(video_id,created_at);
CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE TABLE IF NOT EXISTS conversation_participants (
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  PRIMARY KEY(conversation_id,user_id)
);
CREATE INDEX IF NOT EXISTS conversations_by_user ON conversation_participants(user_id,conversation_id);
CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY, conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  content TEXT NOT NULL CHECK(length(content) BETWEEN 1 AND 2000),
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id,created_at DESC);
CREATE TABLE IF NOT EXISTS stories (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  media_url TEXT NOT NULL, media_type TEXT NOT NULL CHECK(media_type IN ('image','video')),
  expires_at TEXT NOT NULL, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS stories_expiry_idx ON stories(expires_at);
CREATE TABLE IF NOT EXISTS stream_uploads (
  id TEXT PRIMARY KEY, user_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  stream_uid TEXT UNIQUE, created_at TEXT NOT NULL DEFAULT (datetime('now'))
);
