import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
const MAX_COMMENT_LENGTH = 500

function json(body: unknown, status = 200) {
  return NextResponse.json(body, {
    status,
    headers: { 'Cache-Control': 'private, no-store, max-age=0' },
  })
}

export async function GET(request: NextRequest) {
  const videoId = request.nextUrl.searchParams.get('videoId')
  if (!videoId || !UUID.test(videoId)) return json({ error: 'invalid_video_id' }, 400)

  try {
    const supabase = await createClient()
    const { data, error } = await supabase
      .from('comments')
      .select('id,content,created_at,user_id,profiles!comments_user_id_fkey(username,display_name,avatar_url)')
      .eq('video_id', videoId)
      .order('created_at', { ascending: true })
      .limit(100)

    if (error) {
      console.error('[comments] Query failed:', error.code)
      return json({ error: 'comments_unavailable' }, 503)
    }

    const comments = (data ?? []).map((row) => {
      const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
      return {
        id: row.id,
        content: row.content,
        createdAt: row.created_at,
        user: {
          id: row.user_id,
          username: profile?.username ?? 'user',
          displayName: profile?.display_name || profile?.username || 'مستخدم',
          avatarUrl: profile?.avatar_url ?? null,
        },
      }
    })
    return json({ comments })
  } catch {
    return json({ error: 'comments_unavailable' }, 503)
  }
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (origin && origin !== request.nextUrl.origin) return json({ error: 'invalid_origin' }, 403)

  let body: unknown
  try {
    body = await request.json()
  } catch {
    return json({ error: 'invalid_json' }, 400)
  }
  if (!body || typeof body !== 'object') return json({ error: 'invalid_request' }, 400)
  const { videoId, content } = body as Record<string, unknown>
  if (typeof videoId !== 'string' || !UUID.test(videoId) || typeof content !== 'string') {
    return json({ error: 'invalid_request' }, 400)
  }
  const normalized = content.trim()
  if (normalized.length < 1 || normalized.length > MAX_COMMENT_LENGTH) {
    return json({ error: 'invalid_comment_length' }, 400)
  }

  try {
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    const userId = authData.user?.id
    if (authError || !userId) return json({ error: 'unauthorized' }, 401)

    const { data, error } = await supabase
      .from('comments')
      .insert({ user_id: userId, video_id: videoId, content: normalized })
      .select('id,content,created_at,user_id,profiles!comments_user_id_fkey(username,display_name,avatar_url)')
      .single()

    if (error) {
      console.error('[comments] Insert failed:', error.code)
      return json({ error: 'comment_unavailable' }, 503)
    }

    const profile = Array.isArray(data.profiles) ? data.profiles[0] : data.profiles
    return json({
      comment: {
        id: data.id,
        content: data.content,
        createdAt: data.created_at,
        user: {
          id: data.user_id,
          username: profile?.username ?? 'user',
          displayName: profile?.display_name || profile?.username || 'مستخدم',
          avatarUrl: profile?.avatar_url ?? null,
        },
      },
    }, 201)
  } catch {
    return json({ error: 'comment_unavailable' }, 503)
  }
}
