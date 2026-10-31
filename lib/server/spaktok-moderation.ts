import 'server-only'
import { randomUUID } from 'node:crypto'
import { batchD1, oneD1, queryD1, validId } from '@/lib/native/d1'
import {
  canAppeal, type AppealStatus, type DecisionInput, type ReportInput, type ReportStatus, type ReportTarget,
} from '@/lib/moderation/spaktok-report-rules'

export function moderatorId(): string | null {
  const id = process.env.SPAKTOK_ADMIN_USER_ID
  return process.env.SPAKTOK_MODERATION_ENABLED === 'true' && validId(id) ? id.toLowerCase() : null
}

const OWNER_SQL: Record<ReportTarget, string> = {
  video: 'SELECT user_id AS owner FROM videos WHERE id=?',
  comment: 'SELECT user_id AS owner FROM comments WHERE id=?',
  user: 'SELECT id AS owner FROM profiles WHERE id=?',
  live: 'SELECT id AS owner FROM profiles WHERE id=?',
}

const audit = (reportId: string, actor: string, event: string, detail = '') => ({
  sql: 'INSERT INTO moderation_audit(id,report_id,actor_id,event,detail,created_at_ms) VALUES (?,?,?,?,?,?)',
  params: [randomUUID(), reportId, actor, event, detail, Date.now()],
})

type CreateResult = { ok: true; id: string } | { ok: false; error: 'target_not_found' | 'self_report' | 'already_reported' }

export async function createReport(reporterId: string, input: ReportInput): Promise<CreateResult> {
  const target = await oneD1<{ owner: string }>(OWNER_SQL[input.targetType], [input.targetId])
  if (!target) return { ok: false, error: 'target_not_found' }
  if (target.owner === reporterId) return { ok: false, error: 'self_report' }
  const id = randomUUID()
  const { changes } = await queryD1(
    `INSERT INTO content_reports(id,reporter_id,target_type,target_id,target_owner_id,category,explanation,created_at_ms)
     VALUES (?,?,?,?,?,?,?,?) ON CONFLICT(reporter_id,target_type,target_id) DO NOTHING`,
    [id, reporterId, input.targetType, input.targetId, target.owner, input.category, input.explanation, Date.now()],
  )
  if (!changes) return { ok: false, error: 'already_reported' }
  await batchD1([audit(id, reporterId, 'reported', input.category)])
  return { ok: true, id }
}

interface ReportRow extends Record<string, unknown> {
  id: string; reporter_id: string; target_type: ReportTarget; target_id: string; target_owner_id: string | null
  category: string; explanation: string; status: ReportStatus; created_at_ms: number; decided_at_ms: number | null
  decision_action: string | null; decision_ground: string | null; decision_reason: string | null
  appeal_text: string | null; appeal_by: string | null; appeal_status: AppealStatus; appeal_reason: string | null
}
const COLS = `id,reporter_id,target_type,target_id,target_owner_id,category,explanation,status,created_at_ms,
  decided_at_ms,decision_action,decision_ground,decision_reason,appeal_text,appeal_by,appeal_status,appeal_reason`

const toPublic = (r: ReportRow, viewer: string) => ({
  id: r.id, targetType: r.target_type, targetId: r.target_id, category: r.category,
  role: r.reporter_id === viewer ? 'reporter' as const : 'owner' as const,
  status: r.status, createdAtMs: Number(r.created_at_ms),
  decidedAtMs: r.decided_at_ms === null ? null : Number(r.decided_at_ms),
  decision: r.status === 'open' ? null : { action: r.decision_action, ground: r.decision_ground, reason: r.decision_reason },
  appealStatus: r.appeal_status, appealReason: r.appeal_reason,
  canAppeal: canAppeal({ status: r.status, decidedAtMs: r.decided_at_ms === null ? null : Number(r.decided_at_ms), appealStatus: r.appeal_status }, Date.now()),
})

/** Reporter sees their notices; the content owner sees decisions taken against them (Art. 17). */
export async function listMine(userId: string) {
  const { rows } = await queryD1<ReportRow>(
    `SELECT ${COLS} FROM content_reports WHERE reporter_id=? OR (target_owner_id=? AND status<>'open')
     ORDER BY created_at_ms DESC LIMIT 50`, [userId, userId])
  return rows.map(r => toPublic(r, userId))
}

export async function fileAppeal(userId: string, reportId: string, text: string): Promise<'ok' | 'not_found' | 'not_appealable'> {
  const r = await oneD1<ReportRow>(`SELECT ${COLS} FROM content_reports WHERE id=? AND (reporter_id=? OR target_owner_id=?)`,
    [reportId, userId, userId])
  if (!r) return 'not_found'
  const decided = r.decided_at_ms === null ? null : Number(r.decided_at_ms)
  if (!canAppeal({ status: r.status, decidedAtMs: decided, appealStatus: r.appeal_status }, Date.now())) return 'not_appealable'
  // Only the affected party may contest: the owner after action, the reporter after dismissal.
  if ((r.status === 'actioned' ? r.target_owner_id : r.reporter_id) !== userId) return 'not_appealable'
  const { changes } = await queryD1(
    `UPDATE content_reports SET appeal_status='pending',appeal_text=?,appeal_by=? WHERE id=? AND appeal_status='none'`,
    [text, userId, reportId])
  if (!changes) return 'not_appealable'
  await batchD1([audit(reportId, userId, 'appealed')])
  return 'ok'
}

export async function moderationQueue() {
  const { rows } = await queryD1<ReportRow>(
    `SELECT ${COLS} FROM content_reports WHERE status='open' OR appeal_status='pending'
     ORDER BY CASE WHEN category='child_safety' THEN 0 WHEN category='illegal_content' THEN 1 ELSE 2 END, created_at_ms LIMIT 50`)
  return rows.map(r => ({
    id: r.id, targetType: r.target_type, targetId: r.target_id, category: r.category, explanation: r.explanation,
    status: r.status, createdAtMs: Number(r.created_at_ms), decisionReason: r.decision_reason,
    appealStatus: r.appeal_status, appealText: r.appeal_text,
  }))
}

/** Only videos are enforced automatically; other targets get a recorded decision for manual action. */
function enforcement(r: ReportRow, hide: boolean) {
  if (r.target_type !== 'video') return []
  return [{ sql: 'UPDATE videos SET status=? WHERE id=?', params: [hide ? 'removed' : 'published', r.target_id] }]
}

export async function decide(actor: string, d: DecisionInput): Promise<'ok' | 'not_found'> {
  const r = await oneD1<ReportRow>(`SELECT ${COLS} FROM content_reports WHERE id=? AND status='open'`, [d.reportId])
  if (!r) return 'not_found'
  await batchD1([
    { sql: `UPDATE content_reports SET status=?,decided_at_ms=?,decision_action=?,decision_ground=?,decision_reason=? WHERE id=? AND status='open'`,
      params: [d.action === 'none' ? 'dismissed' : 'actioned', Date.now(), d.action, d.ground, d.reason, d.reportId] },
    ...(d.action === 'remove' ? enforcement(r, true) : []),
    audit(d.reportId, actor, 'decided', `${d.action}:${d.ground}`),
  ])
  return 'ok'
}

export async function decideAppeal(actor: string, reportId: string, outcome: 'upheld' | 'reversed', reason: string):
  Promise<'ok' | 'not_found' | 'self_review'> {
  const r = await oneD1<ReportRow>(`SELECT ${COLS} FROM content_reports WHERE id=? AND appeal_status='pending'`, [reportId])
  if (!r) return 'not_found'
  if (r.appeal_by === actor) return 'self_review'
  const reverse = outcome === 'reversed'
  await batchD1([
    { sql: `UPDATE content_reports SET appeal_status=?,appeal_reason=?,appeal_decided_at_ms=? WHERE id=? AND appeal_status='pending'`,
      params: [outcome, reason, Date.now(), reportId] },
    ...(reverse && r.decision_action === 'remove' ? enforcement(r, false) : []),
    audit(reportId, actor, 'appeal_' + outcome),
  ])
  return 'ok'
}
