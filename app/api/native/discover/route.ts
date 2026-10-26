import { NextRequest,NextResponse } from 'next/server'
import { queryD1 } from '@/lib/native/d1'
import { getNativeUser } from '@/lib/native/auth'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const json=(value:unknown,status=200)=>NextResponse.json(value,{status,headers:{'Cache-Control':'private, no-store'}})

type Person={id:string;username:string;display_name:string;avatar_url:string|null;bio:string;follower_count:number;is_verified:number;following:number}
type Clip={id:string;user_id:string;username:string;thumbnail_url:string|null;media_url:string;description:string;view_count:number;like_count:number;created_at:string}

/** Only published content and public creator fields can be discovered. */
export async function GET(request:NextRequest){
  const raw=(request.nextUrl.searchParams.get('q')||'').trim()
  if(raw.length>60)return json({error:'search_too_long'},400)
  const q=raw.toLocaleLowerCase()
  try{
    const viewer=(await getNativeUser())?.id||''
    const creators=await queryD1<Person>(`
      SELECT p.id,p.username,p.display_name,p.avatar_url,p.bio,p.follower_count,p.is_verified,
      EXISTS(SELECT 1 FROM follows f WHERE f.follower_id=? AND f.following_id=p.id) AS following
      FROM profiles p WHERE p.id<>?
        AND (?='' OR instr(lower(p.username),?)>0 OR instr(lower(p.display_name),?)>0)
      ORDER BY p.follower_count DESC,p.created_at DESC LIMIT 12`,
      [viewer,viewer,q,q,q])
    const videos=await queryD1<Clip>(`
      SELECT v.id,v.user_id,p.username,v.thumbnail_url,v.media_url,v.description,
        v.view_count,v.like_count,v.created_at FROM videos v
      JOIN profiles p ON p.id=v.user_id
      WHERE v.status='published' AND (?='' OR instr(lower(v.description),?)>0 OR instr(lower(p.username),?)>0)
      ORDER BY v.created_at DESC LIMIT 18`,[q,q,q])
    return json({
      creators:creators.rows.map(p=>({id:p.id,username:p.username,displayName:p.display_name,
        avatar:p.avatar_url||'',bio:p.bio||'',followers:p.follower_count||0,
        isVerified:Boolean(p.is_verified),isFollowing:Boolean(p.following)})),
      videos:videos.rows.map(v=>({id:v.id,userId:v.user_id,username:v.username,
        thumbnailUrl:v.thumbnail_url||'',caption:v.description||'',views:v.view_count||0,
        likes:v.like_count||0,createdAt:v.created_at})),
      query:raw,
    })
  }catch{return json({error:'discovery_unavailable'},503)}
}
