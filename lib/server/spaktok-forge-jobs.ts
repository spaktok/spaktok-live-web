/** Signed handles for async A100 TRELLIS.2 jobs.
 *
 * sh1 = job handle held by the browser; bound to the owner id, verified by
 *       Next before any status lookup. Never accepted by the GPU.
 * sj1 = read-only GLB download grant for ONE job, verified by the GPU.
 * Each signature covers its prefix so grants cannot be swapped between
 * purposes (or with the st1 one-use generation ticket).
 */
import {createHmac,timingSafeEqual} from 'node:crypto'

export const FORGE_JOB_PROFILES=['studio-hd','studio-ultra'] as const
export type ForgeJobProfile=typeof FORGE_JOB_PROFILES[number]
export const FORGE_POLY_BUDGETS=[20000,50000,120000,200000,300000,500000] as const
export const FORGE_JOB_HANDLE_SECONDS=3600
export const FORGE_JOB_READ_SECONDS=240
/** Vercel Functions cap request bodies at 4.5MB; keep headroom for multipart. */
export const FORGE_JOB_MAX_IMAGE=4*1024*1024
/** Retexture sends image + mesh through the same 4.5MB function body. */
export const FORGE_RETEXTURE_MAX_TOTAL=4*1024*1024+256*1024
export type ForgeJobHandleProfile=ForgeJobProfile|'retexture'
const isHandleProfile=(v:unknown):v is ForgeJobHandleProfile=>
 v==='retexture'||isForgeJobProfile(v)

/** Magic-byte sniff (GLB v2 with exact length, or PLY); never trust MIME. */
export function sniffForgeMesh(bytes:Uint8Array):'glb'|'ply'|null{
 if(bytes.length<64)return null
 const head=String.fromCharCode(...bytes.subarray(0,5))
 if(head.startsWith('glTF')){
  const view=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
  return view.getUint32(4,true)===2&&view.getUint32(8,true)===bytes.length?'glb':null
 }
 return head.startsWith('ply\n')||head==='ply\r\n'?'ply':null
}

const JOB_ID=/^[A-Za-z0-9_-]{16,64}$/
const UID=/^[A-Za-z0-9_-]{1,128}$/
const nowSec=()=>Math.floor(Date.now()/1000)

const sign=(secret:string,prefix:string,body:string)=>
 createHmac('sha256',secret).update(prefix+'.'+body).digest('base64url')

function seal(secret:string,prefix:string,claims:object){
 const body=Buffer.from(JSON.stringify(claims)).toString('base64url')
 return prefix+'.'+body+'.'+sign(secret,prefix,body)
}

function open(secret:string,prefix:string,token:string):Record<string,unknown>|null{
 if(secret.length<32||token.length>1800)return null
 const parts=token.split('.')
 if(parts.length!==3||parts[0]!==prefix||!/^[A-Za-z0-9_-]+$/.test(parts[1]+parts[2]))
  return null
 const expected=Buffer.from(sign(secret,prefix,parts[1]))
 const actual=Buffer.from(parts[2])
 if(expected.length!==actual.length||!timingSafeEqual(expected,actual))return null
 try{
  const value:unknown=JSON.parse(Buffer.from(parts[1],'base64url').toString('utf8'))
  return value&&typeof value==='object'?value as Record<string,unknown>:null
 }catch{return null}
}

export function isForgeJobProfile(value:unknown):value is ForgeJobProfile{
 return FORGE_JOB_PROFILES.includes(value as ForgeJobProfile)
}
export function isForgePolyBudget(value:unknown):value is number{
 return FORGE_POLY_BUDGETS.includes(value as typeof FORGE_POLY_BUDGETS[number])
}

export function signForgeJobHandle(secret:string,input:{
 jobId:string;uid:string;profile:ForgeJobHandleProfile
},now=nowSec()):string{
 if(!JOB_ID.test(input.jobId)||!UID.test(input.uid))throw Error('forge_job_handle_invalid')
 return seal(secret,'sh1',{
  v:1,purpose:'forge-job-handle',jobId:input.jobId,uid:input.uid,
  profile:input.profile,iat:now,exp:now+FORGE_JOB_HANDLE_SECONDS,
 })
}

export function verifyForgeJobHandle(secret:string,handle:string,uid:string,
 now=nowSec()):{jobId:string;profile:ForgeJobHandleProfile}|null{
 const c=open(secret,'sh1',handle)
 if(!c||c.v!==1||c.purpose!=='forge-job-handle'||c.uid!==uid)return null
 if(typeof c.jobId!=='string'||!JOB_ID.test(c.jobId)||!isHandleProfile(c.profile))
  return null
 if(typeof c.iat!=='number'||typeof c.exp!=='number'||c.exp<=now||
  c.iat>now+10||c.exp-c.iat>FORGE_JOB_HANDLE_SECONDS)return null
 return {jobId:c.jobId,profile:c.profile}
}

export function signForgeJobReadTicket(secret:string,input:{jobId:string;origin:string},
 now=nowSec()):string{
 if(!JOB_ID.test(input.jobId)||!input.origin.startsWith('https://'))
  throw Error('forge_job_read_invalid')
 return seal(secret,'sj1',{
  v:1,purpose:'forge-job-read',jobId:input.jobId,origin:input.origin,
  iat:now,exp:now+FORGE_JOB_READ_SECONDS,
 })
}

/** cfg.url is pinned to https://host/v1/generate by resolveForgeGpuBackend. */
export function forgeJobsBase(generateUrl:string):string{
 return new URL('/v1/jobs',generateUrl).toString()
}

export interface ForgeGpuJobStatus{
 id:string
 state:'queued'|'running'|'succeeded'|'failed'|'expired'
 profile:string
 polyBudget:number|null
 queuePosition?:number
 error:string|null
 bytes:number|null
 sha256:string|null
}

const STATES=['queued','running','succeeded','failed','expired']
export function parseForgeGpuJobStatus(raw:unknown):ForgeGpuJobStatus|null{
 if(!raw||typeof raw!=='object')return null
 const v=raw as Record<string,unknown>
 if(typeof v.id!=='string'||!JOB_ID.test(v.id)||!STATES.includes(String(v.state)))return null
 return {
  id:v.id,state:v.state as ForgeGpuJobStatus['state'],
  profile:String(v.profile??''),
  polyBudget:typeof v.polyBudget==='number'?v.polyBudget:null,
  queuePosition:typeof v.queuePosition==='number'?v.queuePosition:undefined,
  error:typeof v.error==='string'&&/^[a-z0-9_]{1,64}$/.test(v.error)?v.error:
   v.error==null?null:'inference_exception',
  bytes:typeof v.bytes==='number'?v.bytes:null,
  sha256:typeof v.sha256==='string'&&/^[0-9a-f]{64}$/.test(v.sha256)?v.sha256:null,
 }
}
