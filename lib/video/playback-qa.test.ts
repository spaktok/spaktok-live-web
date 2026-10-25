import { describe, expect, it } from 'vitest'
import { summarizePlayback } from './playback-qa'

describe('opt-in playback QA calculations', () => {
  it('returns no sample before playback', () => {
    expect(summarizePlayback([])).toEqual({
      startupCount: 0, startupP75Ms: null, rebufferCount: 0, rebufferTotalMs: 0,
    })
  })
  it('computes nearest-rank p75 separately from rebuffer time', () => {
    expect(summarizePlayback([
      { kind: 'startup', durationMs: 400 }, { kind: 'startup', durationMs: 100 },
      { kind: 'startup', durationMs: 300 }, { kind: 'startup', durationMs: 200 },
      { kind: 'rebuffer', durationMs: 125 },
    ])).toEqual({
      startupCount: 4, startupP75Ms: 300, rebufferCount: 1, rebufferTotalMs: 125,
    })
  })
  it('excludes invalid timings', () => {
    expect(summarizePlayback([
      { kind: 'startup', durationMs: Number.NaN },
      { kind: 'startup', durationMs: -1 },
      { kind: 'startup', durationMs: 500 },
    ]).startupCount).toBe(1)
  })
})
