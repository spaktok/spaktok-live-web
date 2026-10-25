import { NextRequest,NextResponse } from 'next/server'
import { getNativeUser } from '@/lib/native/auth'
import { queryD1, validId } from '@/lib/native/d1'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}})
type Row={id:string;user_id:string;username:string;display_name:string;avatar_url:string|null;content:string;created_at:string}
const display=(r:Row)=>({id:r.id,content:r.content,createdAt:r.created_at,
  user:{id:r.user_id,username:r.username,displayName:r.display_name,avatarUrl:r.avatar_url}})
const select=`SELECT c.id,c.user_id,c.content,c.created_at,p.username,p.display_name,p.avatar_url
  FROM comments c JOIN profiles p ON p.id=c.user_id`
export async function GET(req:NextRequest){
  const id=req.nextUrl.searchParams.get('videoId')
  if(!validId(id))return json({error:'invalid_video_id'},400)
  try{
    const {rows}=await queryD1<Row>(select+' WHERE c.video_id=? ORDER BY c.created_at DESC LIMIT 100',[id])
    return json({comments:rows.reverse().map(display)})
  }catch{return json({error:'comments_unavailable'},503)}
}
export async function POST(req:NextRequest){
  if(req.headers.get('origin')!==req.nextUrl.origin)return json({error:'invalid_origin'},403)
  let body:unknown;try{body=await req.json()}catch{return json({error:'invalid_json'},400)}
  const b=body as {videoId?:unknown;content?:unknown}|null
  if(!b||!validId(b.videoId)||typeof b.content!=='string'||!b.content.trim()||b.content.trim().length>500)
    return json({error:'invalid_request'},400)
  try{
    const user=await getNativeUser()
    if(!user)return json({error:'unauthorized'},401)
    const id=crypto.randomUUID()
    await queryD1('INSERT INTO comments(id,user_id,video_id,content) VALUES (?,?,?,?)',
      [id,user.id,b.videoId,b.content.trim()])
    await queryD1('UPDATE videos SET comment_count=(SELECT count(*) FROM comments WHERE video_id=?) WHERE id=?',[b.videoId,b.videoId])
    const {rows}=await queryD1<Row>(select+' WHERE c.id=?',[id])
    return json({comment:display(rows[0])},201)
  }catch{return json({error:'comment_unavailable'},503)}
}
