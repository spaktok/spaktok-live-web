-- Safe, auditable setup tasks for owner-rented Vast.ai GPU.
-- Separate table preserves original v1 job ledger and its CHECK constraint.
-- No arbitrary shell/API command field; tasks are explicitly enumerated.
CREATE TABLE IF NOT EXISTS vast_setup_jobs (
  id TEXT NOT NULL PRIMARY KEY,
  device_id TEXT NOT NULL REFERENCES vast_agent_devices(device_id),
  action TEXT NOT NULL CHECK(action IN
    ('probe_environment','fetch_trellis2_source','prepare_trellis2_runtime')),
  state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN
    ('queued','leased','succeeded','failed','cancelled')),
  approved_compute INTEGER NOT NULL DEFAULT 0 CHECK(approved_compute IN (0,1)),
  created_at INTEGER NOT NULL,
  lease_until INTEGER,
  finished_at INTEGER,
  result_json TEXT,
  error_code TEXT
);
CREATE INDEX IF NOT EXISTS idx_vast_setup_claim
 ON vast_setup_jobs(device_id,state,created_at);
