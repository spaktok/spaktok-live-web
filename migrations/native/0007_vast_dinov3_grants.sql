-- DINOv3 gated model access is only for an approved GPU agent, temporarily.
-- No HF credential is stored in D1 or GitHub.
CREATE TABLE IF NOT EXISTS vast_model_grants (
 device_id TEXT NOT NULL REFERENCES vast_agent_devices(device_id),
 model_id TEXT NOT NULL CHECK(model_id='facebook/dinov3-vitl16-pretrain-lvd1689m'),
 expires_at INTEGER NOT NULL,
 enabled INTEGER NOT NULL DEFAULT 1 CHECK(enabled IN (0,1)),
 created_at INTEGER NOT NULL,
 PRIMARY KEY (device_id,model_id)
);
CREATE INDEX IF NOT EXISTS idx_vast_model_grants_expiry ON vast_model_grants(enabled,expires_at);
