import type { D1DatabaseLike } from './d1-repository'
import type { Video } from '@/lib/types'

export interface FeedCursor { createdAt: string; id: string }
export interface PublicVideoPage { videos: Video[]; nextCursor: string | null }
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const DATE = /^\d{4}-\d\d-\d\d[ T]\d\d:\d\d:\d\d(?:\.\d{1,6})?Z?$/
const B64 = /^[A-Za-z0-9_-]+$/
const MAX_PAGE = 24

interface Row {
  id: string; user_id: string; media_url: string; thumbnail_url: string | null
  description: string | null; music: string | null; view_count: number
  like_count: number; comment_count: number; share_count: number; created_at: string
  username: string; display_name: string; avatar_url: string | null; is_verified: number
}

export function encodeFeedCursor(value: FeedCursor): string {
  return btoa(JSON.stringify([value.createdAt, value.id]))
    .replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '')
}

export function decodeFeedCursor(value: string): FeedCursor {
  if (!value || value.length > 256 || !B64.test(value)) throw new Error('invalid_cursor')
  try {
    const values: unknown = JSON.parse(atob(value.replace(/-/g, '+').replace(/_/g, '/')))
    if (!Array.isArray(values) || values.length !== 2 ||
        typeof values[0] !== 'string' || !DATE.test(values[0]) ||
        typeof values[1] !== 'string' || !UUID.test(values[1])) throw new Error('invalid_cursor')
    return { createdAt: values[0], id: values[1] }
  } catch {
    throw new Error('invalid_cursor')
  }
}

function date(value: string): Date {
  return new Date(value.endsWith('Z') ? value : `${value.replace(' ', 'T')}Z`)
}

function toVideo(row: Row): Video {
  return {
    id: row.id,
    user: {
      id: row.user_id, username: row.username, displayName: row.display_name || row.username,
      avatar: row.avatar_url || '', followers: 0, following: 0, likes: 0,
      isVerified: row.is_verified === 1, isFollowing: false, createdAt: date(row.created_at),
    },
    videoUrl: row.media_url, thumbnailUrl: row.thumbnail_url || row.media_url,
    caption: row.description || '',
    music: row.music ? { name: row.music, artist: '', coverUrl: '' } : undefined,
    likes: Number(row.like_count || 0), comments: Number(row.comment_count || 0),
    shares: Number(row.share_count || 0), views: Number(row.view_count || 0),
    isLiked: false, isBookmarked: false, tags: [], createdAt: date(row.created_at),
  }
}

/** Public-only metadata query. No per-user reads, no unreviewed video. */
export async function listPublicVideoPage(
  db: D1DatabaseLike, options: { limit?: number; cursor?: FeedCursor } = {},
): Promise<PublicVideoPage> {
  const n = options.limit ?? 12
  const limit = Number.isFinite(n) ? Math.max(1, Math.min(MAX_PAGE, Math.trunc(n))) : 12
  const cursor = options.cursor
  const response = await db.prepare(
    `SELECT v.id,v.user_id,v.media_url,v.thumbnail_url,v.description,v.music,
      v.view_count,v.like_count,v.comment_count,v.share_count,v.created_at,
      p.username,p.display_name,p.avatar_url,p.is_verified
     FROM videos v JOIN profiles p ON p.id=v.user_id
     WHERE v.status='published'
       AND (?1 IS NULL OR v.created_at < ?1 OR (v.created_at = ?1 AND v.id < ?2))
     ORDER BY v.created_at DESC,v.id DESC LIMIT ?3`
  ).bind(cursor?.createdAt ?? null, cursor?.id ?? null, limit + 1).all<Row>()
  const rows = response.results.slice(0, limit)
  const last = rows.at(-1)
  return {
    videos: rows.map(toVideo),
    nextCursor: response.results.length > limit && last
      ? encodeFeedCursor({ createdAt: last.created_at, id: last.id }) : null,
  }
}
