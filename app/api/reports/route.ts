import { NextRequest, NextResponse } from 'next/server'
import { getNativeUser, rateLimit } from '@/lib/native/auth'
import { parseReport } from '@/lib/moderation/spaktok-report-rules'
import { createReport, listMine } from '@/lib/server/spaktok-moderation'
export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'
const json = (body: unknown, status = 200) => NextResponse.json(body, { status, headers: { 'Cache-Control': 'no-store' } })

export async function GET() {
  try {
    const user = await getNativeUser()
    if (!user) return json({ error: 'unauthorized' }, 401)
    return json({ items: await listMine(user.id) })
  } catch { return json({ error: 'reports_unavailable' }, 503) }
}

export async function POST(req: NextRequest) {
  if (req.headers.get('origin') !== req.nextUrl.origin) return json({ error: 'invalid_origin' }, 403)
  let body: unknown
  try { body = await req.json() } catch { return json({ error: 'invalid_json' }, 400) }
  const input = parseReport(body)
  if (!input) return json({ error: 'invalid_request' }, 400)
  try {
    const user = await getNativeUser()
    if (!user) return json({ error: 'unauthorized' }, 401)
    if (!(await rateLimit('report:' + user.id, 20))) return json({ error: 'rate_limited' }, 429)
    const result = await createReport(user.id, input)
    if (!result.ok) return json({ error: result.error }, result.error === 'target_not_found' ? 404 : 409)
    return json({ id: result.id }, 201)
  } catch { return json({ error: 'reports_unavailable' }, 503) }
}
