/** First GPU GLB stays owner-private. This is an optional local preview prop. */
import {SPAKTOK_FIRST_GPU_ASSET} from './spaktok-first-gpu-asset'
export const FIRST_GPU_LIVE_FILTER_ID='3d-first-gpu-pilot' as const
export type FirstGpuPilotCalibration=Readonly<{
 scale:number;vertical:number;depth:number;rotation:number
}>
export const DEFAULT_FIRST_GPU_CALIBRATION:FirstGpuPilotCalibration=Object.freeze({
 scale:1,vertical:-.18,depth:0,rotation:0,
})
/** Restrict head-prop controls and tolerate corrupted device settings. */
export function normalizeFirstGpuCalibration(input:unknown):FirstGpuPilotCalibration{
 const p=input&&typeof input==='object'&&!Array.isArray(input)?
  input as Record<string,unknown>:{}
 const clamp=(key:keyof FirstGpuPilotCalibration,min:number,max:number)=>{
  const v=p[key]
  if(typeof v!=='number'||!Number.isFinite(v))
   return DEFAULT_FIRST_GPU_CALIBRATION[key]
  return Math.min(max,Math.max(min,v))
 }
 return {
  scale:clamp('scale',.4,1.8),
  vertical:clamp('vertical',-.5,.5),
  depth:clamp('depth',-.35,.35),
  rotation:clamp('rotation',-90,90),
 }
}
export const FIRST_GPU_CALIBRATION_STORAGE_KEY='spaktok.first-gpu.live-calibration.v1' as const
const url='https://spaktok-private-studio-asset.spaktok.workers.dev/v1/pilot/lod0.glb'

export async function verifiedFirstGpuBuffer(file:File):Promise<ArrayBuffer>{
 if(!file||file.size!==SPAKTOK_FIRST_GPU_ASSET.bytes)throw Error('gpu_wrong_size')
 const buffer=await file.arrayBuffer()
 const view=new DataView(buffer)
 if(buffer.byteLength!==SPAKTOK_FIRST_GPU_ASSET.bytes||
   view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||
   view.getUint32(8,true)!==buffer.byteLength||view.getUint32(16,true)!==0x4e4f534a)
   throw Error('gpu_invalid_glb')
 const length=view.getUint32(12,true)
 if(length<20||length>buffer.byteLength-20)throw Error('gpu_invalid_glb')
 const hash=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',buffer)))
  .map(b=>b.toString(16).padStart(2,'0')).join('')
 if(hash!==SPAKTOK_FIRST_GPU_ASSET.sha256)throw Error('gpu_wrong_digest')
 const doc=JSON.parse(new TextDecoder('utf-8',{fatal:true})
  .decode(new Uint8Array(buffer,20,length))) as {
  asset?:{version?:string};buffers?:{uri?:string}[];images?:{uri?:string}[]
 }
 if(doc.asset?.version!=='2.0'||
  [...(doc.buffers||[]),...(doc.images||[])].some(x=>x.uri&&!x.uri.startsWith('data:')))
  throw Error('gpu_external_resource')
 return buffer
}

type Ticket={url:string;lod:string;bytes:number;sha256:string;private:boolean;headers:Record<string,string>}
export async function loadFirstGpuOwnerR2():Promise<File>{
 const res=await fetch('/api/spaktok-studio/pilot-ticket',{
  method:'POST',credentials:'same-origin',cache:'no-store',
  headers:{'content-type':'application/json'},body:JSON.stringify({lod:'lod0'}),
 })
 if(!res.ok)throw Error(res.status===401?'gpu_login':res.status===403?'gpu_owner':'gpu_route_off')
 const ticket=await res.json() as Ticket
 if(ticket.url!==url||ticket.lod!=='lod0'||ticket.private!==true||
  ticket.bytes!==SPAKTOK_FIRST_GPU_ASSET.bytes||
  ticket.sha256!==SPAKTOK_FIRST_GPU_ASSET.sha256||
  typeof ticket.headers?.['X-Spaktok-Studio-Signature']!=='string')
  throw Error('gpu_invalid_ticket')
 const glb=await fetch(url,{
  method:'GET',headers:ticket.headers,credentials:'omit',mode:'cors',cache:'no-store',redirect:'error',
 })
 if(!glb.ok||Number(glb.headers.get('content-length'))!==ticket.bytes)
  throw Error('gpu_route_off')
 const file=new File([await glb.arrayBuffer()],SPAKTOK_FIRST_GPU_ASSET.fileName,
   {type:'model/gltf-binary'})
 await verifiedFirstGpuBuffer(file)
 return file
}
export function firstGpuErrorMessage(error:unknown):string{
 const code=error instanceof Error?error.message:''
 if(code==='gpu_login')return 'يلزم تسجيل الدخول بحساب المالك لتحميل مجسم GPU الخاص.'
 if(code==='gpu_owner')return 'الملف خاص بالمالك وليس متاحًا للحساب الحالي.'
 if(code==='gpu_route_off')return 'الملف موجود في R2، لكن رابط التحميل الخاص غير مفعّل. اختر نسخته الأصلية GLB من هاتفك.'
 if(code==='gpu_wrong_digest'||code==='gpu_wrong_size'||code==='gpu_invalid_glb')
  return 'الملف غير مطابق لأول GLB GPU المعتمد؛ لا نعرض نموذجًا مختلفًا بدلًا منه.'
 return 'تعذّر قراءة المجسم الخاص. جرّب الملف الأصلي أو فلترًا جاهزًا.'
}
