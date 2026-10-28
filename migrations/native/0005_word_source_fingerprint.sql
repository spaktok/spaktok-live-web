-- Distinguish an intentional retry of the SAME image from key reuse with
-- different private reference bytes. Execute only once after 0004.
ALTER TABLE word_rodin_jobs ADD COLUMN source_sha256 TEXT;
CREATE INDEX IF NOT EXISTS idx_word_rodin_status_created
 ON word_rodin_jobs(status,created_at);
