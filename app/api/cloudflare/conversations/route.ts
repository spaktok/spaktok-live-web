import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareBindings } from '@/lib/cloudflare/env'
import { listD1Conversations } from '@/lib/cloudflare/d1-repository'

export const runtime = 'edge'

function getUserId(request: NextRequest) {
  return request.headers.get('x-spaktok-user-id')?.trim() || null
}

export async function GET(request: NextRequest) {
  const bindings = getCloudflareBindings()
  const userId = getUserId(request)
  if (!bindings) return NextResponse.json({ error: 'Cloudflare data layer is not configured' }, { status: 503 })
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  try {
    const conversations = await listD1Conversations(bindings.DB, userId)
    return NextResponse.json({ conversations })
  } catch {
    return NextResponse.json({ error: 'Unable to load conversations' }, { status: 500 })
  }
}

