import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@/lib/supabase/server'
import { createDirectVideoUpload, getStreamConfig, videoRequestIsValid } from '@/lib/video/stream-upload'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

function json(body: unknown, status = 200) {
  return NextResponse.json(body, { status, headers: { 'Cache-Control': 'private, no-store' } })
}

export async function GET() {
  // Feature discovery only; no credentials, quotas or user records exposed.
  return json({ enabled: Boolean(getStreamConfig()) })
}

export async function POST(request: NextRequest) {
  const config = getStreamConfig()
  if (!config) return json({ error: 'upload_not_configured' }, 503)
  const origin = request.headers.get('origin')
  if (!origin || origin !== request.nextUrl.origin ||
      request.headers.get('sec-fetch-site') === 'cross-site') {
    return json({ error: 'invalid_origin' }, 403)
  }
  if (Number(request.headers.get('content-length') || 0) > 2048) {
    return json({ error: 'invalid_request' }, 413)
  }
  let payload: unknown
  try { payload = await request.json() } catch { return json({ error: 'invalid_json' }, 400) }
  if (!videoRequestIsValid(payload)) return json({ error: 'invalid_video' }, 400)

  try {
    const db = await createClient()
    const { data, error } = await db.auth.getUser()
    if (error || !data.user) return json({ error: 'unauthorized' }, 401)
    const { data: id, error: quotaError } = await db.rpc('reserve_stream_upload')
    if (quotaError) {
      // Never leak SQL messages or table/schema details.
      return json({ error: quotaError.message?.includes('upload_daily_limit') ? 'daily_limit' : 'upload_storage_not_configured' }, quotaError.message?.includes('upload_daily_limit') ? 429 : 503)
    }
    if (typeof id !== 'string') return json({ error: 'upload_storage_unavailable' }, 503)
    const direct = await createDirectVideoUpload(config, data.user.id, id)
    const { data: attached, error: attachError } = await db.rpc('attach_stream_upload', {
      p_id: id,
      p_uid: direct.uid,
    })
    if (attachError || attached !== true) {
      // No URL leaks to the client if ownership persistence fails.
      return json({ error: 'upload_storage_unavailable' }, 503)
    }
    return json({ reservationId: id, uploadURL: direct.uploadURL, maxBytes: 100 * 1024 * 1024, expiresInSeconds: 900 }, 201)
  } catch {
    return json({ error: 'upload_unavailable' }, 503)
  }
}
