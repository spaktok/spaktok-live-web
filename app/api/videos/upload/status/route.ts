import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { getStreamConfig, getVideoProcessingState, validUUID } from '@/lib/video/stream-upload'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

export async function GET(request: NextRequest) {
  const config = getStreamConfig()
  if (!config) return json({ error: 'upload_not_configured' }, 503)
  const id = request.nextUrl.searchParams.get('id')
  if (!id || !validUUID(id)) return json({ error: 'invalid_id' }, 400)
  try {
    const db = await createClient()
    const { data, error } = await db.auth.getUser()
    if (error || !data.user) return json({ error: 'unauthorized' }, 401)
    // RLS on stream_uploads restricts this read to the requesting owner.
    const { data: reserved, error: lookupError } = await db
      .from('stream_uploads')
      .select('id,user_id,stream_uid')
      .eq('id', id)
      .eq('user_id', data.user.id)
      .maybeSingle()
    if (lookupError) return json({ error: 'upload_storage_not_configured' }, 503)
    if (!reserved) return json({ error: 'not_found' }, 404)
    if (!reserved.stream_uid) return json({ state: 'pending_upload' })
    const result = await getVideoProcessingState(config, reserved.stream_uid, data.user.id, id)
    return json(result)
  } catch {
    return json({ error: 'upload_unavailable' }, 503)
  }
}
