import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import type { Video } from '@/lib/types'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const MAX_FEED_SIZE = 24

interface VideoRow {
  id: string
  user_id: string
  video_url: string
  thumbnail_url: string | null
  caption: string | null
  music_title: string | null
  music_artist: string | null
  views_count: number | null
  likes_count: number | null
  comments_count: number | null
  shares_count: number | null
  created_at: string
  profiles: {
    username: string
    display_name: string | null
    avatar_url: string | null
    is_verified: boolean | null
  } | null
}

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}

export async function GET(request: NextRequest) {
  const requestedSize = Number(request.nextUrl.searchParams.get('limit') ?? 12)
  const limit = Number.isFinite(requestedSize)
    ? Math.max(1, Math.min(MAX_FEED_SIZE, Math.trunc(requestedSize)))
    : 12

  try {
    const supabase = await createClient()
    const { data: authData } = await supabase.auth.getUser()
    const userId = authData.user?.id ?? null

    const { data, error } = await supabase
      .from('videos')
      .select('id,user_id,video_url,thumbnail_url,caption,music_title,music_artist,views_count,likes_count,comments_count,shares_count,created_at,profiles!videos_user_id_fkey(username,display_name,avatar_url,is_verified)')
      .eq('is_live', false)
      .order('created_at', { ascending: false })
      .limit(limit)

    if (error) {
      console.error('[feed] Supabase query failed:', error.code)
      return json({ error: 'feed_unavailable' }, 503)
    }

    const rows = (data ?? []) as unknown as VideoRow[]
    const ids = rows.map((row) => row.id)
    const likedIds = new Set<string>()
    const bookmarkedIds = new Set<string>()
    const followedIds = new Set<string>()

    if (userId && ids.length > 0) {
      const { data: likes, error: likesError } = await supabase
        .from('likes')
        .select('video_id')
        .eq('user_id', userId)
        .in('video_id', ids)

      if (!likesError) {
        for (const like of likes ?? []) {
          if (like.video_id) likedIds.add(like.video_id)
        }
      }

      const { data: bookmarks, error: bookmarksError } = await supabase
        .from('bookmarks')
        .select('video_id')
        .eq('user_id', userId)
        .in('video_id', ids)
      if (!bookmarksError) {
        for (const bookmark of bookmarks ?? []) bookmarkedIds.add(bookmark.video_id)
      }

      const creatorIds = [...new Set(rows.map((row) => row.user_id))]
      const { data: follows, error: followsError } = await supabase
        .from('follows')
        .select('following_id')
        .eq('follower_id', userId)
        .in('following_id', creatorIds)
      if (!followsError) {
        for (const follow of follows ?? []) followedIds.add(follow.following_id)
      }
    }

    const videos: Video[] = rows.flatMap((row) => {
      const profile = row.profiles
      if (!profile) return []
      return [{
        id: row.id,
        user: {
          id: row.user_id,
          username: profile.username,
          displayName: profile.display_name || profile.username,
          avatar: profile.avatar_url || '',
          followers: 0,
          following: 0,
          likes: 0,
          isVerified: Boolean(profile.is_verified),
          createdAt: new Date(row.created_at),
          isFollowing: followedIds.has(row.user_id),
        },
        videoUrl: row.video_url,
        thumbnailUrl: row.thumbnail_url || '',
        caption: row.caption || '',
        music: row.music_title ? {
          name: row.music_title,
          artist: row.music_artist || '',
          coverUrl: '',
        } : undefined,
        likes: Number(row.likes_count ?? 0),
        comments: Number(row.comments_count ?? 0),
        shares: Number(row.shares_count ?? 0),
        views: Number(row.views_count ?? 0),
        isLiked: likedIds.has(row.id),
        isBookmarked: bookmarkedIds.has(row.id),
        tags: [],
        createdAt: new Date(row.created_at),
      }]
    })

    return json({ videos })
  } catch {
    return json({ error: 'feed_unavailable' }, 503)
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (origin && origin !== request.nextUrl.origin) {
    return json({ error: 'invalid_origin' }, 403)
  }

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }

  if (!body || typeof body !== 'object') return json({ error: 'invalid_request' }, 400)
  const { videoId, liked } = body as Record<string, unknown>
  if (typeof videoId !== 'string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(videoId) || typeof liked !== 'boolean') {
    return json({ error: 'invalid_request' }, 400)
  }

  try {
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    const userId = authData.user?.id
    if (authError || !userId) return json({ error: 'unauthorized' }, 401)

    if (liked) {
      const { error } = await supabase
        .from('likes')
        .upsert({ user_id: userId, video_id: videoId }, { onConflict: 'user_id,video_id', ignoreDuplicates: true })
      if (error) {
        console.error('[feed] Like insert failed:', error.code)
        return json({ error: 'like_unavailable' }, 503)
      }
    } else {
      const { error } = await supabase
        .from('likes')
        .delete()
        .eq('user_id', userId)
        .eq('video_id', videoId)
      if (error) {
        console.error('[feed] Like delete failed:', error.code)
        return json({ error: 'like_unavailable' }, 503)
      }
    }

    return json({ videoId, liked })
  } catch {
    return json({ error: 'like_unavailable' }, 503)
  }
}
