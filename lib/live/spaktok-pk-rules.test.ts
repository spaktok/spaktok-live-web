import { describe, expect, it } from 'vitest'
import { canVote, clockAt, parseCreate, PK_COUNTDOWN_MS, PK_INVITE_TTL_MS, scoreBattle, type PkBattleRow } from './spaktok-pk-rules'

const base: PkBattleRow = {
  id: 'b', host_id: 'h', guest_id: 'g', rounds: 3, round_seconds: 60,
  status: 'active', created_at_ms: 0, started_at_ms: 10_000,
}

describe('parseCreate', () => {
  it('accepts allowed formats and normalizes username', () => {
    expect(parseCreate({ guestUsername: '@Ali_9', rounds: 5, roundSeconds: 120 }))
      .toEqual({ guestUsername: 'ali_9', rounds: 5, roundSeconds: 120 })
  })
  it('rejects unknown round counts, durations and bad names', () => {
    expect(parseCreate({ guestUsername: 'ali', rounds: 4, roundSeconds: 60 })).toBeNull()
    expect(parseCreate({ guestUsername: 'ali', rounds: 3, roundSeconds: 1 })).toBeNull()
    expect(parseCreate({ guestUsername: 'a b', rounds: 3, roundSeconds: 60 })).toBeNull()
    expect(parseCreate(null)).toBeNull()
  })
})

describe('clockAt', () => {
  it('expires invites after the TTL', () => {
    const inv = { ...base, status: 'invited' as const, started_at_ms: null }
    expect(clockAt(inv, PK_INVITE_TTL_MS - 1).phase).toBe('invited')
    expect(clockAt(inv, PK_INVITE_TTL_MS).phase).toBe('expired')
  })
  it('derives countdown, rounds and finish from server time only', () => {
    expect(clockAt(base, 10_000 - PK_COUNTDOWN_MS).phase).toBe('countdown')
    expect(clockAt(base, 10_000)).toMatchObject({ phase: 'round', round: 1, remainingMs: 60_000 })
    expect(clockAt(base, 10_000 + 60_000)).toMatchObject({ phase: 'round', round: 2 })
    expect(clockAt(base, 10_000 + 179_999)).toMatchObject({ phase: 'round', round: 3, remainingMs: 1 })
    expect(clockAt(base, 10_000 + 180_000).phase).toBe('finished')
  })
})

describe('canVote', () => {
  it('blocks participants and votes outside a live round', () => {
    expect(canVote(base, 'h', 20_000)).toEqual({ ok: false, error: 'participant_cannot_vote' })
    expect(canVote(base, 'v', 5_000)).toEqual({ ok: false, error: 'battle_not_live' })
    expect(canVote(base, 'v', 200_000)).toEqual({ ok: false, error: 'battle_not_live' })
    expect(canVote(base, 'v', 75_000)).toEqual({ ok: true, round: 2 })
  })
})

describe('scoreBattle', () => {
  it('awards only closed rounds while live', () => {
    const clock = clockAt(base, 10_000 + 90_000)
    const r = scoreBattle(base, [{ round: 1, host: 4, guest: 1 }, { round: 2, host: 0, guest: 9 }], clock)
    expect(r.hostRoundWins).toBe(1)
    expect(r.guestRoundWins).toBe(0)
    expect(r.rounds).toHaveLength(2)
    expect(r.winner).toBeNull()
  })
  it('decides by round wins, then total votes, then draw', () => {
    const done = clockAt(base, 500_000)
    expect(scoreBattle(base, [{ round: 1, host: 1, guest: 0 }, { round: 2, host: 1, guest: 0 }, { round: 3, host: 0, guest: 50 }], done).winner).toBe('host')
    expect(scoreBattle(base, [{ round: 1, host: 1, guest: 0 }, { round: 2, host: 0, guest: 3 }], done).winner).toBe('guest')
    expect(scoreBattle(base, [], done).winner).toBe('draw')
  })
})
