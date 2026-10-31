import {NextRequest,NextResponse} from 'next/server'
import {createHash} from 'node:crypto'
import {resolveForgeGpuBackend} from '@/lib/server/spaktok-forge-provider'
import {getNativeUser,rateLimit} from '@/lib/native/auth'
import {queryD1} from '@/lib/native/d1'
import {
 forgeJobsBase,parseForgeGpuJobStatus,signForgeJobReadTicket,verifyForgeJobHandle,
} from '@/lib/server/spaktok-forge-jobs'
import {
 checkForgeLibraryGlb,FORGE_LIBRARY_MAX_BYTES,FORGE_LIBRARY_TARGETS,
} from '@/lib/server/spaktok-forge-library'
import {
 studioPrivateR2Available,signStudioPrivateR2Request,
} from '@/lib/server/spaktok-studio-private-r2'

/** Server-to-server push of a finished A100 job into the owner-private R2
 * library (studio-assets Worker). The GLB never transits the browser here:
 * Next pulls it from the GPU with a one-job read grant, re-hashes it, checks
 * it against the Worker's rules, reserves a D1 draft, PUTs, then confirms via
 * a signed HEAD before marking it stored. Opt-in per result, never public.
 */
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60

const json=(body:unknown,status=200)=>NextResponse.json(body,{
 status,headers:{'cache-control':'private,no-store','x-content-type-options':'nosniff'},
})

export async function POST(request:NextRequest){
 const origin=request.nextUrl.origin
 if(request.headers.get('origin')!==origin||request.headers.get('sec-fetch-site')==='cross-site')
  return json({error:'forge_invalid_origin'},403)
 if(!studioPrivateR2Available())return json({error:'studio_cloud_disabled'},503)
 const cfg=resolveForgeGpuBackend(process.env,origin)
 if(!cfg||cfg.engine!=='trellis2')return json({error:'forge_gpu_disabled'},503)

 let rights:unknown
 try{
  const raw=await request.text()
  if(raw.length>256)throw Error('large')
  rights=(JSON.parse(raw) as {rights?:unknown}).rights
 }catch{return json({error:'invalid_json'},422)}
 if(rights!=='original'&&rights!=='licensed')
  return json({error:'forge_library_rights_required'},422)

 let user
 try{user=await getNativeUser()}catch{return json({error:'forge_auth_unavailable'},503)}
 if(!user)return json({error:'forge_auth_required'},401)
 const verified=verifyForgeJobHandle(cfg.token,request.headers.get('x-forge-job-handle')??'',user.id)
 if(!verified)return json({error:'forge_job_handle_invalid'},403)
 if(!await rateLimit('forge-library:'+user.id,5))
  return json({error:'forge_library_rate_limited'},429)

 const base=forgeJobsBase(cfg.url)+'/'+verified.jobId
 let status
 try{
  const r=await fetch(base,{cache:'no-store',redirect:'error',
   headers:{authorization:'Bearer '+cfg.token},signal:AbortSignal.timeout(8000)})
  status=r.ok?parseForgeGpuJobStatus(await r.json()):null
 }catch{return json({error:'forge_gpu_unreachable'},502)}
 if(!status||status.id!==verified.jobId||status.state!=='succeeded'||!status.sha256||!status.bytes)
  return json({error:'forge_job_not_ready'},409)
 if(status.bytes>FORGE_LIBRARY_MAX_BYTES)return json({error:'glb_size'},413)

 let bytes:Uint8Array
 try{
  const r=await fetch(base+'/glb',{cache:'no-store',redirect:'error',signal:AbortSignal.timeout(30000),
   headers:{origin,authorization:'Bearer '+signForgeJobReadTicket(cfg.token,{jobId:status.id,origin})}})
  if(!r.ok)return json({error:'forge_gpu_result_unavailable'},502)
  const declared=Number(r.headers.get('content-length')??0)
  if(declared>FORGE_LIBRARY_MAX_BYTES)return json({error:'glb_size'},413)
  bytes=new Uint8Array(await r.arrayBuffer())
 }catch{return json({error:'forge_gpu_unreachable'},502)}
 const sha=createHash('sha256').update(bytes).digest('hex')
 if(sha!==status.sha256||bytes.byteLength!==status.bytes)
  return json({error:'forge_result_integrity_mismatch'},502)
 const check=checkForgeLibraryGlb(bytes)
 if(!check.ok)return json({error:check.error},422)

 try{
  const id=crypto.randomUUID()
  const reserved=await queryD1<{id:string}>(`
   INSERT INTO studio_asset_drafts
    (id,user_id,object_key,sha256,bytes,rights,targets_json,status)
   SELECT ?,?,?,?,?,?,?,'issued'
   WHERE (SELECT COUNT(*) FROM studio_asset_drafts
          WHERE user_id=? AND created_at>=datetime('now','-1 day'))<10
   RETURNING id`,[id,user.id,'studio-drafts/'+user.id+'/'+id+'.glb',sha,bytes.byteLength,
    rights,JSON.stringify(FORGE_LIBRARY_TARGETS),user.id])
  if(!reserved.rows.length)return json({error:'studio_daily_limit'},429)

  const put=signStudioPrivateR2Request('PUT',user.id,id,bytes.byteLength,sha)
  const stored=await fetch(put.url,{method:'PUT',body:new Blob([bytes as BlobPart],{type:'model/gltf-binary'}),redirect:'error',cache:'no-store',
   headers:{...put.headers,origin,'content-length':String(bytes.byteLength)},
   signal:AbortSignal.timeout(30000)})
  if(stored.status!==201)return json({error:'studio_upload_rejected'},502)

  const head=signStudioPrivateR2Request('HEAD',user.id,id,bytes.byteLength,sha)
  const remote=await fetch(head.url,{method:'HEAD',headers:head.headers,redirect:'error',
   cache:'no-store',signal:AbortSignal.timeout(12000)})
  if(!remote.ok||remote.headers.get('x-spaktok-asset-sha256')!==sha)
   return json({error:'studio_upload_not_confirmed'},409)
  await queryD1(
   "UPDATE studio_asset_drafts SET status='stored',confirmed_at=datetime('now') WHERE id=? AND user_id=? AND status='issued'",
   [id,user.id])
  return json({stored:true,id,bytes:bytes.byteLength,triangles:check.triangles,private:true},201)
 }catch{return json({error:'studio_cloud_unavailable'},503)}
}
