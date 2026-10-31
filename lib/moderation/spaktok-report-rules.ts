/** Pure rules for DSA notice-and-action (Art. 16), statements of reasons (Art. 17)
 * and internal complaint handling (Art. 20). No I/O so they are unit-testable. */
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export const REPORT_TARGETS = ['video', 'comment', 'user', 'live'] as const
export const REPORT_CATEGORIES = [
  'illegal_content', 'child_safety', 'harassment', 'hate', 'violence',
  'self_harm', 'sexual', 'scam', 'ip_infringement', 'privacy', 'other',
] as const
export const DECISION_ACTIONS = ['remove', 'restrict', 'none'] as const
export const DECISION_GROUNDS = ['illegal', 'terms', 'none'] as const

export type ReportTarget = (typeof REPORT_TARGETS)[number]
export type ReportCategory = (typeof REPORT_CATEGORIES)[number]
export type DecisionAction = (typeof DECISION_ACTIONS)[number]
export type DecisionGround = (typeof DECISION_GROUNDS)[number]
export type ReportStatus = 'open' | 'actioned' | 'dismissed'
export type AppealStatus = 'none' | 'pending' | 'upheld' | 'reversed'

/** Art. 20(1): complaints must be possible for at least six months after the decision. */
export const APPEAL_WINDOW_MS = 183 * 24 * 60 * 60 * 1000
export const EXPLANATION_MAX = 1000
export const REASON_MIN = 20

const oneOf = <T extends string>(list: readonly T[], v: unknown): v is T =>
  typeof v === 'string' && (list as readonly string[]).includes(v)
const text = (v: unknown, max: number) =>
  typeof v === 'string' ? v.replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim().slice(0, max) : ''

export interface ReportInput { targetType: ReportTarget; targetId: string; category: ReportCategory; explanation: string; goodFaith: true }

export function parseReport(body: unknown): ReportInput | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (!oneOf(REPORT_TARGETS, b.targetType) || typeof b.targetId !== 'string' || !UUID.test(b.targetId)) return null
  if (!oneOf(REPORT_CATEGORIES, b.category) || b.goodFaith !== true) return null
  const explanation = text(b.explanation, EXPLANATION_MAX)
  // Art. 16(2)(a): a notice about illegal content needs a substantiated explanation.
  if ((b.category === 'illegal_content' || b.category === 'ip_infringement' || b.category === 'other') && explanation.length < 10) return null
  return { targetType: b.targetType, targetId: b.targetId.toLowerCase(), category: b.category, explanation, goodFaith: true }
}

export interface DecisionInput { reportId: string; action: DecisionAction; ground: DecisionGround; reason: string }

export function parseDecision(body: unknown): DecisionInput | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (typeof b.reportId !== 'string' || !UUID.test(b.reportId)) return null
  if (!oneOf(DECISION_ACTIONS, b.action) || !oneOf(DECISION_GROUNDS, b.ground)) return null
  // Acting requires a legal or contractual ground; dismissing must not claim one.
  if ((b.action === 'none') !== (b.ground === 'none')) return null
  const reason = text(b.reason, 2000)
  if (reason.length < REASON_MIN) return null
  return { reportId: b.reportId.toLowerCase(), action: b.action, ground: b.ground, reason }
}

export function parseAppeal(body: unknown): string | null {
  if (!body || typeof body !== 'object') return null
  const t = text((body as Record<string, unknown>).text, EXPLANATION_MAX)
  return t.length >= 10 ? t : null
}

export interface AppealState { status: ReportStatus; decidedAtMs: number | null; appealStatus: AppealStatus }

export function canAppeal(s: AppealState, now: number): boolean {
  return s.status !== 'open' && s.decidedAtMs !== null && s.appealStatus === 'none' && now - s.decidedAtMs <= APPEAL_WINDOW_MS
}

export function parseAppealDecision(body: unknown): { reportId: string; outcome: 'upheld' | 'reversed'; reason: string } | null {
  if (!body || typeof body !== 'object') return null
  const b = body as Record<string, unknown>
  if (typeof b.reportId !== 'string' || !UUID.test(b.reportId)) return null
  if (b.outcome !== 'upheld' && b.outcome !== 'reversed') return null
  const reason = text(b.reason, 2000)
  if (reason.length < REASON_MIN) return null
  return { reportId: b.reportId.toLowerCase(), outcome: b.outcome, reason }
}
