import { describe, expect, it } from 'vitest'
import { APPEAL_WINDOW_MS, canAppeal, parseAppeal, parseAppealDecision, parseDecision, parseReport } from './spaktok-report-rules'

const id = '6f1c2b3a-4d5e-4f60-8a7b-9c0d1e2f3a4b'

describe('parseReport', () => {
  it('accepts a valid notice and normalizes id case', () => {
    const r = parseReport({ targetType: 'video', targetId: id.toUpperCase(), category: 'harassment', explanation: '', goodFaith: true })
    expect(r?.targetId).toBe(id)
  })
  it('requires the good-faith confirmation', () => {
    expect(parseReport({ targetType: 'video', targetId: id, category: 'hate' })).toBeNull()
  })
  it('requires an explanation for illegal-content notices', () => {
    expect(parseReport({ targetType: 'video', targetId: id, category: 'illegal_content', explanation: 'x', goodFaith: true })).toBeNull()
    expect(parseReport({ targetType: 'video', targetId: id, category: 'illegal_content', explanation: 'Violates StGB 130', goodFaith: true })).not.toBeNull()
  })
  it('rejects unknown targets, categories and ids', () => {
    expect(parseReport({ targetType: 'dm', targetId: id, category: 'hate', goodFaith: true })).toBeNull()
    expect(parseReport({ targetType: 'video', targetId: id, category: 'spam!', goodFaith: true })).toBeNull()
    expect(parseReport({ targetType: 'video', targetId: '1 OR 1=1', category: 'hate', goodFaith: true })).toBeNull()
  })
  it('strips control characters and caps length', () => {
    const r = parseReport({ targetType: 'comment', targetId: id, category: 'other', explanation: '\u0000abc defghij' + 'z'.repeat(2000), goodFaith: true })
    expect(r?.explanation.startsWith('abc')).toBe(true)
    expect(r?.explanation.length).toBe(1000)
  })
})

describe('parseDecision', () => {
  const reason = 'Video shows targeted harassment of a minor.'
  it('requires a ground when acting and forbids one when dismissing', () => {
    expect(parseDecision({ reportId: id, action: 'remove', ground: 'none', reason })).toBeNull()
    expect(parseDecision({ reportId: id, action: 'none', ground: 'terms', reason })).toBeNull()
    expect(parseDecision({ reportId: id, action: 'remove', ground: 'terms', reason })).not.toBeNull()
    expect(parseDecision({ reportId: id, action: 'none', ground: 'none', reason })).not.toBeNull()
  })
  it('requires a substantive statement of reasons', () => {
    expect(parseDecision({ reportId: id, action: 'remove', ground: 'terms', reason: 'bad' })).toBeNull()
  })
})

describe('appeals', () => {
  const decided = 1_000_000
  it('allows one appeal within six months of a decision', () => {
    expect(canAppeal({ status: 'actioned', decidedAtMs: decided, appealStatus: 'none' }, decided + APPEAL_WINDOW_MS)).toBe(true)
    expect(canAppeal({ status: 'actioned', decidedAtMs: decided, appealStatus: 'none' }, decided + APPEAL_WINDOW_MS + 1)).toBe(false)
    expect(canAppeal({ status: 'dismissed', decidedAtMs: decided, appealStatus: 'pending' }, decided + 1)).toBe(false)
    expect(canAppeal({ status: 'open', decidedAtMs: null, appealStatus: 'none' }, decided)).toBe(false)
  })
  it('validates appeal text and outcomes', () => {
    expect(parseAppeal({ text: 'short' })).toBeNull()
    expect(parseAppeal({ text: 'This was satire, not hate.' })).not.toBeNull()
    expect(parseAppealDecision({ reportId: id, outcome: 'maybe', reason: 'x'.repeat(30) })).toBeNull()
    expect(parseAppealDecision({ reportId: id, outcome: 'reversed', reason: 'Context shows satire; restored.' })).not.toBeNull()
  })
})
