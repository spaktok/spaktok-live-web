import {NextRequest,NextResponse} from 'next/server'
import {getNativeUser} from '@/lib/native/auth'
import {queryD1,validId} from '@/lib/native/d1'
import {
 privateFaceAvailable,privateFaceWorkerRequest,
 PRIVATE_FACE_MAX_BYTES,validatePrivateFaceGlb,
} from '@/lib/reality/private-face-storage'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const json=(obj:unknown,status=200)=>NextResponse.json(obj,{status,headers:{
 'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff',
}})
type Draft={id:string;bytes:number;created_at:string}
export async function GET(){
 if(!privateFaceAvailable())return json({configured:false},503)
 try{
  const user=await getNativeUser()
  if(!user)return json({error:'unauthorized'},401)
  const result=await queryD1<Draft>(
   'SELECT id,bytes,created_at FROM face_drafts WHERE user_id=? AND status=? ORDER BY created_at DESC LIMIT 10',
   [user.id,'stored'])
  return json({configured:true,private:true,latest:result.rows[0]??null,
   drafts:result.rows.map(d=>({id:d.id,bytes:d.bytes,createdAt:d.created_at}))})
 }catch{return json({error:'drafts_unavailable'},503)}
}
export async function POST(req:NextRequest){
 if(!privateFaceAvailable())return json({error:'service_unconfigured'},503)
 const origin=req.headers.get('origin')
 if(origin!==req.nextUrl.origin||req.headers.get('sec-fetch-site')==='cross-site')
  return json({error:'invalid_origin'},403)
 if(req.headers.get('content-type')!=='model/gltf-binary')
  return json({error:'invalid_content_type'},415)
 const length=Number(req.headers.get('content-length')??0)
 if(!Number.isSafeInteger(length)||length<64||length>PRIVATE_FACE_MAX_BYTES)
  return json({error:'invalid_size'},413)
 try{
  const user=await getNativeUser()
  if(!user)return json({error:'unauthorized'},401)
  const bytes=await req.arrayBuffer()
  if(bytes.byteLength!==length)return json({error:'invalid_size'},413)
  try{validatePrivateFaceGlb(bytes)}
  catch{return json({error:'invalid_canonical_face_glb'},422)}
  const id=crypto.randomUUID()
  const objectKey='face-drafts/'+user.id+'/'+id+'.glb'
  // Daily cap is enforced by D1, not local memory. No public asset listing.
  const reserved=await queryD1<{id:string}>(`
    INSERT INTO face_drafts(id,user_id,object_key,bytes,status)
    SELECT ?,?,?,?,'issued'
    WHERE (SELECT count(*) FROM face_drafts WHERE user_id=?
           AND created_at>=datetime('now','-1 day'))<12
    RETURNING id`,[id,user.id,objectKey,length,user.id])
  if(!reserved.rows.length)return json({error:'daily_limit',maxDaily:12},429)
  const ticket=privateFaceWorkerRequest('PUT',user.id,id,length)
  try{
   const remote=await fetch(ticket.url,{
    method:'PUT',headers:ticket.headers,body:bytes,cache:'no-store',
    signal:AbortSignal.timeout(25000),
   })
   if(!remote.ok)throw Error('r2_upload_failed')
   await queryD1('UPDATE face_drafts SET status=? WHERE id=? AND user_id=?',
    ['stored',id,user.id])
   return json({stored:true,id,bytes:length,visibility:'owner-private',
    assetEndpoint:'/api/reality/face-drafts/'+id},201)
  }catch{
   await queryD1('UPDATE face_drafts SET status=? WHERE id=? AND user_id=?',
    ['failed',id,user.id]).catch(()=>{})
   return json({error:'r2_unavailable'},503)
  }
 }catch{return json({error:'draft_upload_failed'},503)}
}
