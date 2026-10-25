import {NextResponse} from 'next/server'
import {getNativeUser} from '@/lib/native/auth'
import {queryD1,validId} from '@/lib/native/d1'
export const runtime='nodejs'
export const dynamic='force-dynamic'
export async function GET(){
 if(process.env.SPAKTOK_MODERATION_ENABLED!=='true'||
    !validId(process.env.SPAKTOK_ADMIN_USER_ID))
   return NextResponse.json({error:'moderation_not_configured'},{status:503})
 try{
   const user=await getNativeUser()
   if(!user)return NextResponse.json({error:'unauthorized'},{status:401})
   if(user.id!==process.env.SPAKTOK_ADMIN_USER_ID)
     return NextResponse.json({error:'forbidden'},{status:403})
   const {rows}=await queryD1<{id:string;created_at:string;stream_uid:string|null}>(
      'SELECT id,created_at,stream_uid FROM stream_uploads ORDER BY created_at DESC LIMIT 20')
   return NextResponse.json({items:rows.map(r=>({id:r.id,createdAt:r.created_at,
     state:r.stream_uid?'private_pending_review':'pending_upload',durationSeconds:null})),
     moderationEnabled:true},{headers:{'Cache-Control':'no-store'}})
 }catch{return NextResponse.json({error:'moderation_unavailable'},{status:503})}
}
