import { NextRequest, NextResponse } from 'next/server'
import { getNativeUser, rateLimit } from '@/lib/native/auth'
import { validId } from '@/lib/native/d1'
import { isSide } from '@/lib/live/spaktok-pk-rules'
import { battleState, cancelBattle, castVote, respondToInvite } from '@/lib/server/spaktok-pk'
export const runtime = 'nodejs'
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })
type Ctx = { params: Promise<{ id: string }> }

export async function GET(_req: NextRequest, { params }: Ctx) {
  const { id } = await params
  if (!validId(id)) return json({ error: 'not_found' }, 404)
  try {
    const user = await getNativeUser()
    const state = await battleState(id, user?.id ?? null)
    return state ? json(state) : json({ error: 'not_found' }, 404)
  } catch { return json({ error: 'pk_unavailable' }, 503) }
}

/** Actions: accept | decline (guest), cancel (participant), vote (signed-in viewer). */
export async function POST(req: NextRequest, { params }: Ctx) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return json({ error: 'invalid_origin' }, 403)
  const { id } = await params
  if (!validId(id)) return json({ error: 'not_found' }, 404)
  let body: { action?: unknown; side?: unknown } | null
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const action = body?.action
  try {
    const user = await getNativeUser()
    if (!user) return json({ error: 'unauthorized' }, 401)
    if (action === 'accept' || action === 'decline') {
      const ok = await respondToInvite(id, user.id, action === 'accept')
      return ok ? json({ ok: true }) : json({ error: 'invite_unavailable' }, 409)
    }
    if (action === 'cancel') {
      return (await cancelBattle(id, user.id)) ? json({ ok: true }) : json({ error: 'cannot_cancel' }, 409)
    }
    if (action === 'vote') {
      if (!isSide(body?.side)) return json({ error: 'invalid_request' }, 400)
      if (!(await rateLimit('pk-vote:' + user.id, 120))) return json({ error: 'rate_limited' }, 429)
      const result = await castVote(id, user.id, body.side)
      if (result.ok) return json({ ok: true, round: result.round })
      return json({ error: result.error }, result.error === 'not_found' ? 404 : result.error === 'participant_cannot_vote' ? 403 : 409)
    }
    return json({ error: 'invalid_request' }, 400)
  } catch { return json({ error: 'pk_unavailable' }, 503) }
}
