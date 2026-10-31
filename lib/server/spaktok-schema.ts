import 'server-only'
import { batchD1 } from '@/lib/native/d1'

// Mirrors cloudflare/migrations/20261031_*.sql. Every statement is idempotent
// (IF NOT EXISTS), so applying it on first use is safe when the migration was
// already run by hand. The signing key only exists in Vercel, so this is the
// path that brings a fresh D1 up to date without a manual wrangler step.
const SCHEMAS = {
  pk: [
    `CREATE TABLE IF NOT EXISTS pk_battles (id TEXT PRIMARY KEY, host_id TEXT NOT NULL, guest_id TEXT NOT NULL CHECK(guest_id <> host_id), rounds INTEGER NOT NULL CHECK(rounds IN (3,5)), round_seconds INTEGER NOT NULL CHECK(round_seconds IN (60,120,180)), status TEXT NOT NULL DEFAULT 'invited' CHECK(status IN ('invited','active','declined','cancelled')), created_at_ms INTEGER NOT NULL, started_at_ms INTEGER, ended_by TEXT)`,
    'CREATE INDEX IF NOT EXISTS idx_pk_host ON pk_battles(host_id,created_at_ms DESC)',
    'CREATE INDEX IF NOT EXISTS idx_pk_guest ON pk_battles(guest_id,created_at_ms DESC)',
    'CREATE INDEX IF NOT EXISTS idx_pk_status ON pk_battles(status,started_at_ms DESC)',
    `CREATE TABLE IF NOT EXISTS pk_votes (battle_id TEXT NOT NULL, round INTEGER NOT NULL CHECK(round BETWEEN 1 AND 5), voter_id TEXT NOT NULL, side TEXT NOT NULL CHECK(side IN ('host','guest')), created_at_ms INTEGER NOT NULL, PRIMARY KEY(battle_id,round,voter_id))`,
    'CREATE INDEX IF NOT EXISTS idx_pk_votes_tally ON pk_votes(battle_id,round,side)',
  ],
  reports: [
    `CREATE TABLE IF NOT EXISTS content_reports (id TEXT PRIMARY KEY, reporter_id TEXT NOT NULL, target_type TEXT NOT NULL CHECK(target_type IN ('video','comment','user','live')), target_id TEXT NOT NULL, target_owner_id TEXT, category TEXT NOT NULL, explanation TEXT NOT NULL DEFAULT '', status TEXT NOT NULL DEFAULT 'open' CHECK(status IN ('open','actioned','dismissed')), created_at_ms INTEGER NOT NULL, decided_at_ms INTEGER, decision_action TEXT CHECK(decision_action IN ('remove','restrict','none')), decision_ground TEXT CHECK(decision_ground IN ('illegal','terms','none')), decision_reason TEXT, appeal_text TEXT, appeal_by TEXT, appeal_status TEXT NOT NULL DEFAULT 'none' CHECK(appeal_status IN ('none','pending','upheld','reversed')), appeal_reason TEXT, appeal_decided_at_ms INTEGER, UNIQUE(reporter_id,target_type,target_id))`,
    'CREATE INDEX IF NOT EXISTS idx_reports_queue ON content_reports(status,created_at_ms)',
    'CREATE INDEX IF NOT EXISTS idx_reports_appeals ON content_reports(appeal_status,created_at_ms)',
    'CREATE INDEX IF NOT EXISTS idx_reports_reporter ON content_reports(reporter_id,created_at_ms DESC)',
    'CREATE INDEX IF NOT EXISTS idx_reports_owner ON content_reports(target_owner_id,decided_at_ms DESC)',
    `CREATE TABLE IF NOT EXISTS moderation_audit (id TEXT PRIMARY KEY, report_id TEXT NOT NULL, actor_id TEXT NOT NULL, event TEXT NOT NULL, detail TEXT NOT NULL DEFAULT '', created_at_ms INTEGER NOT NULL)`,
    'CREATE INDEX IF NOT EXISTS idx_mod_audit_report ON moderation_audit(report_id,created_at_ms)',
  ],
} as const

export type SchemaName = keyof typeof SCHEMAS
export const schemaStatements = (name: SchemaName): readonly string[] => SCHEMAS[name]

const pending = new Map<SchemaName, Promise<void>>()

export function ensureSchema(name: SchemaName): Promise<void> {
  let run = pending.get(name)
  if (!run) {
    run = batchD1(SCHEMAS[name].map(sql => ({ sql, params: [] })))
    // Forget failures so the next request retries instead of caching the error.
    run.catch(() => pending.delete(name))
    pending.set(name, run)
  }
  return run
}
