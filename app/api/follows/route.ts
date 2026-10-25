import { NextRequest, NextResponse } from 'next/server'
import { getNativeUser } from '@/lib/native/auth'
import { queryD1, validId } from '@/lib/native/d1'
export const runtime='nodejs'
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{'Cache-Control':'no-store'}})
export async function POST(req:NextRequest){
  if(req.headers.get('origin')!==req.nextUrl.origin)return json({error:'invalid_origin'},403)
  let body:unknown;try{body=await req.json()}catch{return json({error:'invalid_json'},400)}
  const b=body as {followingId?:unknown;following?:unknown}|null
  if(!b||!validId(b.followingId)||typeof b.following!=='boolean')return json({error:'invalid_request'},400)
  try{
    const user=await getNativeUser()
    if(!user)return json({error:'unauthorized'},401)
    if(user.id===b.followingId)return json({error:'cannot_follow_self'},400)
    const recipient=await queryD1('SELECT id FROM profiles WHERE id=?',[b.followingId])
    if(recipient.rows.length===0)return json({error:'not_found'},404)
    await queryD1(b.following?'INSERT OR IGNORE INTO follows(follower_id,following_id) VALUES (?,?)'
      :'DELETE FROM follows WHERE follower_id=? AND following_id=?',[user.id,b.followingId])
    await queryD1('UPDATE profiles SET following_count=(SELECT count(*) FROM follows WHERE follower_id=?) WHERE id=?',[user.id,user.id])
    await queryD1('UPDATE profiles SET follower_count=(SELECT count(*) FROM follows WHERE following_id=?) WHERE id=?',[b.followingId,b.followingId])
    return json({followingId:b.followingId,following:b.following})
  }catch{return json({error:'follow_unavailable'},503)}
}
