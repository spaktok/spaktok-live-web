import {NextResponse} from 'next/server'
import {getNativeUser} from '@/lib/native/auth'
import {queryD1} from '@/lib/native/d1'
export const runtime='nodejs'
export const dynamic='force-dynamic'
type Event={id:string;type:'like'|'follow'|'comment';actor_id:string;username:string;
  display_name:string;avatar_url:string|null;created_at:string;content:string;video_id:string|null}
/** Real recorded events only. No fake gifts, followers, or paid purchases. */
export async function GET(){
 try{
  const user=await getNativeUser()
  if(!user)return NextResponse.json({error:'unauthorized'},{status:401})
  const [follows,likes,comments]=await Promise.all([
   queryD1<Event>(`SELECT 'follow:'||f.follower_id AS id,'follow' AS type,f.follower_id AS actor_id,
     p.username,p.display_name,p.avatar_url,f.created_at,'' AS content,NULL AS video_id
     FROM follows f JOIN profiles p ON p.id=f.follower_id
     WHERE f.following_id=? ORDER BY f.created_at DESC LIMIT 20`,[user.id]),
   queryD1<Event>(`SELECT 'like:'||l.user_id||':'||l.video_id AS id,'like' AS type,l.user_id AS actor_id,
     p.username,p.display_name,p.avatar_url,l.created_at,'' AS content,l.video_id
     FROM likes l JOIN profiles p ON p.id=l.user_id JOIN videos v ON v.id=l.video_id
     WHERE v.user_id=? AND l.user_id<>? ORDER BY l.created_at DESC LIMIT 20`,[user.id,user.id]),
   queryD1<Event>(`SELECT 'comment:'||c.id AS id,'comment' AS type,c.user_id AS actor_id,
     p.username,p.display_name,p.avatar_url,c.created_at,c.content,c.video_id
     FROM comments c JOIN profiles p ON p.id=c.user_id JOIN videos v ON v.id=c.video_id
     WHERE v.user_id=? AND c.user_id<>? ORDER BY c.created_at DESC LIMIT 20`,[user.id,user.id]),
  ])
  const items=[...follows.rows,...likes.rows,...comments.rows]
    .sort((a,b)=>b.created_at.localeCompare(a.created_at)).slice(0,40)
    .map(e=>({id:e.id,type:e.type,createdAt:e.created_at,
      user:{id:e.actor_id,username:e.username,displayName:e.display_name,avatar:e.avatar_url||''},
      content:e.content,videoId:e.video_id}))
  return NextResponse.json({items},{headers:{'Cache-Control':'private,no-store'}})
 }catch{return NextResponse.json({error:'notifications_unavailable'},{status:503})}
}
