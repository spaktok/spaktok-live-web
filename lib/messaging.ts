export type MessageKind='text'|'voice'|'view-once'|'system'
export interface DBMessage {
  id:string;conversation_id:string;sender_id:string;kind:MessageKind;
  content:string|null;media_url:string|null;duration_sec:number|null;is_opened:boolean;created_at:string
}
export interface ConversationSummary {
  conversationId:string;otherId:string;otherUsername:string;otherDisplayName:string;
  otherAvatarUrl:string|null;otherIsVerified:boolean;
  lastMessageContent:string|null;lastMessageKind:MessageKind|null;
  lastMessageSender:string|null;lastMessageAt:string|null;unreadCount:number;updatedAt:string
}
export interface UserSearchResult {
  id:string;username:string;displayName:string;avatarUrl:string|null;isVerified:boolean
}
async function get<T>(params:URLSearchParams):Promise<T>{
  const res=await fetch('/api/native/chat?'+params,{cache:'no-store'})
  if(!res.ok)throw new Error('chat_unavailable')
  return res.json() as Promise<T>
}
async function post<T>(body:unknown):Promise<T>{
  const res=await fetch('/api/native/chat',{method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify(body)})
  if(!res.ok)throw new Error('chat_unavailable')
  return res.json() as Promise<T>
}
export async function listConversations(){return (await get<{conversations:ConversationSummary[]}>(new URLSearchParams({mode:'conversations'}))).conversations}
export async function getOrCreateConversation(otherUserId:string){
  return (await post<{conversationId:string}>({action:'start',otherUserId})).conversationId
}
export async function fetchMessages(conversationId:string){
  return (await get<{messages:DBMessage[]}>(new URLSearchParams({mode:'messages',conversationId}))).messages
}
export async function sendTextMessage(conversationId:string,content:string){
  return (await post<{message:DBMessage}>({action:'send',conversationId,content})).message
}
export async function searchUsers(query:string,limit=20){
  return (await get<{users:UserSearchResult[]}>(new URLSearchParams({mode:'users',q:query}))).users.slice(0,limit)
}
export function encodeVoiceContent(waveform:number[]){return JSON.stringify({waveform})}
export function decodeWaveform(content:string|null):number[]{
  try {const v=JSON.parse(content||'{}') as {waveform?:number[]};return Array.isArray(v.waveform)?v.waveform:[]}
  catch{return []}
}
// Media uploads and self-destructing images require R2 + encryption & cleanup.
export async function sendVoiceMessage(_id:string,_blob:Blob,_seconds:number,_waveform:number[]):Promise<DBMessage>{
  throw new Error('media_storage_not_configured')
}
export async function sendViewOnceMessage(_id:string,_file:Blob):Promise<DBMessage>{
  throw new Error('media_storage_not_configured')
}
export async function markViewOnceOpened(_id:string):Promise<void>{throw new Error('media_storage_not_configured')}
export async function markConversationRead(_id:string):Promise<void>{/* read receipts not enabled */ }
export async function getMediaUrl(_path:string,_expiresIn=3600):Promise<string|null>{return null}
