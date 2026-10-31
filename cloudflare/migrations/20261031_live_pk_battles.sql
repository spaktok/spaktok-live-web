-- Additive schema for server-authoritative PK battles (spaktok-primary D1).
-- Clock is derived from started_at_ms; votes are one per viewer per round.
-- No coins or gifts: scores are free viewer votes until a payment ledger exists.
CREATE TABLE IF NOT EXISTS pk_battles (
 id TEXT PRIMARY KEY,
 host_id TEXT NOT NULL,
 guest_id TEXT NOT NULL CHECK(guest_id <> host_id),
 rounds INTEGER NOT NULL CHECK(rounds IN (3,5)),
 round_seconds INTEGER NOT NULL CHECK(round_seconds IN (60,120,180)),
 status TEXT NOT NULL DEFAULT 'invited'
  CHECK(status IN ('invited','active','declined','cancelled')),
 created_at_ms INTEGER NOT NULL,
 started_at_ms INTEGER,
 ended_by TEXT
);
CREATE INDEX IF NOT EXISTS idx_pk_host ON pk_battles(host_id,created_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_pk_guest ON pk_battles(guest_id,created_at_ms DESC);
CREATE INDEX IF NOT EXISTS idx_pk_status ON pk_battles(status,started_at_ms DESC);
CREATE TABLE IF NOT EXISTS pk_votes (
 battle_id TEXT NOT NULL,
 round INTEGER NOT NULL CHECK(round BETWEEN 1 AND 5),
 voter_id TEXT NOT NULL,
 side TEXT NOT NULL CHECK(side IN ('host','guest')),
 created_at_ms INTEGER NOT NULL,
 PRIMARY KEY(battle_id,round,voter_id)
);
CREATE INDEX IF NOT EXISTS idx_pk_votes_tally ON pk_votes(battle_id,round,side);
