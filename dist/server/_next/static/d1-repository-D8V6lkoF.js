function e(){let e=globalThis,t=e.__env__??e.env;return t?.DB?t:null}function t(e){return{conversationId:e.conversation_id,otherId:e.other_id,otherUsername:e.other_username,otherDisplayName:e.other_display_name,otherAvatarUrl:e.other_avatar_url,otherIsVerified:e.other_is_verified===1,lastMessageContent:e.last_message_content,lastMessageKind:e.last_message_kind,lastMessageSender:e.last_message_sender,lastMessageAt:e.last_message_at,unreadCount:Number(e.unread_count??0),updatedAt:e.updated_at}}function n(e){return{...e,is_opened:e.is_opened===1}}async function r(e,n){return(await e.prepare(`SELECT c.id AS conversation_id,
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
       ORDER BY c.updated_at DESC`).bind(n).all()).results.map(t)}async function i(e,t,r,i={}){if(!await e.prepare(`SELECT id FROM conversations WHERE id = ?1 AND (user_a = ?2 OR user_b = ?2)`).bind(r,t).first())throw Error(`conversation_forbidden`);let a=Math.min(Math.max(i.limit??50,1),100),o=i.before??null;return(await e.prepare(`SELECT id, conversation_id, sender_id, kind, content, media_key AS media_url,
        duration_sec, is_opened, created_at
       FROM messages
       WHERE conversation_id = ?1
         AND (?2 IS NULL OR created_at < ?2)
       ORDER BY created_at DESC
       LIMIT ?3`).bind(r,o,a).all()).results.reverse().map(n)}async function a(e,t,r,i){let a=i.trim();if(!a||a.length>4e3)throw Error(`invalid_message_content`);if(!await e.prepare(`SELECT id FROM conversations WHERE id = ?1 AND (user_a = ?2 OR user_b = ?2)`).bind(r,t).first())throw Error(`conversation_forbidden`);let o=crypto.randomUUID();await e.prepare(`INSERT INTO messages (id, conversation_id, sender_id, kind, content)
       VALUES (?1, ?2, ?3, 'text', ?4)`).bind(o,r,t,a).run(),await e.prepare(`UPDATE conversations SET updated_at = datetime('now') WHERE id = ?1`).bind(r).run();let s=await e.prepare(`SELECT id, conversation_id, sender_id, kind, content, media_key AS media_url,
        duration_sec, is_opened, created_at FROM messages WHERE id = ?1`).bind(o).first();if(!s)throw Error(`message_insert_failed`);return n(s)}export{e as i,r as n,i as r,a as t};