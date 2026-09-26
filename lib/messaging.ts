import { createClient } from "@/lib/supabase/client"

export type MessageKind = "text" | "voice" | "view-once" | "system"

export interface DBMessage {
  id: string
  conversation_id: string
  sender_id: string
  kind: MessageKind
  content: string | null
  media_url: string | null
  duration_sec: number | null
  is_opened: boolean
  created_at: string
}

export interface ConversationSummary {
  conversationId: string
  otherId: string
  otherUsername: string
  otherDisplayName: string
  otherAvatarUrl: string | null
  otherIsVerified: boolean
  lastMessageContent: string | null
  lastMessageKind: MessageKind | null
  lastMessageSender: string | null
  lastMessageAt: string | null
  unreadCount: number
  updatedAt: string
}

export interface UserSearchResult {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  isVerified: boolean
}

/** Voice payloads store their waveform as JSON in `content`. */
export function encodeVoiceContent(waveform: number[]): string {
  return JSON.stringify({ waveform })
}

export function decodeWaveform(content: string | null): number[] {
  if (!content) return []
  try {
    const parsed = JSON.parse(content)
    return Array.isArray(parsed?.waveform) ? parsed.waveform : []
  } catch {
    return []
  }
}

export async function listConversations(): Promise<ConversationSummary[]> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("list_conversations")
  if (error) throw error
  return (data ?? []).map((row: Record<string, unknown>) => ({
    conversationId: row.conversation_id as string,
    otherId: row.other_id as string,
    otherUsername: row.other_username as string,
    otherDisplayName: row.other_display_name as string,
    otherAvatarUrl: (row.other_avatar_url as string) ?? null,
    otherIsVerified: Boolean(row.other_is_verified),
    lastMessageContent: (row.last_message_content as string) ?? null,
    lastMessageKind: (row.last_message_kind as MessageKind) ?? null,
    lastMessageSender: (row.last_message_sender as string) ?? null,
    lastMessageAt: (row.last_message_at as string) ?? null,
    unreadCount: Number(row.unread_count ?? 0),
    updatedAt: row.updated_at as string,
  }))
}

export async function getOrCreateConversation(otherUserId: string): Promise<string> {
  const supabase = createClient()
  const { data, error } = await supabase.rpc("get_or_create_conversation", {
    other_user: otherUserId,
  })
  if (error) throw error
  return data as string
}

export async function fetchMessages(conversationId: string): Promise<DBMessage[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from("messages")
    .select("id, conversation_id, sender_id, kind, content, media_url, duration_sec, is_opened, created_at")
    .eq("conversation_id", conversationId)
    .order("created_at", { ascending: true })
  if (error) throw error
  return (data ?? []) as DBMessage[]
}

export async function sendTextMessage(conversationId: string, content: string): Promise<DBMessage> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("not authenticated")

  const { data, error } = await supabase
    .from("messages")
    .insert({ conversation_id: conversationId, sender_id: user.id, kind: "text", content })
    .select("id, conversation_id, sender_id, kind, content, media_url, duration_sec, is_opened, created_at")
    .single()
  if (error) throw error
  return data as DBMessage
}

async function uploadChatMedia(conversationId: string, blob: Blob, ext: string): Promise<string> {
  const supabase = createClient()
  const path = `${conversationId}/${crypto.randomUUID()}.${ext}`
  const { error } = await supabase.storage.from("chat-media").upload(path, blob, {
    contentType: blob.type || undefined,
    upsert: false,
  })
  if (error) throw error
  return path
}

export async function sendVoiceMessage(
  conversationId: string,
  blob: Blob,
  durationSec: number,
  waveform: number[],
): Promise<DBMessage> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("not authenticated")

  const ext = blob.type.includes("mp4") ? "mp4" : blob.type.includes("ogg") ? "ogg" : "webm"
  const path = await uploadChatMedia(conversationId, blob, ext)

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      kind: "voice",
      content: encodeVoiceContent(waveform),
      media_url: path,
      duration_sec: Math.max(1, Math.round(durationSec)),
    })
    .select("id, conversation_id, sender_id, kind, content, media_url, duration_sec, is_opened, created_at")
    .single()
  if (error) throw error
  return data as DBMessage
}

export async function sendViewOnceMessage(conversationId: string, blob: Blob): Promise<DBMessage> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) throw new Error("not authenticated")

  const ext = blob.type.includes("png") ? "png" : "jpg"
  const path = await uploadChatMedia(conversationId, blob, ext)

  const { data, error } = await supabase
    .from("messages")
    .insert({
      conversation_id: conversationId,
      sender_id: user.id,
      kind: "view-once",
      media_url: path,
    })
    .select("id, conversation_id, sender_id, kind, content, media_url, duration_sec, is_opened, created_at")
    .single()
  if (error) throw error
  return data as DBMessage
}

export async function markViewOnceOpened(messageId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.from("messages").update({ is_opened: true }).eq("id", messageId)
  if (error) throw error
}

export async function markConversationRead(conversationId: string): Promise<void> {
  const supabase = createClient()
  const { error } = await supabase.rpc("mark_conversation_read", { conv: conversationId })
  if (error) throw error
}

/** Signed URL for a private chat-media object path. */
export async function getMediaUrl(path: string, expiresIn = 60 * 60): Promise<string | null> {
  const supabase = createClient()
  const { data, error } = await supabase.storage.from("chat-media").createSignedUrl(path, expiresIn)
  if (error) return null
  return data?.signedUrl ?? null
}

export async function searchUsers(query: string, limit = 20): Promise<UserSearchResult[]> {
  const supabase = createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  let builder = supabase
    .from("profiles")
    .select("id, username, display_name, avatar_url, is_verified")
    .order("follower_count", { ascending: false })
    .limit(limit)

  const q = query.trim()
  if (q) {
    builder = builder.or(`username.ilike.%${q}%,display_name.ilike.%${q}%`)
  }

  const { data, error } = await builder
  if (error) throw error

  return (data ?? [])
    .filter((row) => row.id !== user?.id)
    .map((row) => ({
      id: row.id as string,
      username: row.username as string,
      displayName: row.display_name as string,
      avatarUrl: (row.avatar_url as string) ?? null,
      isVerified: Boolean(row.is_verified),
    }))
}
