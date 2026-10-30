import {NextRequest,NextResponse} from 'next/server'
import {getNativeUser} from '@/lib/native/auth'
import {oneD1,queryD1,validId} from '@/lib/native/d1'
import {
 studioPrivateR2Available,signStudioPrivateR2Request,
} from '@/lib/server/spaktok-studio-private-r2'

export const runtime='nodejs'
export const dynamic='force-dynamic'
const json=(v:unknown,status=200)=>NextResponse.json(v,{status,headers:{
 'cache-control':'private,no-store','x-content-type-options':'nosniff',
}})
type Context={params:Promise<{assetId:string}>}
type Draft={id:string;sha256:string;bytes:number;status:string}
export async function POST(req:NextRequest,{params}:Context){
 if(!studioPrivateR2Available())return json({error:'studio_cloud_disabled'},503)
 if(req.headers.get('origin')!==req.nextUrl.origin||
    req.headers.get('sec-fetch-site')==='cross-site')
  return json({error:'studio_bad_origin'},403)
 const {assetId}=await params
 if(!validId(assetId))return json({error:'not_found'},404)
 try{
  const user=await getNativeUser()
  if(!user)return json({error:'studio_login_required'},401)
  const draft=await oneD1<Draft>(
   'SELECT id,sha256,bytes,status FROM studio_asset_drafts WHERE id=? AND user_id=?',
   [assetId,user.id])
  if(!draft)return json({error:'not_found'},404)
  if(draft.status==='stored')return json({confirmed:true,id:assetId,private:true})
  if(draft.status!=='issued')return json({error:'bad_draft_state'},409)
  // Trust only the edge's HEAD response and matching integrity metadata,
  // never a client claim that PUT succeeded.
  const t=signStudioPrivateR2Request('HEAD',user.id,assetId,draft.bytes,draft.sha256)
  const remote=await fetch(t.url,{
   method:'HEAD',headers:t.headers,cache:'no-store',redirect:'error',
   signal:AbortSignal.timeout(12000),
  })
  if(!remote.ok||
     remote.headers.get('x-spaktok-asset-sha256')!==draft.sha256||
     Number(remote.headers.get('content-length'))!==draft.bytes)
   return json({error:'studio_upload_not_confirmed'},409)
  await queryD1(
   "UPDATE studio_asset_drafts SET status='stored',confirmed_at=datetime('now') WHERE id=? AND user_id=? AND status='issued'",
   [assetId,user.id])
  return json({confirmed:true,id:assetId,private:true,bytes:draft.bytes})
 }catch{return json({error:'studio_confirmation_unavailable'},503)}
}
