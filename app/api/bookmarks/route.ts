import { NextRequest,NextResponse } from 'next/server'
import { getNativeUser } from '@/lib/native/auth'
import { queryD1, validId } from '@/lib/native/d1'
export const runtime='nodejs'
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'no-store'}})
export async function POST(req:NextRequest){
  if(req.headers.get('origin')!==req.nextUrl.origin)return json({error:'invalid_origin'},403)
  let body:unknown;try{body=await req.json()}catch{return json({error:'invalid_json'},400)}
  const b=body as {videoId?:unknown;bookmarked?:unknown}|null
  if(!b||!validId(b.videoId)||typeof b.bookmarked!=='boolean')return json({error:'invalid_request'},400)
  try{
    const user=await getNativeUser()
    if(!user)return json({error:'unauthorized'},401)
    await queryD1(b.bookmarked?'INSERT OR IGNORE INTO bookmarks(user_id,video_id) VALUES (?,?)'
      :'DELETE FROM bookmarks WHERE user_id=? AND video_id=?',[user.id,b.videoId])
    return json({videoId:b.videoId,bookmarked:b.bookmarked})
  }catch{return json({error:'bookmark_unavailable'},503)}
}
