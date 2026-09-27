import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'

export const runtime = 'nodejs'
const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store, max-age=0' } })
}

export async function POST(request: NextRequest) {
  const origin = request.headers.get('origin')
  if (origin && origin !== request.nextUrl.origin) return json({ error: 'invalid_origin' }, 403)
  let body: unknown
  try { body = await request.json() } catch { return json({ error: 'invalid_json' }, 400) }
  if (!body || typeof body !== 'object') return json({ error: 'invalid_request' }, 400)
  const { videoId, bookmarked } = body as Record<string, unknown>
  if (typeof videoId !== 'string' || !UUID.test(videoId) || typeof bookmarked !== 'boolean') return json({ error: 'invalid_request' }, 400)

  try {
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    const userId = authData.user?.id
    if (authError || !userId) return json({ error: 'unauthorized' }, 401)

    if (bookmarked) {
      const { error } = await supabase.from('bookmarks')
        .upsert({ user_id: userId, video_id: videoId }, { onConflict: 'user_id,video_id', ignoreDuplicates: true })
      if (error) {
        console.error('[bookmarks] Insert failed:', error.code)
        return json({ error: 'bookmark_unavailable' }, 503)
      }
    } else {
      const { error } = await supabase.from('bookmarks').delete().eq('user_id', userId).eq('video_id', videoId)
      if (error) {
        console.error('[bookmarks] Delete failed:', error.code)
        return json({ error: 'bookmark_unavailable' }, 503)
      }
    }
    return json({ videoId, bookmarked })
  } catch {
    return json({ error: 'bookmark_unavailable' }, 503)
  }
}
