import { NextRequest, NextResponse } from 'next/server'
import { getNativeUser, rateLimit } from '@/lib/native/auth'
import { validId } from '@/lib/native/d1'
import { parseAppeal } from '@/lib/moderation/spaktok-report-rules'
import { fileAppeal } from '@/lib/server/spaktok-moderation'
export const runtime = 'nodejs'
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function POST(req: NextRequest, { params }: { params: Promise<{ id: string }> }) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return json({ error: 'invalid_origin' }, 403)
  const { id } = await params
  if (!validId(id)) return json({ error: 'invalid_request' }, 400)
  let body: unknown
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const text = parseAppeal(body)
  if (!text) return json({ error: 'invalid_request' }, 400)
  try {
    const user = await getNativeUser()
    if (!user) return json({ error: 'unauthorized' }, 401)
    if (!(await rateLimit('appeal:' + user.id, 10))) return json({ error: 'rate_limited' }, 429)
    const result = await fileAppeal(user.id, id.toLowerCase(), text)
    if (result !== 'ok') return json({ error: result }, result === 'not_found' ? 404 : 409)
    return json({ ok: true })
  } catch { return json({ error: 'reports_unavailable' }, 503) }
}
