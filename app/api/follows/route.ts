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
  const { followingId, following } = body as Record<string, unknown>
  if (typeof followingId !== 'string' || !UUID.test(followingId) || typeof following !== 'boolean') return json({ error: 'invalid_request' }, 400)

  try {
    const supabase = await createClient()
    const { data: authData, error: authError } = await supabase.auth.getUser()
    const followerId = authData.user?.id
    if (authError || !followerId) return json({ error: 'unauthorized' }, 401)
    if (followerId === followingId) return json({ error: 'cannot_follow_self' }, 400)

    if (following) {
      const { error } = await supabase.from('follows')
        .upsert({ follower_id: followerId, following_id: followingId }, { onConflict: 'follower_id,following_id', ignoreDuplicates: true })
      if (error) {
        console.error('[follows] Insert failed:', error.code)
        return json({ error: 'follow_unavailable' }, 503)
      }
    } else {
      const { error } = await supabase.from('follows').delete()
        .eq('follower_id', followerId).eq('following_id', followingId)
      if (error) {
        console.error('[follows] Delete failed:', error.code)
        return json({ error: 'follow_unavailable' }, 503)
      }
    }
    return json({ followingId, following })
  } catch {
    return json({ error: 'follow_unavailable' }, 503)
  }
}
