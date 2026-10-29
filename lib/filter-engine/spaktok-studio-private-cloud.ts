import type {StudioFanoutManifest} from './spaktok-studio-fanout'
import {assertStudioFanoutManifest} from './spaktok-studio-fanout'

const HOST='spaktok-private-studio-assets.spaktok.workers.dev'
const MAX=15*1024*1024
type Signed={url:string;headers:Record<string,string>;id:string}
export type PrivateCloudDraft=Readonly<{
 id:string;sha256:string;bytes:number;targets:string[];createdAt:string
}>
const requireEndpoint=(url:string)=>{
 const u=new URL(url)
 if(u.protocol!=='https:'||u.hostname!==HOST||u.port||
    !/^\/v1\/studio\/[a-f0-9-]{36}\/[a-f0-9-]{36}\.glb$/.test(u.pathname)||
    u.search||u.hash||u.username||u.password)
  throw Error('studio_r2_untrusted_destination')
 return u.href
}
const sha256=async(data:ArrayBuffer)=>{
 const hash=new Uint8Array(await crypto.subtle.digest('SHA-256',data))
 return Array.from(hash).map(x=>x.toString(16).padStart(2,'0')).join('')
}
export async function listPrivateCloudDrafts():
 Promise<PrivateCloudDraft[]|null>{
 const response=await fetch('/api/studio/private-assets',{
  method:'GET',credentials:'same-origin',cache:'no-store',
 })
 if(response.status===503)return null
 if(!response.ok)throw Error('studio_cloud_list_failed')
 const data:unknown=await response.json()
 if(!data||typeof data!=='object')throw Error('studio_cloud_bad_response')
 const list=(data as {drafts?:unknown}).drafts
 if(!Array.isArray(list)||list.length>10)
  throw Error('studio_cloud_bad_list')
 return list as PrivateCloudDraft[]
}
/** Opt-in only: no silent upload. GLB goes straight to signed private
 * Cloudflare R2 Worker, never through Vercel's body-size-limited function.
 */
export async function uploadPrivateStudioDraft(
 file:File,manifest:StudioFanoutManifest,
):Promise<string>{
 assertStudioFanoutManifest(manifest)
 if(!crypto.subtle||file.name!==manifest.source.fileName||
  file.size!==manifest.source.bytes||file.size<128||file.size>MAX)
  throw Error('studio_cloud_bad_asset')
 const bytes=await file.arrayBuffer()
 const hash=await sha256(bytes)
 if(hash!==manifest.source.sha256)throw Error('studio_cloud_hash_mismatch')
 const reserve=await fetch('/api/studio/private-assets',{
  method:'POST',credentials:'same-origin',cache:'no-store',
  headers:{'content-type':'application/json'},
  body:JSON.stringify({
   sha256:hash,bytes:file.size,targets:manifest.project.outputTargets,
   rights:manifest.project.rights,
  }),
 })
 if(!reserve.ok)throw Error('studio_cloud_reserve_'+reserve.status)
 const ticket=await reserve.json() as Signed
 if(!ticket||typeof ticket.id!=='string'||!ticket.headers)
  throw Error('studio_cloud_bad_ticket')
 const url=requireEndpoint(ticket.url)
 const remote=await fetch(url,{
  method:'PUT',headers:ticket.headers,body:file,
  mode:'cors',credentials:'omit',redirect:'error',cache:'no-store',
  signal:AbortSignal.timeout(315000),
 })
 if(!remote.ok)throw Error('studio_cloud_upload_'+remote.status)
 const confirmed=await fetch(
  '/api/studio/private-assets/'+encodeURIComponent(ticket.id)+'/confirm',{
   method:'POST',credentials:'same-origin',cache:'no-store',
   headers:{'content-type':'application/json'},body:'{}',
  })
 if(!confirmed.ok)throw Error('studio_cloud_confirm_'+confirmed.status)
 return ticket.id
}
export async function downloadPrivateStudioDraft(
 id:string,shaExpected:string,bytesExpected:number,
):Promise<File>{
 if(!/^[a-f0-9-]{36}$/.test(id)||!/^[a-f0-9]{64}$/.test(shaExpected)||
    !Number.isSafeInteger(bytesExpected)||bytesExpected<128||bytesExpected>MAX)
  throw Error('studio_cloud_bad_request')
 const res=await fetch('/api/studio/private-assets/'+encodeURIComponent(id),{
  credentials:'same-origin',cache:'no-store',
 })
 if(!res.ok)throw Error('studio_cloud_read_ticket_'+res.status)
 const ticket=await res.json() as Signed & {sha256:string;bytes:number}
 if(ticket.sha256!==shaExpected||ticket.bytes!==bytesExpected)
  throw Error('studio_cloud_record_mismatch')
 const remote=await fetch(requireEndpoint(ticket.url),{
  method:'GET',headers:ticket.headers,mode:'cors',credentials:'omit',
  cache:'no-store',redirect:'error',signal:AbortSignal.timeout(120000),
 })
 if(!remote.ok||remote.headers.get('content-type')!=='model/gltf-binary')
  throw Error('studio_cloud_read_'+remote.status)
 if(Number(remote.headers.get('content-length'))!==bytesExpected)
  throw Error('studio_cloud_size_mismatch')
 const content=await remote.arrayBuffer()
 if(content.byteLength!==bytesExpected||await sha256(content)!==shaExpected)
  throw Error('studio_cloud_integrity_mismatch')
 return new File([content],`spaktok-studio-private-${id}.glb`,{
  type:'model/gltf-binary',
 })
}
export async function deletePrivateStudioDraft(id:string):Promise<void>{
 if(!/^[a-f0-9-]{36}$/.test(id))throw Error('studio_cloud_bad_request')
 const r=await fetch('/api/studio/private-assets/'+encodeURIComponent(id),{
  method:'DELETE',credentials:'same-origin',cache:'no-store',
  headers:{'content-type':'application/json'},
 })
 if(!r.ok)throw Error('studio_cloud_delete_'+r.status)
}
