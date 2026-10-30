import {NextRequest,NextResponse} from 'next/server'
import {createHmac} from 'node:crypto'
import {resolveForgeGpuBackend,type ForgeGpuBackend} from '@/lib/server/spaktok-forge-provider'
import {getNativeUser,rateLimit,nativeAuthReady} from '@/lib/native/auth'
import {queryD1} from '@/lib/native/d1'
import {FORGE_QUOTA_CLAIM_SQL} from '@/lib/server/spaktok-forge-budget'

/** Browser-to-operator GPU short-lived one-use grant.
 *
 * Vercel Functions cap request and response payloads at 4.5MB:
 *  - The image NEVER passes through this route.
 *  - The 35MB generated GLB NEVER passes through this route.
 *  - A client-computed image sha256 is bound into an HMAC grant.
 *  - GPU validates the actual uploaded bytes, origin, ticket age and nonce.
 *
 * V1 one-process nonce guard on GPU is for a single one-hour test ONLY.
 * Before multi-worker/public production use durable nonce enforcement.
 */
export const runtime='nodejs'
export const dynamic='force-dynamic'
const MAX_IMAGE=8*1024*1024
const MAX_BODY=2048
const json=(body:unknown,status=200)=>NextResponse.json(body,{
 status,headers:{
  'cache-control':'private,no-store','x-content-type-options':'nosniff',
 },
})
const config=(origin:string)=>resolveForgeGpuBackend(process.env,origin)
const allowed=(request:NextRequest)=>
 request.headers.get('origin')===request.nextUrl.origin&&
 request.headers.get('sec-fetch-site')!=='cross-site'

async function gpuStatus(cfg:ForgeGpuBackend):Promise<{online:boolean;hdConfigured:boolean}>{
 try{
  const healthUrl=new URL('/health',cfg.url)
  const r=await fetch(healthUrl.toString(),{
   method:'GET',cache:'no-store',redirect:'error',
   signal:AbortSignal.timeout(4000),
  })
  if(!r.ok)return {online:false,hdConfigured:false}
  const raw=await r.text()
  if(raw.length>1024)return {online:false,hdConfigured:false}
  const parsed:unknown=JSON.parse(raw)
  const value=parsed as {ready?:unknown;engine?:unknown;hdConfigured?:unknown}
  const online=!!value&&value.ready===true&&value.engine===cfg.engine
  return {online,hdConfigured:online&&value.hdConfigured===true}
 }catch{return {online:false,hdConfigured:false}}
}

export async function GET(request:NextRequest){
 const cfg=config(request.nextUrl.origin)
 const gpu=cfg?await gpuStatus(cfg):{online:false,hdConfigured:false}
 const online=gpu.online
 const hdAvailable=Boolean(cfg?.engine==='trellis2'&&gpu.hdConfigured&&
  process.env.SPAKTOK_FORGE_GPU_HD_ENABLED==='true')
 return json({
  enabled:online,delivery:'direct-private-ticket',
  authConfigured:nativeAuthReady(),
  readiness:!cfg?'operator_not_configured':
   online?'ready':'gpu_loading_or_unreachable',
  previewQuickTunnel:Boolean(cfg?.provider==='vast'&&
   new URL(cfg.url).hostname.endsWith('.trycloudflare.com')),
  engine:cfg?.engine??null,provider:cfg?.provider??null,
  hdAvailable,
  full360:true,dailyCapPerOwner:1,
  globalDailyCap:cfg?.globalCap??null,maxImageMB:8,
  maxResultMB:35,
  warning:'Direct browser delivery avoids Vercel 4.5MB payload limit; GPU needs origin-locked CORS and nonce admission; no public release.',
 })
}
export async function POST(request:NextRequest){
 if(!allowed(request))return json({error:'forge_invalid_origin'},403)
 const cfg=config(request.nextUrl.origin)
 if(!cfg)return json({error:'forge_gpu_disabled'},503)
 const gpu=await gpuStatus(cfg)
 if(!gpu.online)
  return json({error:'forge_gpu_provider_not_ready'},503)
 const length=Number(request.headers.get('content-length')??0)
 if(length>MAX_BODY)return json({error:'forge_ticket_too_large'},413)
 let input:unknown
 try{
  const body=await request.text()
  if(body.length>MAX_BODY)throw Error('too_long')
  input=JSON.parse(body)
 }catch{return json({error:'forge_ticket_invalid_json'},422)}
 if(!input||typeof input!=='object')return json({error:'forge_ticket_invalid'},422)
 const data=input as Record<string,unknown>
 const imageSHA=data.sha256
 const size=data.size
 const mime=data.mime
 const profile=data.profile??'mobile-preview'
 if(typeof imageSHA!=='string'||!/^[0-9a-f]{64}$/.test(imageSHA)||
  typeof size!=='number'||!Number.isSafeInteger(size)||
  size<128||size>MAX_IMAGE||
  !['image/png','image/jpeg','image/webp'].includes(String(mime)))
  return json({error:'forge_ticket_image_invalid'},422)
 if(!['mobile-preview','detail-preview','studio-hd'].includes(String(profile)))
  return json({error:'forge_ticket_profile_invalid'},422)
 if(profile==='studio-hd'&&!(
  cfg.engine==='trellis2'&&process.env.SPAKTOK_FORGE_GPU_HD_ENABLED==='true'&&
  gpu.hdConfigured))
  return json({error:'forge_gpu_hd_not_authorized'},403)
 if(!['original','licensed'].includes(String(data.rights))||
  data.approveCompute!=='yes'||data.approveTransfer!=='yes')
  return json({error:'forge_approvals_required'},422)
 let user:Awaited<ReturnType<typeof getNativeUser>>
 try{user=await getNativeUser()}
 catch{return json({error:'forge_auth_unavailable'},503)}
 if(!user)return json({error:'forge_auth_required'},401)
 const day=new Date().toISOString().slice(0,10)
 const nonce=crypto.randomUUID()
 try{
  if(!await rateLimit('forge-gpu:'+user.id,2))
   return json({error:'forge_request_rate_limited'},429)
  const claimed=await queryD1<{job_id:string}>(FORGE_QUOTA_CLAIM_SQL,
   [user.id,day,nonce,imageSHA,day,cfg.globalCap])
  if(claimed.rows.length!==1)
   return json({error:'forge_gpu_quota_reached'},429)
 }catch{return json({error:'forge_budget_database_unavailable'},503)}
 const iat=Math.floor(Date.now()/1000)
 const claims={
  v:1,purpose:'forge-browser-one-use',nonce,
  origin:request.nextUrl.origin,
  iat,exp:iat+120,sha256:imageSHA,size,mime,profile,
 }
 const base=Buffer.from(JSON.stringify(claims)).toString('base64url')
 const signature=createHmac('sha256',cfg.token).update(base).digest('base64url')
 return json({
  url:cfg.url,host:new URL(cfg.url).hostname,
  provider:cfg.provider,engine:cfg.engine,
  ticket:'st1.'+base+'.'+signature,
  quickTunnelPreview:cfg.provider==='vast'&&new URL(cfg.url).hostname.endsWith('.trycloudflare.com'),
  jobId:nonce,expiresAt:new Date((iat+120)*1000).toISOString(),
  note:'This one-use grant consumed an operator daily job reservation. No automatic retry; never share the temporary ticket.',
 })
}
