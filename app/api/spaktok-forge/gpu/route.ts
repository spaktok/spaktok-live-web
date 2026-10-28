import {NextRequest,NextResponse} from 'next/server'
import {createHash} from 'node:crypto'
import {getNativeUser,rateLimit} from '@/lib/native/auth'
import {queryD1} from '@/lib/native/d1'
import {inspectWordGeneratedGlb,WORD_MAX_RESULT_BYTES} from '@/lib/filter-engine/spaktok-word-import'

/** Optional operator-owned GPU inference bridge.
 * NOT enabled until a licensed GPU host is configured and budget approved.
 * The browser never receives the GPU bearer token or endpoint address.
 */
export const runtime='nodejs'
export const dynamic='force-dynamic'
export const maxDuration=120
const MAX_IMAGE=8*1024*1024
const json=(value:unknown,status=200)=>NextResponse.json(value,{
 status,headers:{'cache-control':'private,no-store','x-content-type-options':'nosniff'},
})
function operatorConfig(){
 if(process.env.SPAKTOK_FORGE_GPU_ENABLED!=='true')return null
 const raw=process.env.SPAKTOK_FORGE_GPU_URL??''
 const allowed=process.env.SPAKTOK_FORGE_GPU_HOST??''
 const token=process.env.SPAKTOK_FORGE_GPU_TOKEN??''
 if(token.length<32||!allowed||!raw)return null
 try{
  const url=new URL(raw)
  if(url.protocol!=='https:'||url.hostname!==allowed||
   url.username||url.password||url.port||url.search||url.hash||
   url.pathname!=='/v1/generate')return null
  if(url.hostname==='localhost'||/^(?:127\.|10\.|192\.168\.|169\.254\.|0\.|::1$)/.test(url.hostname))
   return null
  return {url:url.toString(),token}
 }catch{return null}
}
const originAllowed=(request:NextRequest)=>
 request.headers.get('origin')===request.nextUrl.origin&&
 request.headers.get('sec-fetch-site')!=='cross-site'
function imageIsSupported(bytes:Uint8Array,mime:string):boolean{
 if(bytes.length<128)return false
 const png=bytes[0]===137&&bytes[1]===80&&bytes[2]===78&&bytes[3]===71&&
  bytes[4]===13&&bytes[5]===10&&bytes[6]===26&&bytes[7]===10
 const jpeg=bytes[0]===255&&bytes[1]===216&&bytes[2]===255
 const webp=String.fromCharCode(...bytes.slice(0,4))==='RIFF'&&
  String.fromCharCode(...bytes.slice(8,12))==='WEBP'
 return (mime==='image/png'&&png)||(mime==='image/jpeg'&&jpeg)||
  (mime==='image/webp'&&webp)
}
export async function GET(){
 return json({
  enabled:Boolean(operatorConfig()),
  engine:'Stable Fast 3D (licensed self-host)',
  full360:true,
  dailyCapPerOwner:1,
  maxImageMB:8,
  output:'private GLB',
  paidComputeRequiresApproval:true,
  warning:'Operator GPU billing depends on uptime, host and measured inference time',
 })
}
export async function POST(request:NextRequest){
 if(!originAllowed(request))return json({error:'forge_invalid_origin'},403)
 const cfg=operatorConfig()
 if(!cfg)return json({error:'forge_gpu_disabled'},503)
 const length=Number(request.headers.get('content-length'))
 if(!Number.isSafeInteger(length)||length<128||length>MAX_IMAGE+32768)
  return json({error:'forge_request_too_large'},413)
 let user:Awaited<ReturnType<typeof getNativeUser>>
 try{user=await getNativeUser()}
 catch{return json({error:'forge_auth_unavailable'},503)}
 if(!user)return json({error:'forge_auth_required'},401)
 let source:ArrayBuffer
 let mime:string
 try{
  const form=await request.formData()
  const file=form.get('image')
  if(!(file instanceof File)||file.size<128||file.size>MAX_IMAGE)
   return json({error:'forge_invalid_image'},422)
  const rights=form.get('rights')
  const approved=form.get('approveCompute')
  const privacy=form.get('approveTransfer')
  if((rights!=='original'&&rights!=='licensed')||
   approved!=='yes'||privacy!=='yes')
   return json({error:'forge_approvals_required'},422)
  mime=file.type
  source=await file.arrayBuffer()
  if(!imageIsSupported(new Uint8Array(source),mime))
   return json({error:'forge_image_signature_invalid'},422)
 }catch{return json({error:'forge_invalid_form'},422)}
 const now=new Date()
 const day=now.toISOString().slice(0,10)
 const jobId=crypto.randomUUID()
 const hash=createHash('sha256').update(Buffer.from(source)).digest('hex')
 try{
  if(!await rateLimit('forge-gpu:'+user.id,2))
   return json({error:'forge_request_rate_limited'},429)
  const reserved=await queryD1<{job_id:string}>(`
   INSERT INTO forge_gpu_daily_claims(owner_id,day_utc,job_id,image_sha256,status)
   VALUES(?,?,?,?,'reserved')
   ON CONFLICT(owner_id,day_utc) DO NOTHING
   RETURNING job_id
  `,[user.id,day,jobId,hash])
  if(reserved.rows.length!==1)
   return json({error:'forge_daily_gpu_cap_reached'},429)
 }catch{return json({error:'forge_budget_database_unavailable'},503)}
 const finish=async(status:'succeeded'|'upstream_failed'|'invalid_result')=>{
  try{
   await queryD1(`
    UPDATE forge_gpu_daily_claims SET status=?,completed_at=unixepoch()
    WHERE owner_id=? AND day_utc=? AND job_id=? AND status='reserved'
   `,[status,user!.id,day,jobId])
  }catch{/* Fail closed: existing daily reservation remains, no charge retry. */}
 }
 try{
  const data=new FormData()
  data.set('image',new File([source],'source.'+(
   mime==='image/png'?'png':mime==='image/webp'?'webp':'jpg'),{type:mime}))
  const response=await fetch(cfg.url,{
   method:'POST',
   headers:{authorization:'Bearer '+cfg.token},
   body:data,
   redirect:'error',cache:'no-store',
   signal:AbortSignal.timeout(90000),
  })
  if(!response.ok){
   await finish('upstream_failed')
   return json({error:'forge_gpu_provider_unavailable'},502)
  }
  const len=Number(response.headers.get('content-length')??0)
  if(len>WORD_MAX_RESULT_BYTES){
   await finish('invalid_result')
   return json({error:'forge_gpu_result_too_large'},502)
  }
  const buffer=await response.arrayBuffer()
  if(buffer.byteLength>WORD_MAX_RESULT_BYTES){
   await finish('invalid_result')
   return json({error:'forge_gpu_result_too_large'},502)
  }
  try{inspectWordGeneratedGlb(buffer,'spaktok-forge-ai.glb')}
  catch{
   await finish('invalid_result')
   return json({error:'forge_gpu_result_failed_glb_qa'},502)
  }
  await finish('succeeded')
  return new Response(buffer,{
   status:200,
   headers:{
    'content-type':'model/gltf-binary',
    'content-disposition':'attachment; filename="spaktok-forge-ai.glb"',
    'cache-control':'private,no-store',
    'x-content-type-options':'nosniff',
    'x-forge-engine':'stable-fast-3d',
   },
  })
 }catch{
  await finish('upstream_failed')
  return json({error:'forge_gpu_timed_out_or_unavailable'},503)
 }
}
