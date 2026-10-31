-- Owner-only one-use upload ticket for the ORIGINAL attached crown PNG.
-- No OAuth tokens or uploaded pixels are stored in D1.
-- The source is private in R2 and NOT served publicly by any endpoint.
CREATE TABLE IF NOT EXISTS vast_crown_01_upload_tickets (
  token_sha256 TEXT NOT NULL PRIMARY KEY CHECK (length(token_sha256)=64),
  expected_sha256 TEXT NOT NULL CHECK (expected_sha256='883e3a1b5e00046f658ae81ffa1cb3c644a6e5ba334b9aacf5d5a370bff5992e'),
  object_key TEXT NOT NULL CHECK (object_key='vast-private/input/royal-crown-01/883e3a1b5e00046f658ae81ffa1cb3c644a6e5ba334b9aacf5d5a370bff5992e.png'),
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL,
  used_at INTEGER,
  rights_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(rights_confirmed IN (0,1))
);
