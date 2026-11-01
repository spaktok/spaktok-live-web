import {NextRequest,NextResponse} from 'next/server'
import {getNativeUser} from '@/lib/native/auth'
import {queryD1} from '@/lib/native/d1'
import {decodeActivityCursor,encodeActivityCursor,sortActivityRows,PAGE_SIZE} from '@/lib/native/activity-pagination'
export const runtime='nodejs'
export const dynamic='force-dynamic'
type Event={id:string;type:'like'|'follow'|'comment';actor_id:string;username:string;
  display_name:string;avatar_url:string|null;created_at:string;content:string;video_id:string|null}
const json=(payload:unknown,status=200)=>NextResponse.json(payload,{status,headers:{'Cache-Control':'private,no-store'}})
/** Actual recorded events, paginated with a stable timestamp + event-ID cursor.
 * Queries always scope to the signed-in user; cursors grant no permissions. */
export async function GET(req:NextRequest){
 try{
  const user=await getNativeUser()
  if(!user)return json({error:'unauthorized'},401)
  const cursor=decodeActivityCursor(req.nextUrl.searchParams.get('cursor'))
  if(cursor===undefined)return json({error:'invalid_cursor'},400)
  const conditions=(eventId:string)=>{
    return cursor?` AND (created_at < ? OR (created_at = ? AND ${eventId} < ?))`:''
  }
  const params=(base:string[])=>cursor?[...base,cursor.createdAt,cursor.createdAt,cursor.id]:base
  const [follows,likes,comments]=await Promise.all([
   queryD1<Event>(`SELECT 'follow:'||f.follower_id AS id,'follow' AS type,f.follower_id AS actor_id,
     p.username,p.display_name,p.avatar_url,f.created_at,'' AS content,NULL AS video_id
     FROM follows f JOIN profiles p ON p.id=f.follower_id
     WHERE f.following_id=?${conditions("'follow:'||f.follower_id").replaceAll('created_at','f.created_at')}
     ORDER BY f.created_at DESC,id DESC LIMIT 41`,params([user.id])),
   queryD1<Event>(`SELECT 'like:'||l.user_id||':'||l.video_id AS id,'like' AS type,l.user_id AS actor_id,
     p.username,p.display_name,p.avatar_url,l.created_at,'' AS content,l.video_id
     FROM likes l JOIN profiles p ON p.id=l.user_id JOIN videos v ON v.id=l.video_id
     WHERE v.user_id=? AND l.user_id<>?${conditions("'like:'||l.user_id||':'||l.video_id").replaceAll('created_at','l.created_at')}
     ORDER BY l.created_at DESC,id DESC LIMIT 41`,params([user.id,user.id])),
   queryD1<Event>(`SELECT 'comment:'||c.id AS id,'comment' AS type,c.user_id AS actor_id,
     p.username,p.display_name,p.avatar_url,c.created_at,c.content,c.video_id
     FROM comments c JOIN profiles p ON p.id=c.user_id JOIN videos v ON v.id=c.video_id
     WHERE v.user_id=? AND c.user_id<>?${conditions("'comment:'||c.id").replaceAll('created_at','c.created_at')}
     ORDER BY c.created_at DESC,id DESC LIMIT 41`,params([user.id,user.id])),
  ])
  const all=sortActivityRows([...follows.rows,...likes.rows,...comments.rows])
  const page=all.slice(0,PAGE_SIZE)
  const last=page.at(-1)
  const nextCursor=all.length>PAGE_SIZE&&last?
    encodeActivityCursor({createdAt:last.created_at,id:last.id}):null
  const items=page.map(e=>({id:e.id,type:e.type,createdAt:e.created_at,
      user:{id:e.actor_id,username:e.username,displayName:e.display_name,avatar:e.avatar_url||''},
      content:e.content,videoId:e.video_id}))
  return json({items,nextCursor})
 }catch{return json({error:'notifications_unavailable'},503)}
}
