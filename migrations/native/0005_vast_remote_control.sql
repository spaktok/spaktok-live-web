-- Spaktok Vast GPU outbound-only control plane.
-- Operator queues actions through authenticated Cloudflare D1 API; no public admin shell.
-- A device generates its own strong bearer secret locally; only its SHA256 is stored.
CREATE TABLE IF NOT EXISTS vast_agent_devices (
 device_id TEXT PRIMARY KEY NOT NULL,
 token_sha256 TEXT NOT NULL CHECK(length(token_sha256)=64),
 pair_code TEXT NOT NULL CHECK(length(pair_code)=8),
 state TEXT NOT NULL DEFAULT 'pending' CHECK(state IN ('pending','approved','revoked')),
 created_at INTEGER NOT NULL,
 expires_at INTEGER NOT NULL,
 last_seen INTEGER
);
CREATE INDEX IF NOT EXISTS idx_vast_devices_state ON vast_agent_devices(state,expires_at);
CREATE TABLE IF NOT EXISTS vast_agent_jobs (
 id TEXT PRIMARY KEY NOT NULL,
 device_id TEXT NOT NULL REFERENCES vast_agent_devices(device_id),
 action TEXT NOT NULL CHECK(action IN ('gpu_info','preflight','diagnose_dinov3','inspect_glb','finalize_glb','generate_one')),
 input_key TEXT,
 input_sha256 TEXT,
 output_key TEXT,
 state TEXT NOT NULL DEFAULT 'queued' CHECK(state IN ('queued','leased','succeeded','failed','cancelled')),
 approved_compute INTEGER NOT NULL DEFAULT 0 CHECK(approved_compute IN (0,1)),
 rights_confirmed INTEGER NOT NULL DEFAULT 0 CHECK(rights_confirmed IN (0,1)),
 created_at INTEGER NOT NULL,
 lease_until INTEGER,
 finished_at INTEGER,
 result_json TEXT,
 error_code TEXT,
 output_sha256 TEXT,
 output_bytes INTEGER,
 FOREIGN KEY(device_id) REFERENCES vast_agent_devices(device_id)
);
CREATE INDEX IF NOT EXISTS idx_vast_job_claim ON vast_agent_jobs(device_id,state,created_at);
