/** Owner-only *draft* crown AR effect. Never a public Live or Story filter. */
export const CROWN_V2_FILTER_ID='3d-royal-crown-v2' as const
/** V2's placement is independent of calibration saved for the OLD GPU pilot.
 * The old model's -0.18 vertical bias must never displace a new V2 crown.
 */
export const CROWN_V2_CALIBRATION_STORAGE_KEY='spaktok.crown-v2.calibration.v1' as const
export const DEFAULT_CROWN_V2_CALIBRATION=Object.freeze({
 scale:1,vertical:0,depth:0,rotation:0,
})

export const CROWN_V2_ASSET=Object.freeze({
 fileName:'spaktok-royal-crown-v2-draft.glb',
 bytes:3324548,
 sha256:'ee5ec583041a9e2b55e31f718e42670ba5526d2cccfa249b549dece4ad81f129',
 triangles:32256,
 materialSlots:6,
 sourceLocked:true,
 approvedForPublicLive:false,
 ownerDraftOnly:true,
})
const URL='https://spaktok-crown-v2-filter.spaktok.workers.dev/v1/crown-v2/draft.glb'
const MAX=8*1024*1024
type Ticket={
 private:boolean;draft:boolean;livePublished:boolean;
 url:string;bytes:number;sha256:string;fileName:string;
 headers:Record<string,string>
}

/** Re-verify bytes in browser: tickets alone never certify an asset. */
export async function verifiedCrownV2Buffer(file:File):Promise<ArrayBuffer>{
 if(!file||file.size!==CROWN_V2_ASSET.bytes||file.size>MAX)
  throw Error('crown_v2_wrong_size')
 const bytes=await file.arrayBuffer()
 if(bytes.byteLength!==CROWN_V2_ASSET.bytes)throw Error('crown_v2_wrong_size')
 const view=new DataView(bytes)
 if(bytes.byteLength<32||view.getUint32(0,true)!==0x46546c67||
    view.getUint32(4,true)!==2||view.getUint32(8,true)!==bytes.byteLength||
    view.getUint32(16,true)!==0x4e4f534a)throw Error('crown_v2_invalid_glb')
 const len=view.getUint32(12,true)
 if(len<24||len>bytes.byteLength-20)throw Error('crown_v2_invalid_glb')
 const hashed=Array.from(new Uint8Array(await crypto.subtle.digest('SHA-256',bytes)))
  .map(b=>b.toString(16).padStart(2,'0')).join('')
 if(hashed!==CROWN_V2_ASSET.sha256)throw Error('crown_v2_digest_mismatch')
 let doc:{asset?:{version?:string};buffers?:{uri?:string}[];images?:{uri?:string}[];
  materials?:{name?:string}[];meshes?:unknown[]}
 try{doc=JSON.parse(new TextDecoder('utf-8',{fatal:true})
  .decode(new Uint8Array(bytes,20,len)))}
 catch{throw Error('crown_v2_invalid_glb')}
 if(doc.asset?.version!=='2.0'||!doc.meshes?.length||
    doc.materials?.length!==CROWN_V2_ASSET.materialSlots||
    [...(doc.buffers||[]),...(doc.images||[])].some(x=>x.uri&&!x.uri.startsWith('data:')))
  throw Error('crown_v2_invalid_glb')
 return bytes
}

/** One-click owner import, file stays in browser memory; no camera upload. */
export async function loadCrownV2OwnerR2():Promise<File>{
 const res=await fetch('/api/spaktok-studio/crown-v2-ticket',{
  method:'POST',credentials:'same-origin',cache:'no-store',
  headers:{'content-type':'application/json'},body:'{}',
 })
 if(!res.ok){
  // Only recognize server-owned error codes. Never expose arbitrary server
  // responses, URLs or private asset metadata to the camera.
  const data:unknown=await res.json().catch(()=>null)
  const code=data&&typeof data==='object'&&!Array.isArray(data)
   ?(data as {error?:unknown}).error:null
  if(res.status===401)throw Error('crown_v2_login')
  if(res.status===403)throw Error(code==='invalid_origin'?'crown_v2_origin':'crown_v2_owner_only')
  if(res.status===503){
   if(code==='draft_not_enabled')throw Error('crown_v2_disabled')
   if(code==='owner_not_configured')throw Error('crown_v2_owner_config')
   if(code==='signing_unavailable')throw Error('crown_v2_signing')
  }
  throw Error('crown_v2_route_unavailable')
 }
 const ticket=await res.json() as Ticket
 if(ticket.url!==URL||ticket.private!==true||ticket.draft!==true||
    ticket.livePublished!==false||ticket.bytes!==CROWN_V2_ASSET.bytes||
    ticket.sha256!==CROWN_V2_ASSET.sha256||ticket.fileName!==CROWN_V2_ASSET.fileName||
    typeof ticket.headers?.['X-Spaktok-Crown-Signature']!=='string')
  throw Error('crown_v2_invalid_ticket')
 const glb=await fetch(URL,{method:'GET',headers:ticket.headers,
  credentials:'omit',mode:'cors',cache:'no-store',redirect:'error'})
 if(!glb.ok||Number(glb.headers.get('content-length'))!==ticket.bytes)
  throw Error('crown_v2_download_unavailable')
 const file=new File([await glb.arrayBuffer()],CROWN_V2_ASSET.fileName,
  {type:'model/gltf-binary'})
 await verifiedCrownV2Buffer(file)
 return file
}
export function crownV2ArabicError(e:unknown):string{
 const code=e instanceof Error?e.message:''
 if(code==='crown_v2_login')return 'سجّل الدخول بحساب المالك لتجربة تاج V2 الخاص.'
 if(code==='crown_v2_owner_only')return 'الحساب الحالي لا يطابق حساب المالك المخوّل؛ تحقّق من تسجيل الدخول بالحساب الصحيح.'
 if(code==='crown_v2_origin')return 'افتَح Spaktok من نطاق الإنتاج الرئيسي؛ رابط المعاينة غير مخوّل لتحميل تاج V2.'
 if(code==='crown_v2_disabled')return 'تجربة تاج V2 غير مفعّلة حاليًا على الخادم.'
 if(code==='crown_v2_owner_config')return 'إعداد حساب المالك غير مكتمل في بيئة النشر الحالية.'
 if(code==='crown_v2_signing')return 'خدمة توقيع تصريح تاج V2 غير متاحة؛ تحتاج إلى فحص إعدادات الخادم.'
 if(code==='crown_v2_route_unavailable'||code==='crown_v2_download_unavailable')
  return 'تعذّر الاتصال بالتخزين الخاص؛ يمكن استيراد نسخة GLB من الهاتف.'
 if(code==='crown_v2_wrong_size'||code==='crown_v2_digest_mismatch'||code==='crown_v2_invalid_glb')
  return 'الملف لا يطابق تاج V2 الأصلي؛ لن نعرض نموذجًا بديلًا مكانه.'
 return 'لم ينجح تحميل تاج V2. يمكن تجربة الملف الأصلي يدويًا.'
}
