import 'server-only'
import { ensureSchema } from '@/lib/server/spaktok-schema'
import { randomUUID } from 'node:crypto'
import { oneD1, queryD1 } from '@/lib/native/d1'
import {
  canVote, clockAt, PK_COUNTDOWN_MS, PK_INVITE_TTL_MS, scoreBattle,
  type PkBattleRow, type PkRounds, type PkRoundSeconds, type PkSide, type PkTally,
} from '@/lib/live/spaktok-pk-rules'

const COLS = 'b.id,b.host_id,b.guest_id,b.rounds,b.round_seconds,b.status,b.created_at_ms,b.started_at_ms'
type Row = PkBattleRow & { host_username: string; guest_username: string; host_name: string; guest_name: string }
const SELECT = `SELECT ${COLS},hp.username AS host_username,gp.username AS guest_username,
  hp.display_name AS host_name,gp.display_name AS guest_name
  FROM pk_battles b JOIN profiles hp ON hp.id=b.host_id JOIN profiles gp ON gp.id=b.guest_id`

const normalize = (r: Row): Row => ({
  ...r,
  rounds: Number(r.rounds), round_seconds: Number(r.round_seconds),
  created_at_ms: Number(r.created_at_ms),
  started_at_ms: r.started_at_ms === null ? null : Number(r.started_at_ms),
})

/** A user is busy while an invite is unexpired or an active battle has not reached its end. */
async function isBusy(userId: string, now: number): Promise<boolean> {
  const row = await oneD1<{ n: number }>(
    `SELECT count(*) AS n FROM pk_battles WHERE (host_id=? OR guest_id=?) AND (
      (status='invited' AND created_at_ms>?) OR
      (status='active' AND started_at_ms + rounds*round_seconds*1000 > ?))`,
    [userId, userId, now - PK_INVITE_TTL_MS, now],
  )
  return Number(row?.n ?? 0) > 0
}

export type CreateResult = { ok: true; id: string } | { ok: false; error: 'guest_not_found' | 'cannot_battle_self' | 'host_busy' | 'guest_busy' }

export async function createBattle(hostId: string, guestUsername: string, rounds: PkRounds, roundSeconds: PkRoundSeconds): Promise<CreateResult> {
  await ensureSchema('pk')
  const guest = await oneD1<{ id: string }>('SELECT id FROM profiles WHERE lower(username)=? LIMIT 1', [guestUsername])
  if (!guest) return { ok: false, error: 'guest_not_found' }
  if (guest.id === hostId) return { ok: false, error: 'cannot_battle_self' }
  const now = Date.now()
  if (await isBusy(hostId, now)) return { ok: false, error: 'host_busy' }
  if (await isBusy(guest.id, now)) return { ok: false, error: 'guest_busy' }
  const id = randomUUID()
  await queryD1(
    `INSERT INTO pk_battles(id,host_id,guest_id,rounds,round_seconds,status,created_at_ms) VALUES (?,?,?,?,?,'invited',?)`,
    [id, hostId, guest.id, rounds, roundSeconds, now],
  )
  return { ok: true, id }
}

export async function respondToInvite(battleId: string, guestId: string, accept: boolean): Promise<boolean> {
  await ensureSchema('pk')
  const now = Date.now()
  const result = accept
    ? await queryD1(
      `UPDATE pk_battles SET status='active',started_at_ms=? WHERE id=? AND guest_id=? AND status='invited' AND created_at_ms>?`,
      [now + PK_COUNTDOWN_MS, battleId, guestId, now - PK_INVITE_TTL_MS])
    : await queryD1(
      `UPDATE pk_battles SET status='declined',ended_by=? WHERE id=? AND guest_id=? AND status='invited'`,
      [guestId, battleId, guestId])
  return result.changes === 1
}

/** Either participant may end the battle early; it is recorded as cancelled with no winner. */
export async function cancelBattle(battleId: string, userId: string): Promise<boolean> {
  await ensureSchema('pk')
  const now = Date.now()
  const result = await queryD1(
    `UPDATE pk_battles SET status='cancelled',ended_by=? WHERE id=? AND (host_id=? OR guest_id=?) AND (
      status='invited' OR (status='active' AND started_at_ms + rounds*round_seconds*1000 > ?))`,
    [userId, battleId, userId, userId, now],
  )
  return result.changes === 1
}

export type VoteResult = { ok: true; round: number } | { ok: false; error: 'not_found' | 'battle_not_live' | 'participant_cannot_vote' | 'already_voted' }

export async function castVote(battleId: string, voterId: string, side: PkSide): Promise<VoteResult> {
  await ensureSchema('pk')
  const battle = await oneD1<Row>(`${SELECT} WHERE b.id=?`, [battleId])
  if (!battle) return { ok: false, error: 'not_found' }
  const now = Date.now()
  const decision = canVote(normalize(battle), voterId, now)
  if (!decision.ok) return decision
  // Re-check status inside the insert so a vote cannot land after a concurrent cancel.
  const result = await queryD1(
    `INSERT OR IGNORE INTO pk_votes(battle_id,round,voter_id,side,created_at_ms)
     SELECT id,?,?,?,? FROM pk_battles WHERE id=? AND status='active'`,
    [decision.round, voterId, side, now, battleId],
  )
  return result.changes === 1 ? { ok: true, round: decision.round } : { ok: false, error: 'already_voted' }
}

export async function battleState(battleId: string, viewerId: string | null) {
  await ensureSchema('pk')
  const raw = await oneD1<Row>(`${SELECT} WHERE b.id=?`, [battleId])
  if (!raw) return null
  const battle = normalize(raw)
  const now = Date.now()
  const clock = clockAt(battle, now)
  const tallyRows = (await queryD1<{ round: number; side: PkSide; n: number }>(
    'SELECT round,side,count(*) AS n FROM pk_votes WHERE battle_id=? GROUP BY round,side', [battleId])).rows
  const map = new Map<number, PkTally>()
  for (const t of tallyRows) {
    const round = Number(t.round)
    const entry = map.get(round) ?? { round, host: 0, guest: 0 }
    entry[t.side] = Number(t.n)
    map.set(round, entry)
  }
  const result = scoreBattle(battle, [...map.values()], clock)
  let myVote: PkSide | null = null
  if (viewerId && clock.phase === 'round' && clock.round) {
    const v = await oneD1<{ side: PkSide }>('SELECT side FROM pk_votes WHERE battle_id=? AND round=? AND voter_id=?',
      [battleId, clock.round, viewerId])
    myVote = v?.side ?? null
  }
  const role = viewerId === battle.host_id ? 'host' : viewerId === battle.guest_id ? 'guest' : viewerId ? 'viewer' : 'anonymous'
  return {
    id: battle.id,
    serverNowMs: now,
    rounds: battle.rounds,
    roundSeconds: battle.round_seconds,
    host: { id: battle.host_id, username: raw.host_username, displayName: raw.host_name || raw.host_username },
    guest: { id: battle.guest_id, username: raw.guest_username, displayName: raw.guest_name || raw.guest_username },
    clock, result, myVote, role,
    scoring: 'free-viewer-votes' as const,
  }
}

export async function listBattles(userId: string | null) {
  await ensureSchema('pk')
  const now = Date.now()
  const live = (await queryD1<Row>(
    `${SELECT} WHERE b.status='active' AND b.started_at_ms + b.rounds*b.round_seconds*1000 > ?
     ORDER BY b.started_at_ms DESC LIMIT 20`, [now])).rows.map(normalize)
  const mine = userId ? (await queryD1<Row>(
    `${SELECT} WHERE (b.host_id=? OR b.guest_id=?) AND (
      (b.status='invited' AND b.created_at_ms>?) OR
      (b.status='active' AND b.started_at_ms + b.rounds*b.round_seconds*1000 > ?))
     ORDER BY b.created_at_ms DESC LIMIT 5`, [userId, userId, now - PK_INVITE_TTL_MS, now])).rows.map(normalize) : []
  const brief = (b: Row) => ({
    id: b.id, phase: clockAt(b, now).phase, rounds: b.rounds, roundSeconds: b.round_seconds,
    host: { username: b.host_username, displayName: b.host_name || b.host_username },
    guest: { username: b.guest_username, displayName: b.guest_name || b.guest_username },
    role: userId === b.host_id ? 'host' : userId === b.guest_id ? 'guest' : 'viewer',
  })
  return { serverNowMs: now, live: live.map(brief), mine: mine.map(brief), signedIn: Boolean(userId) }
}
