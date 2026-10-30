import {NextResponse} from 'next/server'
import {getNativeUser,rateLimit} from '@/lib/native/auth'
import {oneD1,queryD1} from '@/lib/native/d1'

/** Self-service *partial* owner export. Not a substitute for a complete
 * GDPR Art. 15 subject-access workflow (chat, payment, logs, retention
 * processors and further fields must be covered separately).
 */
export const runtime='nodejs'
export const dynamic='force-dynamic'
type Profile={id:string;username:string;display_name:string;avatar_url:string|null;bio:string;created_at:string}
type Video={id:string;description:string;status:string;media_url:string;created_at:string;view_count:number;like_count:number}
type Reference={video_id:string}
type Follow={following_id:string}
export async function GET(){
 try{
  const user=await getNativeUser()
  if(!user)return NextResponse.json({error:'unauthorized'},{status:401})
  if(!await rateLimit('export:'+user.id,6))
   return NextResponse.json({error:'export_rate_limited'},{status:429})
  const [p,v,b,l,f]=await Promise.all([
   oneD1<Profile>('SELECT id,username,display_name,avatar_url,bio,created_at FROM profiles WHERE id=?',[user.id]),
   queryD1<Video>('SELECT id,description,status,media_url,created_at,view_count,like_count FROM videos WHERE user_id=? ORDER BY created_at DESC LIMIT 501',[user.id]),
   queryD1<Reference>('SELECT video_id FROM bookmarks WHERE user_id=? LIMIT 501',[user.id]),
   queryD1<Reference>('SELECT video_id FROM likes WHERE user_id=? LIMIT 501',[user.id]),
   queryD1<Follow>('SELECT following_id FROM follows WHERE follower_id=? LIMIT 501',[user.id]),
  ])
  if(!p)return NextResponse.json({error:'account_not_found'},{status:404})
  const limited=(rows:unknown[])=>rows.length>500
  const data={
   type:'SpaktokUserDataExport',version:1,generatedAt:new Date().toISOString(),
   scope:'partial_self_service',notFullGDPRAccessResponse:true,
   notice:'This export contains profile, up to 500 videos and selected interaction references. Request a full personal-data access report separately from the operator.',
   user:{id:user.id,email:user.email,username:user.username},
   profile:p,
   videoHistory:v.rows.slice(0,500),
   savedVideoIds:b.rows.slice(0,500).map(x=>x.video_id),
   likedVideoIds:l.rows.slice(0,500).map(x=>x.video_id),
   followedCreatorIds:f.rows.slice(0,500).map(x=>x.following_id),
   truncated:{
    videoHistory:limited(v.rows),savedVideos:limited(b.rows),
    likedVideos:limited(l.rows),following:limited(f.rows),
   },
  }
  return new NextResponse(JSON.stringify(data,null,2),{
   status:200,headers:{
    'Content-Type':'application/json; charset=utf-8',
    'Content-Disposition':'attachment; filename="spaktok-account-export.json"',
    'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff',
    'Referrer-Policy':'no-referrer',
   },
  })
 }catch{return NextResponse.json({error:'export_unavailable'},{status:503,
  headers:{'Cache-Control':'private,no-store'}})}
}
