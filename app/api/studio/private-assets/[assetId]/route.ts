import {NextRequest,NextResponse} from 'next/server'
import {getNativeUser} from '@/lib/native/auth'
import {oneD1,queryD1,validId} from '@/lib/native/d1'
import {
 studioPrivateR2Available,signStudioPrivateR2Request,
} from '@/lib/server/spaktok-studio-private-r2'

export const runtime='nodejs'
export const dynamic='force-dynamic'
type Context={params:Promise<{assetId:string}>}
type Draft={id:string;sha256:string;bytes:number;status:string}
const json=(v:unknown,status=200)=>NextResponse.json(v,{status,headers:{
 'cache-control':'private,no-store','x-content-type-options':'nosniff',
}})
/** This never proxies a 15 MiB body through Vercel's payload limit.
 * The authenticated owner gets a 90-second signed edge GET instead.
 */
export async function GET(_req:NextRequest,{params}:Context){
 if(!studioPrivateR2Available())return json({error:'studio_cloud_disabled'},503)
 const {assetId}=await params
 if(!validId(assetId))return json({error:'not_found'},404)
 try{
  const user=await getNativeUser()
  if(!user)return json({error:'studio_login_required'},401)
  const d=await oneD1<Draft>(
   "SELECT id,sha256,bytes,status FROM studio_asset_drafts WHERE id=? AND user_id=? AND status='stored'",
   [assetId,user.id])
  if(!d)return json({error:'not_found'},404)
  const ticket=signStudioPrivateR2Request('GET',user.id,assetId,d.bytes,d.sha256)
  return json({id:assetId,...ticket,sha256:d.sha256,bytes:d.bytes,
   expiresInSeconds:90,private:true})
 }catch{return json({error:'studio_read_unavailable'},503)}
}
export async function DELETE(req:NextRequest,{params}:Context){
 if(!studioPrivateR2Available())return json({error:'studio_cloud_disabled'},503)
 if(req.headers.get('origin')!==req.nextUrl.origin||
    req.headers.get('sec-fetch-site')==='cross-site')
  return json({error:'studio_bad_origin'},403)
 const {assetId}=await params
 if(!validId(assetId))return json({error:'not_found'},404)
 try{
  const user=await getNativeUser()
  if(!user)return json({error:'studio_login_required'},401)
  const d=await oneD1<Draft>(
   'SELECT id,sha256,bytes,status FROM studio_asset_drafts WHERE id=? AND user_id=?',
   [assetId,user.id])
  if(!d)return json({error:'not_found'},404)
  const t=signStudioPrivateR2Request('DELETE',user.id,assetId,d.bytes,d.sha256)
  const remote=await fetch(t.url,{
   method:'DELETE',headers:t.headers,cache:'no-store',redirect:'error',
   signal:AbortSignal.timeout(12000),
  })
  if(!remote.ok)return json({error:'studio_delete_unavailable'},503)
  await queryD1('DELETE FROM studio_asset_drafts WHERE id=? AND user_id=?',
   [assetId,user.id])
  return json({deleted:true,id:assetId})
 }catch{return json({error:'studio_delete_failed'},503)}
}
