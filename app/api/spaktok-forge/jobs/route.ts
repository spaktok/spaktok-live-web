import {NextRequest,NextResponse} from 'next/server'
import {createHash} from 'node:crypto'
import {resolveForgeGpuBackend} from '@/lib/server/spaktok-forge-provider'
import {getNativeUser,rateLimit} from '@/lib/native/auth'
import {queryD1} from '@/lib/native/d1'
import {FORGE_QUOTA_CLAIM_SQL} from '@/lib/server/spaktok-forge-budget'
import {
 FORGE_JOB_MAX_IMAGE,forgeJobsBase,isForgeJobProfile,isForgePolyBudget,
 parseForgeGpuJobStatus,signForgeJobHandle,FORGE_RETEXTURE_MAX_TOTAL,FORGE_JOB_MAX_EXTRA_VIEWS,sniffForgeMesh,signForgeJobReadTicket,
 verifyForgeJobHandle,
} from '@/lib/server/spaktok-forge-jobs'

/** Async A100 studio-hd / studio-ultra jobs.
 *
 * POST: image (<=4MB, Vercel payload cap) is forwarded server-to-server with
 *       the operator token. Returns a signed owner-bound handle (sh1).
 * GET:  handle in `x-forge-job-handle` (never in the URL, to keep it out of
 *       logs). On success returns a 4-minute read grant (sj1) so the browser
 *       downloads the large GLB directly from the GPU, bypassing Vercel.
 */
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=60

const json=(body:unknown,status=200)=>NextResponse.json(body,{
 status,headers:{'cache-control':'private,no-store','x-content-type-options':'nosniff'},
})
const sameOrigin=(request:NextRequest)=>
 request.headers.get('origin')===request.nextUrl.origin&&
 request.headers.get('sec-fetch-site')!=='cross-site'
const hdEnabled=()=>process.env.SPAKTOK_FORGE_GPU_HD_ENABLED==='true'
const MIME=['image/png','image/jpeg','image/webp']

async function currentUser(){
 try{return {user:await getNativeUser()}}catch{return {user:null,unavailable:true}}
}

export async function POST(request:NextRequest){
 if(!sameOrigin(request))return json({error:'forge_invalid_origin'},403)
 const cfg=resolveForgeGpuBackend(process.env,request.nextUrl.origin)
 if(!cfg||cfg.engine!=='trellis2'||!hdEnabled())
  return json({error:'forge_gpu_hd_not_authorized'},403)
 const length=Number(request.headers.get('content-length')??0)
 if(!Number.isSafeInteger(length)||length<128||length>FORGE_RETEXTURE_MAX_TOTAL+16384)
  return json({error:'forge_job_payload_size_invalid'},413)

 let form:FormData
 try{form=await request.formData()}catch{return json({error:'forge_job_invalid_form'},422)}
 const image=form.get('image')
 const retexture=form.get('kind')==='retexture'
 const profile=retexture?'studio-hd':form.get('profile')
 const rawBudget=form.get('polyBudget')
 const polyBudget=rawBudget===null||rawBudget===''?null:Number(rawBudget)
 if(!(image instanceof File)||!MIME.includes(image.type)||
  image.size<128||image.size>FORGE_JOB_MAX_IMAGE)
  return json({error:'forge_job_image_invalid'},422)
 let meshBytes:Buffer|null=null
 if(retexture){
  const mesh=form.get('mesh')
  if(!(mesh instanceof File)||image.size+mesh.size>FORGE_RETEXTURE_MAX_TOTAL)
   return json({error:'forge_job_mesh_invalid'},422)
  meshBytes=Buffer.from(await mesh.arrayBuffer())
  if(!sniffForgeMesh(meshBytes))return json({error:'forge_job_mesh_invalid'},422)
 }
 const viewFiles=retexture?[]:form.getAll('views')
 if(viewFiles.length>FORGE_JOB_MAX_EXTRA_VIEWS||viewFiles.some(v=>!(v instanceof File)||
  !MIME.includes(v.type)||v.size<128)||
  viewFiles.reduce((n,v)=>n+(v as File).size,image.size)>FORGE_RETEXTURE_MAX_TOTAL)
  return json({error:'forge_job_views_invalid'},422)
 if(!isForgeJobProfile(profile))return json({error:'forge_job_profile_invalid'},422)
 if(polyBudget!==null&&!isForgePolyBudget(polyBudget))
  return json({error:'forge_job_poly_budget_invalid'},422)
 if(!['original','licensed'].includes(String(form.get('rights')))||
  form.get('approveCompute')!=='yes'||form.get('approveTransfer')!=='yes')
  return json({error:'forge_approvals_required'},422)

 const {user,unavailable}=await currentUser()
 if(unavailable)return json({error:'forge_auth_unavailable'},503)
 if(!user)return json({error:'forge_auth_required'},401)

 const bytes=Buffer.from(await image.arrayBuffer())
 const sha=createHash('sha256').update(bytes).digest('hex')
 const day=new Date().toISOString().slice(0,10)
 try{
  if(!await rateLimit('forge-gpu-job:'+user.id,2))
   return json({error:'forge_request_rate_limited'},429)
  const claimed=await queryD1<{job_id:string}>(FORGE_QUOTA_CLAIM_SQL,
   [user.id,day,crypto.randomUUID(),sha,day,cfg.globalCap])
  if(claimed.rows.length!==1)return json({error:'forge_gpu_quota_reached'},429)
 }catch{return json({error:'forge_budget_database_unavailable'},503)}

 const upstream=new FormData()
 upstream.set('image',new Blob([bytes],{type:image.type}),'source')
 if(meshBytes)upstream.set('mesh',new Blob([new Uint8Array(meshBytes)]),'mesh')
 else{
  upstream.set('profile',profile)
  if(polyBudget!==null)upstream.set('poly_budget',String(polyBudget))
  for(const view of viewFiles as File[])
   upstream.append('views',new Blob([await view.arrayBuffer()],{type:view.type}),'view')
 }
 let status
 try{
  const r=await fetch(forgeJobsBase(cfg.url)+(meshBytes?'/retexture':''),{
   method:'POST',body:upstream,cache:'no-store',redirect:'error',
   headers:{authorization:'Bearer '+cfg.token},
   signal:AbortSignal.timeout(30000),
  })
  if(r.status===503&&meshBytes)return json({error:'forge_retexture_unavailable',paidGpuStarted:false},503)
  if(r.status===429)return json({error:'forge_gpu_queue_full',paidGpuStarted:false},429)
  if(!r.ok)return json({error:'forge_gpu_job_rejected',upstream:r.status},502)
  status=parseForgeGpuJobStatus(await r.json())
 }catch{return json({error:'forge_gpu_unreachable'},502)}
 if(!status)return json({error:'forge_gpu_job_invalid_response'},502)

 return json({
  handle:signForgeJobHandle(cfg.token,{jobId:status.id,uid:user.id,profile:retexture?'retexture':profile}),
  job:status,
  note:'This job consumed your daily GPU reservation. No automatic retry.',
 },202)
}

export async function GET(request:NextRequest){
 const cfg=resolveForgeGpuBackend(process.env,request.nextUrl.origin)
 if(!cfg||cfg.engine!=='trellis2')return json({error:'forge_gpu_disabled'},503)
 const {user,unavailable}=await currentUser()
 if(unavailable)return json({error:'forge_auth_unavailable'},503)
 if(!user)return json({error:'forge_auth_required'},401)
 const handle=request.headers.get('x-forge-job-handle')??''
 const verified=verifyForgeJobHandle(cfg.token,handle,user.id)
 if(!verified)return json({error:'forge_job_handle_invalid'},403)

 let status
 try{
  const r=await fetch(forgeJobsBase(cfg.url)+'/'+verified.jobId,{
   cache:'no-store',redirect:'error',
   headers:{authorization:'Bearer '+cfg.token},
   signal:AbortSignal.timeout(8000),
  })
  if(r.status===404)return json({job:{id:verified.jobId,state:'expired'}})
  if(!r.ok)return json({error:'forge_gpu_status_unavailable'},502)
  status=parseForgeGpuJobStatus(await r.json())
 }catch{return json({error:'forge_gpu_unreachable'},502)}
 if(!status||status.id!==verified.jobId)
  return json({error:'forge_gpu_job_invalid_response'},502)

 if(status.state!=='succeeded')return json({job:status})
 return json({
  job:status,
  download:{
   url:forgeJobsBase(cfg.url)+'/'+status.id+'/glb',
   ticket:signForgeJobReadTicket(cfg.token,
    {jobId:status.id,origin:request.nextUrl.origin}),
  },
 })
}
