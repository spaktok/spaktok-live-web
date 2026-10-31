import { NextRequest, NextResponse } from 'next/server'
import { getNativeUser, rateLimit } from '@/lib/native/auth'
import { parseCreate } from '@/lib/live/spaktok-pk-rules'
import { createBattle, listBattles } from '@/lib/server/spaktok-pk'
export const runtime = 'nodejs'
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function GET() {
  try {
    const user = await getNativeUser()
    return json(await listBattles(user?.id ?? null))
  } catch { return json({ error: 'pk_unavailable' }, 503) }
}

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return json({ error: 'invalid_origin' }, 403)
  let body: unknown
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const input = parseCreate(body)
  if (!input) return json({ error: 'invalid_request' }, 400)
  try {
    const user = await getNativeUser()
    if (!user) return json({ error: 'unauthorized' }, 401)
    if (!(await rateLimit('pk-create:' + user.id, 10))) return json({ error: 'rate_limited' }, 429)
    const result = await createBattle(user.id, input.guestUsername, input.rounds, input.roundSeconds)
    if (!result.ok) return json({ error: result.error }, result.error === 'guest_not_found' ? 404 : 409)
    return json({ id: result.id }, 201)
  } catch { return json({ error: 'pk_unavailable' }, 503) }
}
