import { describe, expect, it } from 'vitest'
import { decodeFeedKey, encodeFeedKey, feedKeyFilter } from './cursor'
const valid = { createdAt: '2026-10-25T12:34:56.000+00:00', id: 'd0b7948f-a75b-4a19-9705-d76542064198' }
describe('feed keyset pagination', () => {
  it('round-trips the cursor', () => expect(decodeFeedKey(encodeFeedKey(valid))).toEqual(valid))
  it('rejects a malformed or oversized cursor', () => {
    expect(() => decodeFeedKey('!!')).toThrow('invalid_cursor')
    expect(() => decodeFeedKey('a'.repeat(201))).toThrow('invalid_cursor')
  })
  it('rejects injected query syntax', () =>
    expect(() => feedKeyFilter({ ...valid, createdAt: '2026-10-25),id.gt.0' })).toThrow('invalid_cursor'))
  it('uses deterministic id tie-breaker', () =>
    expect(feedKeyFilter(valid)).toContain(`and(created_at.eq.${valid.createdAt},id.lt.${valid.id})`))
})
