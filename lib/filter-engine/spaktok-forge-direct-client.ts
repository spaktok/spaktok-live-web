import {
 inspectWordGeneratedGlb,type WordGeneratedInspection,
} from './spaktok-word-import'

const MAX_UPLOAD=8*1024*1024
const MAX_OUTPUT=35*1024*1024
export type ForgeGpuProfile='mobile-preview'|'detail-preview'|'studio-hd'
type DirectTicket=Readonly<{
 url:string;host:string;provider:'vast'|'runpod';engine:'trellis-v1'|'trellis2'|'stable-fast-3d'
 ticket:string;jobId:string;expiresAt:string;quickTunnelPreview?:boolean
}>
export type ForgeDirectResult=Readonly<{
 file:File;inspection:WordGeneratedInspection
}>
/** A single approved GPU request. Large images/results do not traverse a
 * Vercel Function (4.5MB body limit); only a short SHA256 ticket does.
 * No automatic retry: the D1 reservation may already have been consumed.
 */
export async function generateForgeGpuDirect(
 file:File,rights:'original'|'licensed',
 profile:ForgeGpuProfile='mobile-preview',
):Promise<ForgeDirectResult>{
 if(!['mobile-preview','detail-preview','studio-hd'].includes(profile))
  throw Error('forge_direct_invalid_profile')
 if(file.size<128||file.size>MAX_UPLOAD||
  !['image/png','image/jpeg','image/webp'].includes(file.type))
  throw Error('forge_direct_invalid_image')
 if(!crypto.subtle)throw Error('forge_direct_secure_browser_required')
 const digest=new Uint8Array(await crypto.subtle.digest(
  'SHA-256',await file.arrayBuffer()))
 const sha256=Array.from(digest)
  .map(b=>b.toString(16).padStart(2,'0')).join('')
 // Ticket is a small authenticated same-origin JSON request.
 const reserve=await fetch('/api/spaktok-forge/gpu-ticket',{
  method:'POST',
  headers:{'content-type':'application/json'},
  credentials:'same-origin',cache:'no-store',
  body:JSON.stringify({
   sha256,size:file.size,mime:file.type,rights,profile,
   approveCompute:'yes',approveTransfer:'yes',
  }),
 })
 if(!reserve.ok){
  const detail=await reserve.json().catch(()=>({error:'forge_ticket_failed'}))
  throw Error(typeof detail.error==='string'?detail.error:'forge_ticket_failed')
 }
 const value:unknown=await reserve.json()
 if(!value||typeof value!=='object')
  throw Error('forge_direct_bad_ticket_response')
 const obj=value as Partial<DirectTicket>
 if(typeof obj.url!=='string'||typeof obj.ticket!=='string'||
  typeof obj.host!=='string'||typeof obj.provider!=='string'||
  typeof obj.engine!=='string'||typeof obj.expiresAt!=='string')
  throw Error('forge_direct_bad_ticket_response')
 const destination=new URL(obj.url)
 // The authenticated server has pinned the exact host independently
 // from the URL. Reject all browser-supplied or transient tunnel endpoints.
 const quick=obj.host.endsWith('.trycloudflare.com')
 const previewTunnel=quick&&obj.quickTunnelPreview===true&&
  obj.engine==='trellis2'&&
  /^[a-z0-9-]{6,80}\.trycloudflare\.com$/i.test(obj.host)
 const vast=obj.provider==='vast'&&(obj.engine==='trellis2'||obj.engine==='trellis-v1')&&
  obj.host===destination.hostname&&
  /^[a-z0-9-]+(?:\.[a-z0-9-]+)+$/i.test(obj.host)&&
  (!quick||previewTunnel)&&
  !obj.host.endsWith('.proxy.runpod.net')&&
  !/\.(?:localhost|local|internal|test|invalid|example|onion)$/i.test(obj.host)
 const runpod=obj.provider==='runpod'&&
  obj.host===destination.hostname&&
  destination.hostname.endsWith('.proxy.runpod.net')
 if(destination.protocol!=='https:'||!(vast||runpod)||
  destination.pathname!=='/v1/generate'||
  destination.port||destination.username||destination.password||
  destination.search||destination.hash||
  !/^st1\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+$/.test(obj.ticket)||
  new Date(obj.expiresAt).getTime()<=Date.now())
  throw Error('forge_direct_invalid_destination_or_expired_ticket')
 const form=new FormData()
 form.set('image',file)
 let response:Response
 try{
  response=await fetch(destination.toString(),{
   method:'POST',body:form,
   headers:{authorization:'Bearer '+obj.ticket},
   mode:'cors',credentials:'omit',
   cache:'no-store',redirect:'error',
   signal:AbortSignal.timeout(profile==='studio-hd'?240000:115000),
  })
 }catch{
  throw Error('forge_direct_network_or_cors_failed_ticket_consumed')
 }
 if(!response.ok)
  throw Error('forge_direct_provider_'+response.status+'_ticket_consumed')
 const declared=Number(response.headers.get('content-length')??0)
 if(Number.isFinite(declared)&&declared>MAX_OUTPUT)
  throw Error('forge_direct_result_too_large')
 if(response.headers.get('content-type')?.split(';')[0]!=='model/gltf-binary')
  throw Error('forge_direct_wrong_content_type')
 let buffer:ArrayBuffer
 if(response.body){
  const reader=response.body.getReader()
  const parts:Uint8Array<ArrayBuffer>[]=[]
  let total=0
  try{
   while(true){
    const {done,value}=await reader.read()
    if(done)break
    total+=value.byteLength
    if(total>MAX_OUTPUT){
     await reader.cancel()
     throw Error('forge_direct_result_too_large')
    }
    parts.push(new Uint8Array(value))
   }
  }finally{reader.releaseLock()}
  const merged=new Uint8Array(total)
  let at=0
  for(const part of parts){merged.set(part,at);at+=part.byteLength}
  buffer=merged.buffer
 }else{
  buffer=await response.arrayBuffer()
  if(buffer.byteLength>MAX_OUTPUT)
   throw Error('forge_direct_result_too_large')
 }
 const inspection=inspectWordGeneratedGlb(buffer,'spaktok-forge-ai.glb')
 return {
  file:new File([buffer],inspection.fileName,{type:'model/gltf-binary'}),
  inspection,
 }
}
