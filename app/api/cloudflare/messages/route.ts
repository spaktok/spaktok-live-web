import { NextRequest, NextResponse } from 'next/server'
import { getCloudflareBindings } from '@/lib/cloudflare/env'
import { insertD1TextMessage, listD1Messages } from '@/lib/cloudflare/d1-repository'

export const runtime = 'edge'

function authUser(request: NextRequest) {
  return request.headers.get('x-spaktok-user-id')?.trim() || null
}

export async function GET(request: NextRequest) {
  const bindings = getCloudflareBindings()
  const userId = authUser(request)
  const conversationId = request.nextUrl.searchParams.get('conversationId')
  if (!bindings) return NextResponse.json({ error: 'Cloudflare data layer is not configured' }, { status: 503 })
  if (!userId || !conversationId) return NextResponse.json({ error: 'Authentication and conversationId are required' }, { status: 400 })

  const limit = Number(request.nextUrl.searchParams.get('limit') || 50)
  const before = request.nextUrl.searchParams.get('before') || undefined
  try {
    const messages = await listD1Messages(bindings.DB, userId, conversationId, { limit, before })
    return NextResponse.json({ messages })
  } catch {
    return NextResponse.json({ error: 'Unable to load messages' }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  const bindings = getCloudflareBindings()
  const userId = authUser(request)
  if (!bindings || !userId) return NextResponse.json({ error: 'Authentication or Cloudflare data layer is missing' }, { status: 401 })

  try {
    const body = await request.json() as { conversationId?: string; content?: string }
    if (!body.conversationId || typeof body.content !== 'string') return NextResponse.json({ error: 'conversationId and content are required' }, { status: 400 })
    const message = await insertD1TextMessage(bindings.DB, userId, body.conversationId, body.content)
    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    const reason = error instanceof Error ? error.message : 'unknown'
    if (reason === 'invalid_message_content') return NextResponse.json({ error: 'Invalid message content' }, { status: 422 })
    if (reason === 'conversation_forbidden') return NextResponse.json({ error: 'Conversation access denied' }, { status: 403 })
    return NextResponse.json({ error: 'Unable to send message' }, { status: 500 })
  }
}

