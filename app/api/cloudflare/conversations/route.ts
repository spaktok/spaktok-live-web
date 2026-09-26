import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareBindings } from '@/lib/cloudflare/env'
import { listD1Conversations } from '@/lib/cloudflare/d1-repository'
import { getAuthenticatedUserId } from '@/lib/supabase/get-authenticated-user-id'

export const runtime = 'edge'

export async function GET(_request: NextRequest) {
  const bindings = getCloudflareBindings()
  if (!bindings) return NextResponse.json({ error: 'Cloudflare data layer is not configured' }, { status: 503 })

  const userId = await getAuthenticatedUserId()
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  try {
    const conversations = await listD1Conversations(bindings.DB, userId)
    return NextResponse.json({ conversations })
  } catch {
    return NextResponse.json({ error: 'Unable to load conversations' }, { status: 500 })
  }
}
