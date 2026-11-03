/** Opaque, validated cursor for the ranked "For You" feed. It pins the
 * pagination instant so later pages score against the same clock as page one. */
import { MAX_RANK_SCORE, type RankCursor } from './ranking'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const EPOCH_FLOOR = Date.parse('2020-01-01T00:00:00.000Z')

function valid(cursor: RankCursor): boolean {
  return (
    Number.isSafeInteger(cursor.score) &&
    cursor.score >= 0 &&
    cursor.score <= MAX_RANK_SCORE &&
    Number.isSafeInteger(cursor.at) &&
    cursor.at >= EPOCH_FLOOR &&
    cursor.at <= Date.now() + 24 * 3_600_000 &&
    UUID.test(cursor.id)
  )
}

export function encodeRankCursor(cursor: RankCursor): string {
  if (!valid(cursor)) throw new Error('invalid_cursor')
  return Buffer.from(JSON.stringify([cursor.score, cursor.id, cursor.at]), 'utf8').toString('base64url')
}

export function decodeRankCursor(raw: string): RankCursor {
  if (!raw || raw.length > 200 || !/^[\w-]+$/.test(raw)) throw new Error('invalid_cursor')
  try {
    const decoded: unknown = JSON.parse(Buffer.from(raw, 'base64url').toString('utf8'))
    if (!Array.isArray(decoded) || decoded.length !== 3) throw new Error('invalid_cursor')
    if (typeof decoded[0] !== 'number' || typeof decoded[1] !== 'string' || typeof decoded[2] !== 'number') {
      throw new Error('invalid_cursor')
    }
    const cursor: RankCursor = { score: decoded[0], id: decoded[1], at: decoded[2] }
    if (!valid(cursor)) throw new Error('invalid_cursor')
    return cursor
  } catch { throw new Error('invalid_cursor') }
}
