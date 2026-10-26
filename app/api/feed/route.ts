import { NextRequest, NextResponse } from 'next/server'
import { getNativeUser } from '@/lib/native/auth'
import { queryD1, validId } from '@/lib/native/d1'
import { decodeFeedKey, encodeFeedKey } from '@/lib/feed/cursor'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const json=(data:unknown,status=200)=>NextResponse.json(data,{status,headers:{'Cache-Control':'private, no-store'}})
type Row={id:string;user_id:string;username:string;display_name:string;avatar_url:string|null;is_verified:number;
media_url:string;thumbnail_url:string|null;description:string|null;music:string|null;view_count:number;
like_count:number;comment_count:number;share_count:number;created_at:string;liked:number;bookmarked:number;followed:number}
export async function GET(req:NextRequest){
  const source=req.nextUrl.searchParams.get('source')||'forYou'
  const featuredId=req.nextUrl.searchParams.get('videoId')
  if(featuredId&&!validId(featuredId))return json({error:'invalid_video_id'},400)
  if(source!=='forYou'&&source!=='following')return json({error:'invalid_source'},400)
  let cursor:ReturnType<typeof decodeFeedKey>|undefined
  try {
    const c=req.nextUrl.searchParams.get('cursor')
    cursor=c?decodeFeedKey(c):undefined
  }catch{return json({error:'invalid_cursor'},400)}
  const limit=Math.min(24,Math.max(1,Math.trunc(Number(req.nextUrl.searchParams.get('limit'))||12)))
  try{
    const user=await getNativeUser()
    if(source==='following'&&!user)return json({error:'unauthorized'},401)
    const viewer=user?.id??''
    const {rows}=await queryD1<Row>(`
      SELECT v.*,p.username,p.display_name,p.avatar_url,p.is_verified,
        EXISTS(SELECT 1 FROM likes l WHERE l.video_id=v.id AND l.user_id=?) AS liked,
        EXISTS(SELECT 1 FROM bookmarks b WHERE b.video_id=v.id AND b.user_id=?) AS bookmarked,
        EXISTS(SELECT 1 FROM follows f WHERE f.following_id=v.user_id AND f.follower_id=?) AS followed
      FROM videos v JOIN profiles p ON p.id=v.user_id
      WHERE v.status='published'
        AND (? IS NULL OR v.id=?)
        AND (?='forYou' OR EXISTS(SELECT 1 FROM follows f WHERE f.following_id=v.user_id AND f.follower_id=?))
        AND (? IS NULL OR v.created_at<? OR (v.created_at=? AND v.id<?))
      ORDER BY v.created_at DESC,v.id DESC LIMIT ?`,
      [viewer,viewer,viewer,featuredId??null,featuredId??null,source,viewer,cursor?.createdAt??null,cursor?.createdAt??null,cursor?.createdAt??null,cursor?.id??null,featuredId?1:limit+1])
    const page=rows.slice(0,limit),last=page.at(-1)
    return json({videos:page.map(r=>({
      id:r.id,
      user:{id:r.user_id,username:r.username,displayName:r.display_name||r.username,
        avatar:r.avatar_url||'',followers:0,following:0,likes:0,
        isVerified:Boolean(r.is_verified),isFollowing:Boolean(r.followed),createdAt:r.created_at},
      videoUrl:r.media_url,thumbnailUrl:r.thumbnail_url||r.media_url,
      caption:r.description||'',music:r.music?{name:r.music,artist:'',coverUrl:''}:undefined,
      likes:r.like_count,comments:r.comment_count,shares:r.share_count,views:r.view_count,
      isLiked:Boolean(r.liked),isBookmarked:Boolean(r.bookmarked),tags:[],createdAt:r.created_at,
    })),nextCursor:!featuredId && rows.length>limit && last?encodeFeedKey({createdAt:last.created_at,id:last.id}):null})
  }catch{return json({error:'feed_unavailable'},503)}
}
export async function POST(req:NextRequest){
  if(req.headers.get('origin')!==req.nextUrl.origin)return json({error:'invalid_origin'},403)
  const user=await getNativeUser().catch(()=>null)
  if(!user)return json({error:'unauthorized'},401)
  let body:unknown;try{body=await req.json()}catch{return json({error:'invalid_json'},400)}
  const b=body as {videoId?:unknown;liked?:unknown}|null
  if(!b||!validId(b.videoId)||typeof b.liked!=='boolean')return json({error:'invalid_request'},400)
  try{
    // Foreign-key constrained: nonexistent videos don't create dangling likes.
    await queryD1(b.liked
      ?'INSERT OR IGNORE INTO likes(user_id,video_id) VALUES (?,?)'
      :'DELETE FROM likes WHERE user_id=? AND video_id=?',[user.id,b.videoId])
    await queryD1('UPDATE videos SET like_count=(SELECT count(*) FROM likes WHERE video_id=?) WHERE id=?',[b.videoId,b.videoId])
    return json({videoId:b.videoId,liked:b.liked})
  }catch{return json({error:'like_unavailable'},503)}
}
