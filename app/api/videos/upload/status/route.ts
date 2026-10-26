import {NextRequest,NextResponse} from 'next/server'
import {getNativeUser} from '@/lib/native/auth'
import {queryD1,validId} from '@/lib/native/d1'
export const runtime='nodejs'
export const dynamic='force-dynamic'
const json=(v:unknown,status=200)=>NextResponse.json(v,{status,headers:{'Cache-Control':'private,no-store'}})
type R={id:string;status:string;created_at:string;uploaded_at:string|null;bytes:number;mime_type:string}
export async function GET(req:NextRequest){
 try{
  const user=await getNativeUser()
  if(!user)return json({error:'unauthorized'},401)
  const id=req.nextUrl.searchParams.get('id')
  if(id&&!validId(id))return json({error:'invalid_id'},400)
  if(id){
   const {rows}=await queryD1<R>('SELECT id,status,created_at,uploaded_at,bytes,mime_type FROM media_uploads WHERE id=? AND user_id=?',[id,user.id])
   if(!rows.length)return json({error:'not_found'},404)
   return json({id:rows[0].id,state:rows[0].status==='uploaded'?'private_review':rows[0].status,
     createdAt:rows[0].created_at,bytes:rows[0].bytes})
  }
  const {rows}=await queryD1<R>('SELECT id,status,created_at,uploaded_at,bytes,mime_type FROM media_uploads WHERE user_id=? ORDER BY created_at DESC LIMIT 20',[user.id])
  return json({items:rows.map(r=>({id:r.id,state:r.status==='uploaded'?'private_review':r.status,createdAt:r.created_at,bytes:r.bytes}))})
 }catch{return json({error:'upload_status_unavailable'},503)}
}
