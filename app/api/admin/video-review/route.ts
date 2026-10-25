import { NextResponse } from 'next/server'
import { createClient as createSupabaseClient } from '@supabase/supabase-js'
import { getAuthenticatedUserId } from '@/lib/supabase/get-authenticated-user-id'
import { getStreamConfig, getVideoProcessingState, validUUID, validStreamUid } from '@/lib/video/stream-upload'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

const HEADERS = { 'Cache-Control': 'private, no-store' }
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: HEADERS })

/**
 * Read-only moderation queue. No video URLs, signed playback tokens or
 * publishing operations are exposed. Explicitly opt in for a named admin.
 */
export async function GET() {
  if (process.env.SPAKTOK_MODERATION_ENABLED !== 'true') {
    return json({ error: 'moderation_not_configured' }, 503)
  }
  const adminId = process.env.SPAKTOK_ADMIN_USER_ID
  if (!adminId || !validUUID(adminId)) {
    return json({ error: 'moderation_not_configured' }, 503)
  }
  const userId = await getAuthenticatedUserId()
  if (!userId) return json({ error: 'unauthorized' }, 401)
  if (userId !== adminId) return json({ error: 'forbidden' }, 403)

  const url = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!url || !key) return json({ error: 'moderation_not_configured' }, 503)
  try {
    // Service role is instantiated only AFTER the admin authorization gate.
    const supabase = createSupabaseClient(url, key, {
      auth: { persistSession: false, autoRefreshToken: false },
    })
    const { data, error } = await supabase
      .from('stream_uploads')
      .select('id,user_id,stream_uid,created_at')
      .order('created_at', { ascending: false })
      .limit(20)
    if (error) return json({ error: 'review_database_unavailable' }, 503)
    const config = getStreamConfig()
    const records = await Promise.all((data ?? []).map(async (item) => {
      const base = {
        id: item.id, createdAt: item.created_at,
        state: 'pending_upload' as string,
        durationSeconds: null as number | null,
      }
      if (!config || !item.stream_uid || !validStreamUid(item.stream_uid) ||
          !validUUID(item.id) || !validUUID(item.user_id)) return base
      try {
        const video = await getVideoProcessingState(config, item.stream_uid, item.user_id, item.id)
        return { ...base, state: video.state, durationSeconds: video.durationSeconds }
      } catch {
        return { ...base, state: 'status_unavailable' }
      }
    }))
    return json({ items: records, moderationEnabled: true })
  } catch {
    return json({ error: 'moderation_unavailable' }, 503)
  }
}
