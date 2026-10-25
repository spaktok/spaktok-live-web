/** Minimal opt-in, in-memory QA measurements. Never send personal data. */
export type PlaybackMetric = {
  kind: 'startup' | 'rebuffer'
  durationMs: number
}

export interface PlaybackSummary {
  startupCount: number
  startupP75Ms: number | null
  rebufferCount: number
  rebufferTotalMs: number
}

export function summarizePlayback(samples: PlaybackMetric[]): PlaybackSummary {
  const valid = samples.filter((sample) =>
    Number.isFinite(sample.durationMs) && sample.durationMs >= 0 && sample.durationMs <= 120_000
  )
  const startups = valid.filter((sample) => sample.kind === 'startup')
    .map((sample) => sample.durationMs).sort((a, b) => a - b)
  const buffers = valid.filter((sample) => sample.kind === 'rebuffer')
  const n = startups.length
  return {
    startupCount: n,
    startupP75Ms: n > 0 ? Math.round(startups[Math.ceil(n * 0.75) - 1]) : null,
    rebufferCount: buffers.length,
    rebufferTotalMs: Math.round(buffers.reduce((acc, sample) => acc + sample.durationMs, 0)),
  }
}
