import {NextRequest,NextResponse} from 'next/server'
import {queryD1} from '@/lib/native/d1'
import {parseRankWindow,type CreatorRankWindow} from '@/lib/rankings/rank-period'

/** An honest creator leaderboard from real PUBLISHED clips only.
 * This is NOT a LIVE gifting / paid battle ranking.
 * Fixed SQL choices prevent user-controlled SQL fragments.
 */
export const runtime='nodejs'
export const dynamic='force-dynamic'
type DbRow={
 id:string;username:string;display_name:string;avatar_url:string|null
 is_verified:number;posts:number;likes:number;views:number
}
const WINDOW_SQL:Record<CreatorRankWindow,string>={
 week:"AND v.created_at >= datetime('now','-7 days')",
 month:"AND v.created_at >= datetime('now','-30 days')",
 all:'',
}
const json=(value:unknown,status=200)=>NextResponse.json(value,{
 status,headers:{'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff'},
})
export async function GET(req:NextRequest){
 const period=parseRankWindow(req.nextUrl.searchParams.get('period'))
 if(!period)return json({error:'invalid_period'},400)
 try{
  const result=await queryD1<DbRow>(`
   SELECT p.id,p.username,p.display_name,p.avatar_url,p.is_verified,
     count(v.id) AS posts,
     coalesce(sum(max(v.like_count,0)),0) AS likes,
     coalesce(sum(max(v.view_count,0)),0) AS views
   FROM videos v JOIN profiles p ON p.id=v.user_id
   WHERE v.status='published' ${WINDOW_SQL[period]}
   GROUP BY p.id,p.username,p.display_name,p.avatar_url,p.is_verified
   ORDER BY likes DESC,views DESC,posts DESC,p.id ASC LIMIT 30`)
  return json({
   period,rankingType:'published-video-engagement',
   basedOn:'actual published videos; likes then views',
   isLiveGiftRanking:false,isPaidLeaderboard:false,
   updatedAt:new Date().toISOString(),
   creators:result.rows.map((r,i)=>({
    rank:i+1,id:r.id,username:r.username,
    displayName:r.display_name||r.username,avatar:r.avatar_url||'',
    verified:Boolean(r.is_verified),posts:r.posts||0,
    likes:r.likes||0,views:r.views||0,
   })),
  })
 }catch{return json({error:'creator_ranking_unavailable'},503)}
}
