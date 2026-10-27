import {NextRequest,NextResponse} from 'next/server'
import {getNativeUser} from '@/lib/native/auth'
import {oneD1,queryD1,validId} from '@/lib/native/d1'
import {privateFaceAvailable,privateFaceWorkerRequest} from '@/lib/reality/private-face-storage'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const json=(body:unknown,status=200)=>NextResponse.json(body,{status,headers:{
 'Cache-Control':'private,no-store','X-Content-Type-Options':'nosniff',
}})
type FaceDraft={id:string;bytes:number;object_key:string;status:string}
type Context={params:Promise<{assetId:string}>}
export async function GET(_req:NextRequest,{params}:Context){
 if(!privateFaceAvailable())return json({error:'service_unavailable'},503)
 const {assetId}=await params
 if(!validId(assetId))return json({error:'not_found'},404)
 try{
  const user=await getNativeUser()
  if(!user)return json({error:'unauthorized'},401)
  const draft=await oneD1<FaceDraft>(
   'SELECT id,bytes,object_key,status FROM face_drafts WHERE id=? AND user_id=? AND status=?',
   [assetId,user.id,'stored'])
  if(!draft)return json({error:'not_found'},404)
  const ticket=privateFaceWorkerRequest('GET',user.id,assetId)
  const remote=await fetch(ticket.url,{
   method:'GET',headers:ticket.headers,cache:'no-store',signal:AbortSignal.timeout(15000),
  })
  if(!remote.ok)return json({error:'asset_unavailable'},503)
  if(Number(remote.headers.get('content-length'))!==draft.bytes)
   return json({error:'asset_size_mismatch'},503)
  return new Response(remote.body,{status:200,headers:{
   'Content-Type':'model/gltf-binary',
   'Content-Length':String(draft.bytes),
   'Cache-Control':'private,no-store',
   'X-Content-Type-Options':'nosniff',
   'Cross-Origin-Resource-Policy':'same-origin',
  }})
 }catch{return json({error:'asset_fetch_failed'},503)}
}
export async function DELETE(req:NextRequest,{params}:Context){
 if(!privateFaceAvailable())return json({error:'service_unavailable'},503)
 if(req.headers.get('origin')!==req.nextUrl.origin||
   req.headers.get('sec-fetch-site')==='cross-site')
  return json({error:'invalid_origin'},403)
 const {assetId}=await params
 if(!validId(assetId))return json({error:'not_found'},404)
 try{
  const user=await getNativeUser()
  if(!user)return json({error:'unauthorized'},401)
  const draft=await oneD1<FaceDraft>(
   'SELECT id,bytes,object_key,status FROM face_drafts WHERE id=? AND user_id=?',
   [assetId,user.id])
  if(!draft)return json({error:'not_found'},404)
  const ticket=privateFaceWorkerRequest('DELETE',user.id,assetId)
  const remote=await fetch(ticket.url,{
   method:'DELETE',headers:ticket.headers,cache:'no-store',
   signal:AbortSignal.timeout(15000),
  })
  if(!remote.ok)return json({error:'asset_delete_failed'},503)
  await queryD1('DELETE FROM face_drafts WHERE id=? AND user_id=?',[assetId,user.id])
  return json({deleted:true})
 }catch{return json({error:'delete_unavailable'},503)}
}
