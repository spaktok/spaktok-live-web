import { describe, expect, it } from 'vitest'
import { buildInterestProfile, interestMultiplier, MAX_INTEREST_TAGS, MAX_INTEREST_SOURCES } from './interests'

const NOW = Date.parse('2026-11-03T12:00:00.000Z')
const daysAgo = (days: number) => new Date(NOW - days * 86_400_000).toISOString()

describe('interest profile', () => {
  it('is empty without likes', () => {
    expect(buildInterestProfile([], NOW).size).toBe(0)
    expect(buildInterestProfile([{ description: null, at: daysAgo(1) }], NOW).size).toBe(0)
  })

  it('weights recent interests above old ones', () => {
    const profile = buildInterestProfile(
      [
        { description: '#رقص', at: daysAgo(0) },
        { description: '#طبخ', at: daysAgo(15) },
      ],
      NOW,
    )
    expect(profile.get('رقص')!).toBeGreaterThan(profile.get('طبخ')!)
  })

  it('reinforced interests outweigh a single like', () => {
    const profile = buildInterestProfile(
      [
        { description: '#سفر', at: daysAgo(0) },
        { description: '#سفر مرة أخرى', at: daysAgo(0) },
        { description: '#رياضة', at: daysAgo(0) },
      ],
      NOW,
    )
    expect(profile.get('سفر')!).toBeGreaterThan(profile.get('رياضة')!)
  })

  it('normalizes Arabic noise and caps the profile size', () => {
    expect(buildInterestProfile([{ description: '#سـبـاق', at: daysAgo(0) }], NOW).has('سباق')).toBe(true)
    const many = Array.from({ length: MAX_INTEREST_SOURCES + 10 }, (_, i) => ({
      description: `#tag${i}`,
      at: daysAgo(i),
    }))
    expect(buildInterestProfile(many, NOW).size).toBeLessThanOrEqual(MAX_INTEREST_TAGS)
  })

  it('never exceeds the bounded affinity boost', () => {
    const profile = buildInterestProfile([{ description: '#رقص', at: daysAgo(0) }], NOW)
    expect(interestMultiplier(['رقص'], profile)).toBeGreaterThan(1)
    expect(interestMultiplier(['رقص', 'رقص', 'رقص'], profile)).toBeLessThanOrEqual(1.18)
    expect(interestMultiplier(['#رقص'], profile)).toBeGreaterThan(1)
  })

  it('stays neutral without a profile or without matching tags', () => {
    expect(interestMultiplier(['رقص'], null)).toBe(1)
    expect(interestMultiplier([], buildInterestProfile([{ description: '#رقص', at: daysAgo(0) }], NOW))).toBe(1)
    expect(interestMultiplier(['طبخ'], buildInterestProfile([{ description: '#رقص', at: daysAgo(0) }], NOW))).toBe(1)
  })
})
