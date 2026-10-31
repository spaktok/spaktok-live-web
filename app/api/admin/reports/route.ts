import { NextRequest, NextResponse } from 'next/server'
import { getNativeUser } from '@/lib/native/auth'
import { parseAppealDecision, parseDecision } from '@/lib/moderation/spaktok-report-rules'
import { decide, decideAppeal, moderationQueue, moderatorId } from '@/lib/server/spaktok-moderation'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

async function authorize(): Promise<string | NextResponse> {
  const admin = moderatorId()
  if (!admin) return json({ error: 'moderation_not_configured' }, 503)
  const user = await getNativeUser()
  if (!user) return json({ error: 'unauthorized' }, 401)
  if (user.id.toLowerCase() !== admin) return json({ error: 'forbidden' }, 403)
  return admin
}

export async function GET() {
  try {
    const actor = await authorize()
    if (typeof actor !== 'string') return actor
    return json({ items: await moderationQueue() })
  } catch { return json({ error: 'moderation_unavailable' }, 503) }
}

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return json({ error: 'invalid_origin' }, 403)
  let body: unknown
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  try {
    const actor = await authorize()
    if (typeof actor !== 'string') return actor
    const kind = (body as { kind?: unknown } | null)?.kind
    if (kind === 'decision') {
      const d = parseDecision(body)
      if (!d) return json({ error: 'invalid_request' }, 400)
      const r = await decide(actor, d)
      return r === 'ok' ? json({ ok: true }) : json({ error: r }, 404)
    }
    if (kind === 'appeal') {
      const a = parseAppealDecision(body)
      if (!a) return json({ error: 'invalid_request' }, 400)
      const r = await decideAppeal(actor, a.reportId, a.outcome, a.reason)
      return r === 'ok' ? json({ ok: true }) : json({ error: r }, r === 'not_found' ? 404 : 409)
    }
    return json({ error: 'invalid_request' }, 400)
  } catch { return json({ error: 'moderation_unavailable' }, 503) }
}
