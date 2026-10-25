import { NextRequest,NextResponse } from 'next/server'
import { getNativeUser } from '@/lib/native/auth'
import { oneD1,queryD1,validId } from '@/lib/native/d1'
import { createHash } from 'node:crypto'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private,no-store'}})
type Summary={conversationId:string;otherId:string;otherUsername:string;otherDisplayName:string;otherAvatarUrl:string|null;otherIsVerified:number;lastMessageContent:string|null;lastMessageSender:string|null;lastMessageAt:string|null;updatedAt:string}
type Msg={id:string;conversation_id:string;sender_id:string;content:string;created_at:string}
const authorized=async (conversation:string,userId:string)=>{
 const x=await oneD1<{n:number}>('SELECT count(*) AS n FROM conversation_participants WHERE conversation_id=? AND user_id=?',[conversation,userId])
 return Boolean(x?.n)
}
export async function GET(req:NextRequest){
  let user
  try{user=await getNativeUser()}catch{return json({error:'chat_unavailable'},503)}
  if(!user)return json({error:'unauthorized'},401)
  const mode=req.nextUrl.searchParams.get('mode')||'conversations'
  try{
    if(mode==='users'){
      const q=(req.nextUrl.searchParams.get('q')||'').trim().toLowerCase()
      if(q.length<1||q.length>35)return json({users:[]})
      const {rows}=await queryD1<{id:string;username:string;display_name:string;avatar_url:string|null;is_verified:number}>(
       'SELECT id,username,display_name,avatar_url,is_verified FROM profiles WHERE id<>? AND (instr(lower(username),?)>0 OR instr(lower(display_name),?)>0) ORDER BY follower_count DESC LIMIT 20',
       [user.id,q,q])
      return json({users:rows.map(r=>({id:r.id,username:r.username,displayName:r.display_name,avatarUrl:r.avatar_url,isVerified:Boolean(r.is_verified)}))})
    }
    if(mode==='messages'){
      const id=req.nextUrl.searchParams.get('conversationId')
      if(!validId(id))return json({error:'invalid_conversation'},400)
      if(!await authorized(id,user.id))return json({error:'forbidden'},403)
      const {rows}=await queryD1<Msg>(
        'SELECT id,conversation_id,sender_id,content,created_at FROM messages WHERE conversation_id=? ORDER BY created_at DESC,id DESC LIMIT 100',[id])
      return json({messages:rows.reverse().map(r=>({...r,kind:'text',media_url:null,duration_sec:null,is_opened:false}))})
    }
    if(mode!=='conversations')return json({error:'invalid_mode'},400)
    const {rows}=await queryD1<Summary>(`
      SELECT cp.conversation_id AS conversationId,
        p.id AS otherId,p.username AS otherUsername,p.display_name AS otherDisplayName,
        p.avatar_url AS otherAvatarUrl,p.is_verified AS otherIsVerified,
        m.content AS lastMessageContent,m.sender_id AS lastMessageSender,
        m.created_at AS lastMessageAt,
        coalesce(m.created_at,c.created_at) AS updatedAt
      FROM conversation_participants cp JOIN conversations c ON c.id=cp.conversation_id
      JOIN conversation_participants cp2 ON cp2.conversation_id=cp.conversation_id AND cp2.user_id<>?
      JOIN profiles p ON p.id=cp2.user_id
      LEFT JOIN messages m ON m.id=(
        SELECT m2.id FROM messages m2 WHERE m2.conversation_id=c.id
        ORDER BY m2.created_at DESC,m2.id DESC LIMIT 1
      ) WHERE cp.user_id=?
      ORDER BY updatedAt DESC LIMIT 50`,[user.id,user.id])
    return json({conversations:rows.map(r=>({...r,otherIsVerified:Boolean(r.otherIsVerified),
      lastMessageKind:r.lastMessageAt?'text':null,unreadCount:0}))})
  }catch{return json({error:'chat_unavailable'},503)}
}
export async function POST(req:NextRequest){
  if(req.headers.get('origin')!==req.nextUrl.origin)return json({error:'invalid_origin'},403)
  let body:unknown;try{body=await req.json()}catch{return json({error:'invalid_json'},400)}
  const b=body as {action?:unknown;otherUserId?:unknown;conversationId?:unknown;content?:unknown}|null
  if(!b)return json({error:'invalid_request'},400)
  try{
    const user=await getNativeUser()
    if(!user)return json({error:'unauthorized'},401)
    if(b.action==='start'){
      if(!validId(b.otherUserId)||b.otherUserId===user.id)return json({error:'invalid_user'},400)
      const other=await oneD1<{id:string}>('SELECT id FROM profiles WHERE id=?',[b.otherUserId])
      if(!other)return json({error:'not_found'},404)
      // Stable UUID derived from both participants; prevents duplicate direct chats.
      const ids=[user.id,b.otherUserId].sort().join(':')
      const h=createHash('sha256').update('spaktok-direct-chat-v1:'+ids).digest('hex').slice(0,32)
      const id=`${h.slice(0,8)}-${h.slice(8,12)}-4${h.slice(13,16)}-8${h.slice(17,20)}-${h.slice(20,32)}`
      await queryD1('INSERT OR IGNORE INTO conversations(id) VALUES (?)',[id])
      await queryD1('INSERT OR IGNORE INTO conversation_participants(conversation_id,user_id) VALUES (?,?)',[id,user.id])
      await queryD1('INSERT OR IGNORE INTO conversation_participants(conversation_id,user_id) VALUES (?,?)',[id,b.otherUserId])
      return json({conversationId:id},201)
    }
    if(b.action==='send'){
      if(!validId(b.conversationId)||typeof b.content!=='string'||!b.content.trim()||b.content.trim().length>2000)
        return json({error:'invalid_message'},400)
      if(!await authorized(b.conversationId,user.id))return json({error:'forbidden'},403)
      const id=crypto.randomUUID()
      await queryD1(`INSERT INTO messages(id,conversation_id,sender_id,content)
        SELECT ?,?,?,? WHERE EXISTS(
         SELECT 1 FROM conversation_participants WHERE conversation_id=? AND user_id=?)`,
        [id,b.conversationId,user.id,b.content.trim(),b.conversationId,user.id])
      const m=await oneD1<Msg>('SELECT id,conversation_id,sender_id,content,created_at FROM messages WHERE id=?',[id])
      if(!m)return json({error:'chat_unavailable'},503)
      return json({message:{...m,kind:'text',media_url:null,duration_sec:null,is_opened:false}},201)
    }
    return json({error:'invalid_action'},400)
  }catch{return json({error:'chat_unavailable'},503)}
}
