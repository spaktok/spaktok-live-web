import { describe, expect, it } from 'vitest'
import { extractHashtags, normalizeHashtag, rankTrendingHashtags } from './hashtags'

const now = Date.parse('2026-10-31T12:00:00Z')
const hoursAgo = (h: number) => new Date(now - h * 3_600_000).toISOString()

describe('hashtags', () => {
  it('extracts Arabic and Latin tags, deduped and lowercased', () =>
    expect(extractHashtags('سباق #سيارات و #Drift #drift #سيارات!')).toEqual(['سيارات', 'drift']))
  it('folds tatweel and harakat', () => expect(normalizeHashtag('سـبَـاق')).toBe('سباق'))
  it('ignores pure numbers and empty input', () => {
    expect(extractHashtags('#2026 #1')).toEqual([])
    expect(extractHashtags(null)).toEqual([])
  })
  it('caps tags per video', () =>
    expect(extractHashtags(Array.from({ length: 20 }, (_, i) => `#t${i}`).join(' '))).toHaveLength(10))
  it('ranks recent tags above stale ones', () => {
    const ranked = rankTrendingHashtags([
      { description: '#old', createdAt: hoursAgo(24 * 7), views: 0 },
      { description: '#fresh', createdAt: hoursAgo(1), views: 0 },
    ], now)
    expect(ranked.map(t => t.tag)).toEqual(['fresh', 'old'])
  })
  it('counts videos per tag and skips bad dates', () => {
    const ranked = rankTrendingHashtags([
      { description: '#a #b', createdAt: hoursAgo(2), views: 10 },
      { description: '#a', createdAt: hoursAgo(3), views: 0 },
      { description: '#a', createdAt: 'nope', views: 0 },
    ], now)
    expect(ranked[0]).toMatchObject({ tag: 'a', videos: 2 })
    expect(ranked.find(t => t.tag === 'b')?.videos).toBe(1)
  })
})
