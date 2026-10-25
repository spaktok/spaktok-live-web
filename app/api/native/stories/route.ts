import {NextResponse} from 'next/server'
import {queryD1} from '@/lib/native/d1'
export const runtime='nodejs'
export const dynamic='force-dynamic'
type R={id:string;user_id:string;media_url:string;media_type:string;expires_at:string;created_at:string;
  username:string;display_name:string;avatar_url:string|null;is_verified:number}
export async function GET(){
 try{
  const {rows}=await queryD1<R>(`SELECT s.*,p.username,p.display_name,p.avatar_url,p.is_verified FROM stories s
    JOIN profiles p ON p.id=s.user_id WHERE s.expires_at>datetime('now')
    ORDER BY s.created_at DESC LIMIT 60`)
  return NextResponse.json({stories:rows.map(r=>({
    id:r.id,user:{id:r.user_id,username:r.username,displayName:r.display_name,avatar:r.avatar_url||'',
      followers:0,following:0,likes:0,isVerified:Boolean(r.is_verified),createdAt:r.created_at},
    mediaUrl:r.media_url,mediaType:r.media_type,duration:5,views:0,
    reactions:[],createdAt:r.created_at,expiresAt:r.expires_at,
  }))},{headers:{'Cache-Control':'no-store'}})
 }catch{return NextResponse.json({error:'stories_unavailable'},{status:503})}
}
