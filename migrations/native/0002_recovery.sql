-- D1 account recovery. Apply after 0001.sql, to the NEW Cloudflare database.
ALTER TABLE auth_users ADD COLUMN recovery_hash TEXT;
ALTER TABLE auth_users ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
ALTER TABLE auth_sessions ADD COLUMN auth_version INTEGER NOT NULL DEFAULT 0;
CREATE INDEX IF NOT EXISTS auth_recovery_idx ON auth_users(recovery_hash);
