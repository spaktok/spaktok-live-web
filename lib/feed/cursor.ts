/** Opaque, validated keyset cursor for descending (created_at, id) feeds. */
export interface FeedKey { createdAt: string; id: string }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const TIMESTAMP = /^\d{4}-\d\d-\d\d[T ]\d\d:\d\d:\d\d(?:\.\d{1,6})?(?:Z|[+-]\d\d:\d\d)?$/
function valid(value: FeedKey): boolean {
  return UUID.test(value.id) && value.createdAt.length <= 48 && TIMESTAMP.test(value.createdAt) && Number.isFinite(Date.parse(value.createdAt))
}
export function encodeFeedKey(key: FeedKey): string {
  if (!valid(key)) throw new Error('invalid_cursor')
  return Buffer.from(JSON.stringify([key.createdAt, key.id]), 'utf8').toString('base64url')
}
export function decodeFeedKey(cursor: string): FeedKey {
  if (!cursor || cursor.length > 200 || !/^[\w-]+$/.test(cursor)) throw new Error('invalid_cursor')
  try {
    const decoded: unknown = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'))
    if (!Array.isArray(decoded) || decoded.length !== 2 || typeof decoded[0] !== 'string' || typeof decoded[1] !== 'string') throw new Error('invalid_cursor')
    const key = { createdAt: decoded[0], id: decoded[1] }
    if (!valid(key)) throw new Error('invalid_cursor')
    return key
  } catch { throw new Error('invalid_cursor') }
}
export function feedKeyFilter(key: FeedKey): string {
  if (!valid(key)) throw new Error('invalid_cursor')
  return `created_at.lt.${key.createdAt},and(created_at.eq.${key.createdAt},id.lt.${key.id})`
}
