import { NextRequest, NextResponse } from 'next/server'
import { getNativeDatabase } from '@/lib/cloudflare/native-db'
import { decodeFeedCursor, listPublicVideoPage } from '@/lib/cloudflare/video-feed'

export const runtime = 'edge'
export const dynamic = 'force-dynamic'
const NO_STORE = { 'Cache-Control': 'no-store' }
const PUBLIC_CACHE = { 'Cache-Control': 'public, max-age=5, s-maxage=30, stale-while-revalidate=90' }

export async function GET(request: NextRequest) {
  const raw = request.nextUrl.searchParams.get('limit')
  if (raw !== null && (!/^\d{1,3}$/.test(raw) || Number(raw) < 1)) {
    return NextResponse.json({ error: 'invalid_limit' }, { status: 400, headers: NO_STORE })
  }
  let cursor
  try {
    const token = request.nextUrl.searchParams.get('cursor')
    cursor = token === null ? undefined : decodeFeedCursor(token)
  } catch {
    return NextResponse.json({ error: 'invalid_cursor' }, { status: 400, headers: NO_STORE })
  }
  const db = await getNativeDatabase()
  if (!db) return NextResponse.json({ error: 'feed_not_configured' }, { status: 503, headers: NO_STORE })
  try {
    const page = await listPublicVideoPage(db, { limit: Number(raw ?? 12), cursor })
    return NextResponse.json(page, { headers: PUBLIC_CACHE })
  } catch {
    return NextResponse.json({ error: 'feed_unavailable' }, { status: 503, headers: NO_STORE })
  }
}
