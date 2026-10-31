// Server-authoritative PK rules. The battle clock is derived only from the
// server-stored start time, so clients can never move a round or the timer.

export const PK_ROUNDS = [3, 5] as const
export const PK_ROUND_SECONDS = [60, 120, 180] as const
export const PK_COUNTDOWN_MS = 5_000
export const PK_INVITE_TTL_MS = 120_000

export type PkRounds = (typeof PK_ROUNDS)[number]
export type PkRoundSeconds = (typeof PK_ROUND_SECONDS)[number]
export type PkSide = 'host' | 'guest'
export type PkStoredStatus = 'invited' | 'active' | 'declined' | 'cancelled'
export type PkPhase = 'invited' | 'expired' | 'declined' | 'cancelled' | 'countdown' | 'round' | 'finished'

export type PkBattleRow = {
  id: string
  host_id: string
  guest_id: string
  rounds: number
  round_seconds: number
  status: PkStoredStatus
  created_at_ms: number
  started_at_ms: number | null
}

export interface PkClock {
  phase: PkPhase
  round: number | null
  remainingMs: number
  endsAtMs: number | null
}

export function parseCreate(value: unknown): { guestUsername: string; rounds: PkRounds; roundSeconds: PkRoundSeconds } | null {
  if (!value || typeof value !== 'object') return null
  const v = value as Record<string, unknown>
  const username = typeof v.guestUsername === 'string' ? v.guestUsername.trim().replace(/^@/, '').toLowerCase() : ''
  if (!/^[a-z0-9_.]{3,30}$/.test(username)) return null
  if (!PK_ROUNDS.includes(v.rounds as PkRounds)) return null
  if (!PK_ROUND_SECONDS.includes(v.roundSeconds as PkRoundSeconds)) return null
  return { guestUsername: username, rounds: v.rounds as PkRounds, roundSeconds: v.roundSeconds as PkRoundSeconds }
}

export const isSide = (value: unknown): value is PkSide => value === 'host' || value === 'guest'

export function clockAt(battle: PkBattleRow, nowMs: number): PkClock {
  if (battle.status === 'declined' || battle.status === 'cancelled')
    return { phase: battle.status, round: null, remainingMs: 0, endsAtMs: null }
  if (battle.status === 'invited') {
    const expiresAt = battle.created_at_ms + PK_INVITE_TTL_MS
    return nowMs >= expiresAt
      ? { phase: 'expired', round: null, remainingMs: 0, endsAtMs: null }
      : { phase: 'invited', round: null, remainingMs: expiresAt - nowMs, endsAtMs: expiresAt }
  }
  const start = battle.started_at_ms
  if (start === null) return { phase: 'cancelled', round: null, remainingMs: 0, endsAtMs: null }
  if (nowMs < start) return { phase: 'countdown', round: null, remainingMs: start - nowMs, endsAtMs: start }
  const roundMs = battle.round_seconds * 1000
  const end = start + battle.rounds * roundMs
  if (nowMs >= end) return { phase: 'finished', round: null, remainingMs: 0, endsAtMs: end }
  const index = Math.floor((nowMs - start) / roundMs)
  const roundEnd = start + (index + 1) * roundMs
  return { phase: 'round', round: index + 1, remainingMs: roundEnd - nowMs, endsAtMs: roundEnd }
}

export interface PkTally { round: number; host: number; guest: number }
export interface PkResult {
  rounds: Array<PkTally & { winner: PkSide | 'draw' }>
  hostRoundWins: number
  guestRoundWins: number
  hostVotes: number
  guestVotes: number
  winner: PkSide | 'draw' | null
}

/** Only fully elapsed rounds decide winners; the live round is shown but not awarded. */
export function scoreBattle(battle: PkBattleRow, tallies: PkTally[], clock: PkClock): PkResult {
  const closedRounds = clock.phase === 'finished' ? battle.rounds : clock.phase === 'round' ? (clock.round ?? 1) - 1 : 0
  const byRound = new Map(tallies.map(t => [t.round, t]))
  const rounds: PkResult['rounds'] = []
  let hostRoundWins = 0, guestRoundWins = 0, hostVotes = 0, guestVotes = 0
  const shown = clock.phase === 'round' ? clock.round ?? 0 : closedRounds
  for (let r = 1; r <= shown; r++) {
    const t = byRound.get(r) ?? { round: r, host: 0, guest: 0 }
    hostVotes += t.host
    guestVotes += t.guest
    const winner: PkSide | 'draw' = t.host > t.guest ? 'host' : t.guest > t.host ? 'guest' : 'draw'
    if (r <= closedRounds) {
      if (winner === 'host') hostRoundWins++
      if (winner === 'guest') guestRoundWins++
    }
    rounds.push({ round: r, host: t.host, guest: t.guest, winner })
  }
  let winner: PkResult['winner'] = null
  if (clock.phase === 'finished') {
    if (hostRoundWins !== guestRoundWins) winner = hostRoundWins > guestRoundWins ? 'host' : 'guest'
    else winner = hostVotes === guestVotes ? 'draw' : hostVotes > guestVotes ? 'host' : 'guest'
  }
  return { rounds, hostRoundWins, guestRoundWins, hostVotes, guestVotes, winner }
}

export type VoteDecision = { ok: true; round: number } | { ok: false; error: 'battle_not_live' | 'participant_cannot_vote' }

export function canVote(battle: PkBattleRow, voterId: string, nowMs: number): VoteDecision {
  if (voterId === battle.host_id || voterId === battle.guest_id) return { ok: false, error: 'participant_cannot_vote' }
  const clock = clockAt(battle, nowMs)
  if (clock.phase !== 'round' || clock.round === null) return { ok: false, error: 'battle_not_live' }
  return { ok: true, round: clock.round }
}
