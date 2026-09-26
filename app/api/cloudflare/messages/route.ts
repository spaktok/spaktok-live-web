import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareBindings } from '@/lib/cloudflare/env'
import { insertD1TextMessage, listD1Messages } from '@/lib/cloudflare/d1-repository'
import { getAuthenticatedUserId } from '@/lib/supabase/get-authenticated-user-id'

export const runtime = 'edge'

export async function GET(request: NextRequest) {
  const bindings = getCloudflareBindings()
  if (!bindings) return NextResponse.json({ error: 'Cloudflare data layer is not configured' }, { status: 503 })

  const userId = await getAuthenticatedUserId()
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  const conversationId = request.nextUrl.searchParams.get('conversationId')?.trim()
  if (!conversationId) return NextResponse.json({ error: 'conversationId is required' }, { status: 400 })

  const rawLimit = request.nextUrl.searchParams.get('limit')
  const limit = rawLimit === null ? 50 : Number(rawLimit)
  if (!Number.isInteger(limit) || limit < 1 || limit > 100) {
    return NextResponse.json({ error: 'limit must be an integer between 1 and 100' }, { status: 400 })
  }

  const before = request.nextUrl.searchParams.get('before') || undefined
  try {
    const messages = await listD1Messages(bindings.DB, userId, conversationId, { limit, before })
    return NextResponse.json({ messages })
  } catch (error) {
    if (error instanceof Error && error.message === 'conversation_forbidden') {
      return NextResponse.json({ error: 'Conversation access denied' }, { status: 403 })
    }
    return NextResponse.json({ error: 'Unable to load messages' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const bindings = getCloudflareBindings()
  if (!bindings) return NextResponse.json({ error: 'Cloudflare data layer is not configured' }, { status: 503 })

  const userId = await getAuthenticatedUserId()
  if (!userId) return NextResponse.json({ error: 'Authentication required' }, { status: 401 })

  let payload: unknown
  try {
    payload = await request.json()
  } catch {
    return NextResponse.json({ error: 'A valid JSON body is required' }, { status: 400 })
  }

  if (!payload || typeof payload !== 'object' || Array.isArray(payload)) {
    return NextResponse.json({ error: 'A valid JSON object is required' }, { status: 400 })
  }

  const body = payload as { conversationId?: unknown; content?: unknown }
  const conversationId = typeof body.conversationId === 'string' ? body.conversationId.trim() : ''
  if (!conversationId || typeof body.content !== 'string') {
    return NextResponse.json({ error: 'conversationId and content are required' }, { status: 400 })
  }

  try {
    const message = await insertD1TextMessage(bindings.DB, userId, conversationId, body.content)
    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown'
    if (reason === 'invalid_message_content') return NextResponse.json({ error: 'Invalid message content' }, { status: 422 })
    if (reason === 'conversation_forbidden') return NextResponse.json({ error: 'Conversation access denied' }, { status: 403 })
    return NextResponse.json({ error: 'Unable to send message' }, { status: 500 })
  }
}
