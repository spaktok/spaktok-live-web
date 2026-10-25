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
    const videos=await queryD1<VideoRow>('SELECT id,media_url,thumbnail_url,description,view_count,like_count FROM videos WHERE user_id=? AND status=\'published\' ORDER BY created_at DESC LIMIT 60',[id])
    return json({profile:{id:p.id,username:p.username,displayName:p.display_name,avatar:p.avatar_url||'',bio:p.bio||'',isVerified:Boolean(p.is_verified),followers:p.follower_count||0,following:p.following_count||0,likes:videos.rows.reduce((n,v)=>n+v.like_count,0),createdAt:p.created_at},
      videos:videos.rows.map(v=>({id:v.id,thumbnailUrl:v.thumbnail_url||v.media_url,caption:v.description||'',views:v.view_count}))})
  }catch{return json({error:'profile_unavailable'},503)}
}
