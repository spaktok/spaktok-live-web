import type { DBMessage, ConversationSummary, MessageKind } from "@/lib/messaging"

export interface CloudflareBindings {
  DB: D1DatabaseLike
}

export interface D1DatabaseLike {
  prepare(query: string): D1PreparedStatement
}

export interface D1PreparedStatement {
  bind(...values: unknown[]): D1PreparedStatement
  first<T = Record<string, unknown>>(): Promise<T | null>
  all<T = Record<string, unknown>>(): Promise<{ results: T[] }>
  run(): Promise<unknown>
}

interface ConversationRow {
  conversation_id: string
  other_id: string
  other_username: string
  other_display_name: string
  other_avatar_url: string | null
  other_is_verified: number
  last_message_content: string | null
  last_message_kind: MessageKind | null
  last_message_sender: string | null
  last_message_at: string | null
  unread_count: number
  updated_at: string
}

interface MessageRow extends Omit<DBMessage, "is_opened"> {
  is_opened: number
}

function mapConversation(row: ConversationRow): ConversationSummary {
  return {
    conversationId: row.conversation_id,
    otherId: row.other_id,
    otherUsername: row.other_username,
    otherDisplayName: row.other_display_name,
    otherAvatarUrl: row.other_avatar_url,
    otherIsVerified: row.other_is_verified === 1,
    lastMessageContent: row.last_message_content,
    lastMessageKind: row.last_message_kind,
    lastMessageSender: row.last_message_sender,
    lastMessageAt: row.last_message_at,
    unreadCount: Number(row.unread_count ?? 0),
    updatedAt: row.updated_at,
  }
}

function mapMessage(row: MessageRow): DBMessage {
  return { ...row, is_opened: row.is_opened === 1 }
}

export async function listD1Conversations(
  db: D1DatabaseLike,
  userId: string,
): Promise<ConversationSummary[]> {
  const result = await db
    .prepare(
      `SELECT c.id AS conversation_id,
        CASE WHEN c.user_a = ?1 THEN c.user_b ELSE c.user_a END AS other_id,
        p.username AS other_username, p.display_name AS other_display_name,
        p.avatar_url AS other_avatar_url, p.is_verified AS other_is_verified,
        m.content AS last_message_content, m.kind AS last_message_kind,
        m.sender_id AS last_message_sender, m.created_at AS last_message_at,
        (SELECT COUNT(*) FROM messages unread
          WHERE unread.conversation_id = c.id
            AND unread.sender_id != ?1 AND unread.is_opened = 0) AS unread_count,
        c.updated_at
       FROM conversations c
       JOIN profiles p ON p.id = CASE WHEN c.user_a = ?1 THEN c.user_b ELSE c.user_a END
       LEFT JOIN messages m ON m.id = (
         SELECT latest.id FROM messages latest
         WHERE latest.conversation_id = c.id
         ORDER BY latest.created_at DESC LIMIT 1
       )
       WHERE c.user_a = ?1 OR c.user_b = ?1
       ORDER BY c.updated_at DESC`,
    )
    .bind(userId)
    .all<ConversationRow>()

  return result.results.map(mapConversation)
}

export async function listD1Messages(
  db: D1DatabaseLike,
  userId: string,
  conversationId: string,
  options: { limit?: number; before?: string } = {},
): Promise<DBMessage[]> {
  const membership = await db
    .prepare("SELECT id FROM conversations WHERE id = ?1 AND (user_a = ?2 OR user_b = ?2)")
    .bind(conversationId, userId)
    .first<{ id: string }>()

  if (!membership) throw new Error("conversation_forbidden")

  const limit = Math.min(Math.max(options.limit ?? 50, 1), 100)
  const before = options.before ?? null
  const result = await db
    .prepare(
      `SELECT id, conversation_id, sender_id, kind, content, media_key AS media_url,
        duration_sec, is_opened, created_at
       FROM messages
       WHERE conversation_id = ?1
         AND (?2 IS NULL OR created_at < ?2)
       ORDER BY created_at DESC
       LIMIT ?3`,
    )
    .bind(conversationId, before, limit)
    .all<MessageRow>()

  return result.results.reverse().map(mapMessage)
}

export async function insertD1TextMessage(
  db: D1DatabaseLike,
  userId: string,
  conversationId: string,
  content: string,
): Promise<DBMessage> {
  const trimmed = content.trim()
  if (!trimmed || trimmed.length > 4000) throw new Error("invalid_message_content")

  const membership = await db
    .prepare("SELECT id FROM conversations WHERE id = ?1 AND (user_a = ?2 OR user_b = ?2)")
    .bind(conversationId, userId)
    .first<{ id: string }>()

  if (!membership) throw new Error("conversation_forbidden")

  const messageId = crypto.randomUUID()
  await db
    .prepare(
      `INSERT INTO messages (id, conversation_id, sender_id, kind, content)
       VALUES (?1, ?2, ?3, 'text', ?4)`,
    )
    .bind(messageId, conversationId, userId, trimmed)
    .run()

  await db.prepare("UPDATE conversations SET updated_at = datetime('now') WHERE id = ?1").bind(conversationId).run()

  const message = await db
    .prepare(
      `SELECT id, conversation_id, sender_id, kind, content, media_key AS media_url,
        duration_sec, is_opened, created_at FROM messages WHERE id = ?1`,
    )
    .bind(messageId)
    .first<MessageRow>()

  if (!message) throw new Error("message_insert_failed")
  return mapMessage(message)
}

export async function markD1ConversationRead(
  db: D1DatabaseLike,
  userId: string,
  conversationId: string,
): Promise<void> {
  await db
    .prepare(
      `UPDATE messages SET is_opened = 1 WHERE conversation_id = ?1
       AND sender_id != ?2
       AND EXISTS (SELECT 1 FROM conversations c WHERE c.id = ?1 AND (c.user_a = ?2 OR c.user_b = ?2))`,
    )
    .bind(conversationId, userId)
    .run()
}
