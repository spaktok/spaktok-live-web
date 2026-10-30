-- Global account-level free-neuron planning budget (not a billing source of truth).
-- Avoid sending user text, identities or GLB hashes into this table.
-- Reserved neurons are pessimistic and released on every completion.
CREATE TABLE IF NOT EXISTS director_ai_daily_usage (
  day TEXT PRIMARY KEY CHECK(length(day)=10),
  spent_neurons REAL NOT NULL DEFAULT 0 CHECK(spent_neurons >= 0),
  reserved_neurons REAL NOT NULL DEFAULT 0 CHECK(reserved_neurons >= 0),
  requests INTEGER NOT NULL DEFAULT 0 CHECK(requests >= 0),
  updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);
