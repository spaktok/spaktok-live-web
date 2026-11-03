import { describe, expect, it } from 'vitest'
import { decodeRankCursor, encodeRankCursor } from './rank-cursor'

const cursor = { score: 1234, id: 'd0b7948f-a75b-4a19-9705-d76542064198', at: Date.parse('2026-11-03T12:00:00.000Z') }

describe('ranked feed cursor', () => {
  it('round-trips score, id and the pinned instant', () => {
    expect(decodeRankCursor(encodeRankCursor(cursor))).toEqual(cursor)
  })

  it('rejects malformed or oversized input', () => {
    expect(() => decodeRankCursor('!!')).toThrow('invalid_cursor')
    expect(() => decodeRankCursor('a'.repeat(201))).toThrow('invalid_cursor')
    expect(() => decodeRankCursor('')).toThrow('invalid_cursor')
  })

  it('rejects a tampered payload', () => {
    const tampered = (payload: unknown) =>
      Buffer.from(JSON.stringify(payload), 'utf8').toString('base64url')
    expect(() => decodeRankCursor(tampered([-1, cursor.id, cursor.at]))).toThrow('invalid_cursor')
    expect(() => decodeRankCursor(tampered([12.5, cursor.id, cursor.at]))).toThrow('invalid_cursor')
    expect(() => decodeRankCursor(tampered([cursor.score, 'drop table videos', cursor.at]))).toThrow('invalid_cursor')
    expect(() => decodeRankCursor(tampered([cursor.score, cursor.id]))).toThrow('invalid_cursor')
    expect(() => decodeRankCursor(tampered({ score: 1 }))).toThrow('invalid_cursor')
    expect(() => decodeRankCursor(tampered([cursor.score, cursor.id, 0]))).toThrow('invalid_cursor')
  })

  it('refuses to encode an invalid cursor', () => {
    expect(() => encodeRankCursor({ ...cursor, id: 'x' })).toThrow('invalid_cursor')
    expect(() => encodeRankCursor({ ...cursor, score: 2_000_000_000 })).toThrow('invalid_cursor')
  })
})
