import { describe, expect, it } from 'vitest'
import {
  MAX_RANK_SCORE,
  rankCandidates,
  scoreCandidate,
  selectRankedPage,
  type RankCandidate,
  type RankCursor,
} from './ranking'
import { buildInterestProfile } from './interests'

const NOW = Date.parse('2026-11-03T12:00:00.000Z')
const HOUR = 3_600_000
const uuid = (n: number) => `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`
const hoursAgo = (hours: number) => new Date(NOW - hours * HOUR).toISOString()

function candidate(overrides: Partial<RankCandidate> & { id?: string; userId?: string } = {}): RankCandidate {
  return {
    id: overrides.id ?? uuid(1),
    userId: overrides.userId ?? uuid(900),
    createdAt: overrides.createdAt ?? hoursAgo(6),
    likes: overrides.likes ?? 0,
    comments: overrides.comments ?? 0,
    shares: overrides.shares ?? 0,
    views: overrides.views ?? 0,
    isFollowing: overrides.isFollowing ?? false,
    isVerified: overrides.isVerified ?? false,
    tags: overrides.tags,
  }
}

describe('for-you scoring', () => {
  it('keeps every score a bounded integer', () => {
    const weird = candidate({ likes: -5, comments: Number.NaN, shares: Number.POSITIVE_INFINITY, views: -1 })
    for (const value of [scoreCandidate(weird, NOW), scoreCandidate(candidate(), NOW)]) {
      expect(Number.isInteger(value)).toBe(true)
      expect(value).toBeGreaterThanOrEqual(0)
      expect(value).toBeLessThanOrEqual(MAX_RANK_SCORE)
    }
  })

  it('ranks a fresh upload above a stale one nobody engaged with', () => {
    const fresh = candidate({ createdAt: hoursAgo(0.5) })
    const stale = candidate({ createdAt: hoursAgo(30 * 24) })
    expect(scoreCandidate(fresh, NOW)).toBeGreaterThan(scoreCandidate(stale, NOW))
  })

  it('lets real engagement beat freshness once a video has an audience', () => {
    const loved = candidate({ createdAt: hoursAgo(8), likes: 900, comments: 120, shares: 60, views: 12_000 })
    const brandNew = candidate({ createdAt: hoursAgo(0.2) })
    expect(scoreCandidate(loved, NOW)).toBeGreaterThan(scoreCandidate(brandNew, NOW))
  })

  it('damps one viral outlier instead of letting it swallow the feed', () => {
    const viral = candidate({ createdAt: hoursAgo(6), likes: 500_000, comments: 40_000, shares: 90_000, views: 9_000_000 })
    const solid = candidate({ createdAt: hoursAgo(6), likes: 4_000, comments: 400, shares: 250, views: 60_000 })
    const ratio = scoreCandidate(viral, NOW) / scoreCandidate(solid, NOW)
    expect(ratio).toBeGreaterThan(1)
    expect(ratio).toBeLessThan(10)
  })

  it('boosts creators the viewer already follows', () => {
    const followed = candidate({ isFollowing: true, likes: 120, views: 2_000 })
    const stranger = candidate({ likes: 120, views: 2_000 })
    expect(scoreCandidate(followed, NOW)).toBeGreaterThan(scoreCandidate(stranger, NOW))
  })

  it('lifts content that matches the viewer interests', () => {
    const interests = buildInterestProfile([{ description: '#رقص', at: new Date(NOW).toISOString() }], NOW)
    const matching = candidate({ tags: ['رقص'], likes: 100, views: 2_000 })
    const unrelated = candidate({ tags: ['طبخ'], likes: 100, views: 2_000 })
    expect(scoreCandidate(matching, NOW, interests)).toBeGreaterThan(scoreCandidate(unrelated, NOW, interests))
    expect(scoreCandidate(matching, NOW)).toBe(scoreCandidate(unrelated, NOW))
  })

  it('prefers a strong like-rate over a padded view count', () => {
    const resonant = candidate({ likes: 400, views: 5_000 })
    const padded = candidate({ likes: 400, views: 400_000 })
    expect(scoreCandidate(resonant, NOW)).toBeGreaterThan(scoreCandidate(padded, NOW))
  })
})

describe('for-you ordering and diversity', () => {
  it('is deterministic and independent of the incoming order', () => {
    const set = [candidate({ id: uuid(1) }), candidate({ id: uuid(2), likes: 40 }), candidate({ id: uuid(3), likes: 7 })]
    const forward = rankCandidates(set, NOW).map(item => item.id)
    const backward = rankCandidates([...set].reverse(), NOW).map(item => item.id)
    expect(backward).toEqual(forward)
  })

  it('breaks score ties by newest, then by id', () => {
    const older = candidate({ id: uuid(1), createdAt: hoursAgo(9) })
    const newer = candidate({ id: uuid(2), createdAt: hoursAgo(9) })
    const sameInstant = [candidate({ id: uuid(3), createdAt: hoursAgo(9) }), newer, older]
    const ranked = rankCandidates(sameInstant, NOW)
    expect(ranked.map(item => item.id)).toEqual([uuid(3), uuid(2), uuid(1)])
  })

  it('never shows three videos from one creator in a row and drops nothing', () => {
    const prolific = Array.from({ length: 6 }, (_, i) =>
      candidate({ id: uuid(i + 1), userId: uuid(500), likes: 300 - i }),
    )
    const others = Array.from({ length: 4 }, (_, i) =>
      candidate({ id: uuid(i + 100), userId: uuid(600 + i), likes: 200 - i }),
    )
    const ranked = rankCandidates([...prolific, ...others], NOW)
    expect(ranked).toHaveLength(10)
    for (let i = 2; i < ranked.length; i++) {
      const trio = [ranked[i - 2].userId, ranked[i - 1].userId, ranked[i].userId]
      expect(trio.every(id => id === trio[0])).toBe(false)
    }
  })
})

describe('for-you pagination', () => {
  const feed = Array.from({ length: 23 }, (_, i) =>
    candidate({ id: uuid(i + 1), userId: uuid(300 + (i % 5)), likes: (i * 37) % 90, createdAt: hoursAgo(i * 2) }),
  )

  it('walks every video exactly once and then stops', () => {
    const ranked = rankCandidates(feed, NOW)
    const seen: string[] = []
    let cursor: RankCursor | null = null
    for (let guard = 0; guard < 10; guard++) {
      const result: { page: Array<RankCandidate & { score: number }>; nextCursor: RankCursor | null } =
        selectRankedPage(ranked, cursor, 6, NOW)
      seen.push(...result.page.map(item => item.id))
      cursor = result.nextCursor
      if (!cursor) break
    }
    expect(seen).toHaveLength(feed.length)
    expect(new Set(seen).size).toBe(feed.length)
    expect(seen).toEqual(ranked.map(item => item.id))
  })

  it('returns a null cursor when the last page ends the feed', () => {
    const ranked = rankCandidates(feed.slice(0, 4), NOW)
    expect(selectRankedPage(ranked, null, 4, NOW).nextCursor).toBeNull()
    expect(selectRankedPage(ranked, null, 2, NOW).nextCursor).not.toBeNull()
  })

  it('never repeats a video when a cursor is replayed', () => {
    const ranked = rankCandidates(feed, NOW)
    const first = selectRankedPage(ranked, null, 6, NOW)
    const second = selectRankedPage(ranked, first.nextCursor, 6, NOW)
    const overlap = second.page.filter(item => first.page.some(seen => seen.id === item.id))
    expect(overlap).toEqual([])
  })
})
