import {NextRequest,NextResponse} from 'next/server'
import {queryD1,validId} from '@/lib/native/d1'
import {getNativeUser} from '@/lib/native/auth'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}})
type ProfileRow={id:string;username:string;display_name:string;avatar_url:string|null;bio:string;is_verified:number;follower_count:number;following_count:number;created_at:string}
type VideoRow={id:string;media_url:string;thumbnail_url:string|null;description:string;view_count:number;like_count:number}
export async function GET(req:NextRequest){
  try{
    const user=await getNativeUser()
    const id=req.nextUrl.searchParams.get('id')||user?.id
    if(!validId(id))return json({error:'invalid_profile'},400)
    const {rows}=await queryD1<ProfileRow>('SELECT id,username,display_name,avatar_url,bio,is_verified,follower_count,following_count,created_at FROM profiles WHERE id=?',[id])
    const p=rows[0];if(!p)return json({error:'not_found'},404)
    const view=req.nextUrl.searchParams.get('view')||'videos'
    if(!['videos','saved','liked'].includes(view))return json({error:'invalid_view'},400)
    if(view!=='videos'&&user?.id!==id)return json({error:'forbidden'},403)
    const clause=view==='saved'
      ?'JOIN bookmarks b ON b.video_id=v.id AND b.user_id=?'
      :view==='liked'?'JOIN likes l ON l.video_id=v.id AND l.user_id=?':''
    const sql=`SELECT v.id,v.media_url,v.thumbnail_url,v.description,v.view_count,v.like_count FROM videos v
      ${clause} WHERE ${view==='videos'?'v.user_id=?':'v.status=\'published\''}
      ${view==='videos'?"AND v.status='published'":''}
      ORDER BY v.created_at DESC LIMIT 60`
    const videos=await queryD1<VideoRow>(sql,[view==='videos'?id:user!.id])
    return json({profile:{id:p.id,username:p.username,displayName:p.display_name,avatar:p.avatar_url||'',bio:p.bio||'',isVerified:Boolean(p.is_verified),followers:p.follower_count||0,following:p.following_count||0,likes:videos.rows.reduce((n,v)=>n+(v.like_count||0),0),createdAt:p.created_at},
      videos:videos.rows.map(v=>({id:v.id,thumbnailUrl:v.thumbnail_url||v.media_url,caption:v.description||'',views:v.view_count}))})
  }catch{return json({error:'profile_unavailable'},503)}
}
export async function PATCH(req:NextRequest){
  if(req.headers.get('origin')!==req.nextUrl.origin||req.headers.get('sec-fetch-site')==='cross-site')
    return json({error:'invalid_origin'},403)
  if(Number(req.headers.get('content-length')||0)>2048)return json({error:'invalid_size'},413)
  let body:unknown
  try{body=await req.json()}catch{return json({error:'invalid_json'},400)}
  if(!body||typeof body!=='object'||Array.isArray(body))return json({error:'invalid_request'},400)
  const b=body as Record<string,unknown>
  if(typeof b.displayName!=='string'||typeof b.bio!=='string')return json({error:'invalid_request'},400)
  const displayName=b.displayName.trim(),bio=b.bio.trim()
  if(displayName.length<2||displayName.length>50||bio.length>160||
      /[\x00-\x1f\x7f]/.test(displayName)||/[\x00-\x08\x0b\x0c\x0e-\x1f]/.test(bio))
    return json({error:'invalid_profile_fields'},400)
  try{
    const user=await getNativeUser()
    if(!user)return json({error:'unauthorized'},401)
    await queryD1('UPDATE profiles SET display_name=?,bio=? WHERE id=?',[displayName,bio,user.id])
    return json({success:true,profile:{displayName,bio}})
  }catch{return json({error:'update_unavailable'},503)}
}
