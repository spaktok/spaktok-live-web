-- Spaktok initial Cloudflare D1 schema.
-- Authentication/session tables are intentionally added in the auth migration.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS profiles (
  id TEXT PRIMARY KEY,
  username TEXT NOT NULL UNIQUE,
  display_name TEXT NOT NULL,
  avatar_url TEXT,
  bio TEXT,
  is_verified INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS conversations (
  id TEXT PRIMARY KEY,
  user_a TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  user_b TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  created_at TEXT NOT NULL DEFAULT (datetime('now')),
  updated_at TEXT NOT NULL DEFAULT (datetime('now')),
  CHECK (user_a <> user_b),
  UNIQUE (user_a, user_b)
);

CREATE TABLE IF NOT EXISTS messages (
  id TEXT PRIMARY KEY,
  conversation_id TEXT NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
  sender_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  kind TEXT NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'voice', 'view-once', 'system')),
  content TEXT,
  media_key TEXT,
  duration_sec INTEGER,
  is_opened INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS notifications (
  id TEXT PRIMARY KEY,
  recipient_id TEXT NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  actor_id TEXT REFERENCES profiles(id) ON DELETE CASCADE,
  type TEXT NOT NULL CHECK (type IN ('like', 'comment', 'follow', 'mention', 'live', 'system')),
  is_read INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS conversations_user_a_idx ON conversations(user_a, updated_at DESC);
CREATE INDEX IF NOT EXISTS conversations_user_b_idx ON conversations(user_b, updated_at DESC);
CREATE INDEX IF NOT EXISTS messages_conversation_idx ON messages(conversation_id, created_at DESC);
CREATE INDEX IF NOT EXISTS notifications_recipient_idx ON notifications(recipient_id, is_read, created_at DESC);
