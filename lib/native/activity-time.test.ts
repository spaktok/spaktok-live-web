import {describe, expect, it} from 'vitest'
import {activityTimeMs, relativeActivityTime} from './activity-time'

describe('activity timestamps from Cloudflare D1', () => {
  it('treats SQLite timestamps without offsets as UTC', () => {
    expect(activityTimeMs('2026-11-01 18:00:00')).toBe(Date.parse('2026-11-01T18:00:00Z'))
  })
  it('handles existing Z and numeric offsets without changing the represented instant', () => {
    const epoch = Date.parse('2026-11-01T18:00:00Z')
    expect(activityTimeMs('2026-11-01T18:00:00Z')).toBe(epoch)
    expect(activityTimeMs('2026-11-01T19:00:00+01:00')).toBe(epoch)
    expect(activityTimeMs('2026-11-01 18:00:00.123456')).toBe(epoch + 123)
  })
  it('fails closed on malformed dates, rather than displaying a wrong age', () => {
    for (const input of ['', 'bad', '2026-13-01 18:00:00', '2026-11-01 18:00:00ZZ'])
      expect(activityTimeMs(input)).toBeNull()
    expect(relativeActivityTime('bad')).toBe('')
  })
  it('formats relative Arabic labels against a deterministic clock', () => {
    const now = Date.parse('2026-11-01T18:05:00Z')
    expect(relativeActivityTime('2026-11-01T18:04:45Z', now)).toBe('الآن')
    expect(relativeActivityTime('2026-11-01 18:03:00', now)).toBe('قبل 2 د')
    expect(relativeActivityTime('2026-11-01T17:05:00Z', now)).toBe('قبل 1 س')
  })
})
