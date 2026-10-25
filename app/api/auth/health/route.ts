import { NextResponse } from 'next/server'

export const runtime = 'nodejs'
export const dynamic = 'force-dynamic'

/** Diagnostic only: no Supabase project ID or token appears in the response. */
export async function GET() {
  const value = process.env.NEXT_PUBLIC_SUPABASE_URL
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
  if (!value || !key) {
    return NextResponse.json({ status: 'misconfigured' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  let base: URL
  try {
    base = new URL(value)
    if (base.protocol !== 'https:' || !base.hostname.endsWith('.supabase.co') ||
        base.username || base.password) throw new Error('invalid_url')
  } catch {
    return NextResponse.json({ status: 'misconfigured' }, { status: 503, headers: { 'Cache-Control': 'no-store' } })
  }
  try {
    const endpoint = new URL('/auth/v1/health', base)
    const response = await fetch(endpoint, { method: 'GET', cache: 'no-store', signal: AbortSignal.timeout(5000) })
    // 2xx indicates GoTrue reachable; other codes are reported without details.
    return NextResponse.json({ status: response.ok ? 'available' : 'unavailable' }, {
      status: response.ok ? 200 : 503,
      headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30' },
    })
  } catch {
    return NextResponse.json({ status: 'unavailable' }, { status: 503, headers: { 'Cache-Control': 'public, max-age=0, s-maxage=30' } })
  }
}
