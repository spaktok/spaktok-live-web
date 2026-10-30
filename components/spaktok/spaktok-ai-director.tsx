'use client'
import {useEffect,useMemo,useState,type ChangeEvent} from 'react'
import dynamic from 'next/dynamic'
import {
 DIRECTOR_TARGETS,detectDirectorTargets,evaluateDirectorAsset,
 planSpaktokDirector,type DirectorTarget,type DirectorAssetQA,
} from '@/lib/filter-engine/spaktok-ai-director'
import {inspectWordGeneratedGlb} from '@/lib/filter-engine/spaktok-word-import'
import {isFirstGpuAsset,SPAKTOK_FIRST_GPU_ASSET} from '@/lib/filter-engine/spaktok-first-gpu-asset'
import {
 SPAKTOK_FIRST_GPU_LODS,SPAKTOK_FIRST_GPU_LOD_IDS,
 type SpaktokFirstLodId,
} from '@/lib/filter-engine/spaktok-first-gpu-lods'
import {generateForgeGpuDirect,type ForgeGpuProfile} from '@/lib/filter-engine/spaktok-forge-direct-client'
import {planForgeGpuGeneration} from '@/lib/filter-engine/spaktok-forge-gpu-plan'
import {createDirectorReliefGlb} from '@/lib/filter-engine/spaktok-director-local-relief'
import {buildSpaktokQualityEvidence} from '@/lib/filter-engine/spaktok-forge-quality-evidence'
import {inspectStudioGlbTopology,type StudioTopologyReport} from '@/lib/filter-engine/spaktok-glb-topology-audit'
import {
 createStudioFanoutManifest,type StudioFanoutManifest,
} from '@/lib/filter-engine/spaktok-studio-fanout'
import {
 saveStudioFanoutBundle,loadStudioFanoutManifest,clearStudioFanoutManifest,
 loadLocalStudioGlb,clearLocalStudioGlb,saveActiveOwnerRodinHead,
 loadActiveOwnerRodinHead,clearActiveOwnerRodinHead,
} from '@/lib/filter-engine/reality-local-asset-handoff'

const PrivateStudioGlbPreview=dynamic(
 ()=>import('./private-studio-glb-preview'),{ssr:false},
)

const TARGET_LABELS:Readonly<Record<DirectorTarget,string>>={
 avatar:'أفاتار',live:'لايف',filter:'فلتر AR',
 gift:'هدية Gift',world:'عالم Spaktok',
}
const TARGET_DESTINATIONS:Readonly<Record<DirectorTarget,string>>={
 avatar:'/avatar-studio?from=ai-director',
 live:'/avatar-studio?from=ai-director',
 filter:'/reality-studio?from=ai-director',
 gift:'/gift-studio?from=ai-director',
 world:'/spaktok-world?from=ai-director',
}
const ISSUE_AR:Readonly<Record<string,string>>={
 invalid_or_external_glb:'شبكة GLB غير صالحة أو تحتوي على روابط خارجية',
 mobile_asset_over_15mb:'حجم GLB أكبر من حد تسليم 15MB',
 mobile_triangle_budget_review:'الشبكة تتجاوز 150 ألف مثلث',
 mobile_texture_budget_review:'توجد صور خامات كثيرة للهاتف',
 missing_uv:'خرائط UV غير مكتملة',missing_normals:'Normals ناقصة',
 missing_pbr:'خامات PBR ناقصة',
 no_embedded_texture_images:'لا توجد صور خامات مضمّنة في GLB',
 face_morph_targets_missing:'تعابير الوجه Morph Targets غير موجودة',
 real_time_tracking_unverified:'تتبع الوجه الحقيقي واللايف غير مختبر',
 face_anchor_and_occlusion_unverified:'موضع الفلتر والإخفاء خلف الوجه غير معاير',
 gift_animation_missing:'حركة الهدية لم تُنشأ بعد',
 world_collision_and_scale_unverified:'تصادم العالم وقياساته غير معايرة',
 real_android_fps_and_thermal_unverified:'FPS والحرارة على Android لم يُختبرا',
 rights_and_public_release_unapproved:'النشر العام يحتاج مراجعة الحقوق والجودة',
}
const STAGE_NAMES:Readonly<Record<string,string>>={
 source:'فحص المصدر والحقوق',generation:'توليد أو إعادة استخدام المجسم',
 geometry:'فحص شبكة GLB',rig:'تجهيز تحريك الوجه',
 filter:'تثبيت الفلتر والكاميرا', 'gift-animation':'تحريك الهدية',
 'world-placement':'تجهيز عنصر العالم','mobile-qa':'اختبار Android',
 publish:'مراجعة النشر',
}
const isImage=(file:File)=>/\.(png|jpe?g|webp)$/i.test(file.name)
const isGlb=(file:File)=>/\.glb$/i.test(file.name)
type StudioPilotHealth=Readonly<{
 enabled:boolean
 reason:'pilot_operator_not_configured'|'pilot_sign_in_required'|
  'pilot_owner_only'|'server_signer_configured'|'unavailable'
 workerVerified:false
}>
type GPUHealth=Readonly<{
 enabled:boolean;authConfigured?:boolean;hdAvailable?:boolean;globalDailyCap:number|null;provider:string|null;engine:string|null
 readiness?:'ready'|'operator_not_configured'|'gpu_loading_or_unreachable'
}>
export default function SpaktokAIDirector({
 sourceFile,onGeneratedGlb,
}:Readonly<{sourceFile?:File|null;onGeneratedGlb?:(asset:File)=>void}>){
 const [ownFile,setOwnFile]=useState<File|null>(null)
 const [description,setDescription]=useState(
  'حوّل هذه الصورة إلى شخصية 3D يمكن استخدامها كأفاتار وفلتر وفي اللايف')
 const [manualTargets,setManualTargets]=useState<DirectorTarget[]|null>(null)
 const targets=manualTargets??[...detectDirectorTargets(description)]
 const [rights,setRights]=useState<'original'|'licensed'>('original')
 const [rightsApproved,setRightsApproved]=useState(false)
 const [gpuConsent,setGpuConsent]=useState(false)
 const [imageMode,setImageMode]=useState<'local-2.5d'|'gpu-360'>('local-2.5d')
 const [qualityPreference,setQualityPreference]=useState<'auto'|ForgeGpuProfile>('auto')
 const [transferConsent,setTransferConsent]=useState(false)
 const [health,setHealth]=useState<GPUHealth|null>(null)
 const [healthBusy,setHealthBusy]=useState(false)
 const [cloudLod,setCloudLod]=useState<SpaktokFirstLodId>('lod1c')
 const [studioPilot,setStudioPilot]=useState<StudioPilotHealth>({
  enabled:false,reason:'unavailable',workerVerified:false,
 })
 useEffect(()=>{
  let active=true
  fetch('/api/spaktok-studio/pilot-ticket',{
   method:'GET',credentials:'same-origin',cache:'no-store',
  }).then(r=>r.ok?r.json():Promise.reject(Error('studio_pilot_unreachable')))
   .then((value:unknown)=>{
    if(!active)return
    const v=value as Partial<StudioPilotHealth>|null
    const ready=v?.enabled===true&&v.reason==='server_signer_configured'
    setStudioPilot({
     enabled:ready,
     reason:ready?'server_signer_configured':
      v?.reason==='pilot_sign_in_required'?'pilot_sign_in_required':
      v?.reason==='pilot_owner_only'?'pilot_owner_only':
      'pilot_operator_not_configured',
     workerVerified:false,
    })
   }).catch(()=>{
    if(active)setStudioPilot({
     enabled:false,reason:'unavailable',workerVerified:false,
    })
   })
  return()=>{active=false}
 },[])
 const refreshGpuHealth=async()=>{
  if(healthBusy)return
  setHealthBusy(true)
  try{
   const r=await fetch('/api/spaktok-forge/gpu-ticket',{
    cache:'no-store',credentials:'same-origin',
   })
   if(!r.ok)throw Error('gpu_health_http_'+r.status)
   const x=await r.json()
   setHealth({
    enabled:x.enabled===true,
    authConfigured:x.authConfigured===true,
    hdAvailable:x.hdAvailable===true,
    globalDailyCap:typeof x.globalDailyCap==='number'?x.globalDailyCap:null,
    provider:typeof x.provider==='string'?x.provider:null,
    engine:typeof x.engine==='string'?x.engine:null,
    readiness:['ready','operator_not_configured','gpu_loading_or_unreachable'].includes(x.readiness)?
     x.readiness:undefined,
   })
  }catch{
   setHealth({enabled:false,authConfigured:false,globalDailyCap:null,
    provider:null,engine:null,readiness:'operator_not_configured'})
  }finally{setHealthBusy(false)}
 }
 const [busy,setBusy]=useState(false)
 const [asset,setAsset]=useState<File|null>(null)
 const [qa,setQA]=useState<DirectorAssetQA|null>(null)
 const [topology,setTopology]=useState<StudioTopologyReport|null>(null)
 const [manifest,setManifest]=useState<StudioFanoutManifest|null>(null)
 const [status,setStatus]=useState('')
 const [show,setShow]=useState(true)
 const [ownerBusy,setOwnerBusy]=useState(false)
 const source=ownFile??sourceFile??null
 const sourceKind=source?(isGlb(source)?'glb':isImage(source)?'image':'none'):'none'
 const plan=useMemo(()=>planSpaktokDirector({
  description,targets,source:sourceKind,
  rightsApproved,gpuAvailable:health?.enabled===true&&health?.authConfigured===true,
  computeApproved:gpuConsent,transferApproved:transferConsent,
  localReliefSelected:sourceKind==='image'&&imageMode==='local-2.5d',
 }),[description,targets,sourceKind,rightsApproved,health,gpuConsent,transferConsent,imageMode])
 useEffect(()=>{
  // Word/Studio can replace the source without going through this picker.
  // Never carry an earlier rights/paid-compute approval to that new asset.
  setRightsApproved(false)
  setTransferConsent(false)
  setGpuConsent(false)
  setImageMode('local-2.5d')
  setQualityPreference('auto')
 },[sourceFile])
 useEffect(()=>{
  let active=true
  fetch('/api/spaktok-forge/gpu-ticket',{cache:'no-store'})
   .then(r=>r.ok?r.json():Promise.reject(Error('forge_gpu_health')))
   .then(x=>{if(active)setHealth({
    enabled:x.enabled===true,
    authConfigured:x.authConfigured===true,
    hdAvailable:x.hdAvailable===true,
    globalDailyCap:typeof x.globalDailyCap==='number'?x.globalDailyCap:null,
    provider:typeof x.provider==='string'?x.provider:null,
    engine:typeof x.engine==='string'?x.engine:null,
    readiness:['ready','operator_not_configured','gpu_loading_or_unreachable'].includes(x.readiness)?
     x.readiness:undefined,
   })})
   .catch(()=>{if(active)setHealth({enabled:false,globalDailyCap:null,provider:null,engine:null})})
  return()=>{active=false}
 },[])
 const select=(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0]??null
  event.target.value=''
  if(file&&(!isImage(file)&&!isGlb(file))){
   setStatus('اختر صورة PNG/JPG/WEBP أو مجسم GLB.')
   return
  }
  if(file&&file.size>(isImage(file)?8:35)*1024*1024){
   setStatus('الصورة يجب أن تكون أقل من 8MB، وGLB أقل من 35MB.')
   return
  }
  setOwnFile(file);setAsset(null);setQA(null);setManifest(null)
  setRightsApproved(false);setTransferConsent(false);setGpuConsent(false)
  setImageMode('local-2.5d')
  setQualityPreference('auto')
  setStatus(file?'المصدر جاهز للتخطيط، لم يتم رفعه إلى أي خادم.':'')
 }
 const storeRodin=async()=>{
  if(!source||sourceKind!=='glb'||!rightsApproved||ownerBusy)return
  setOwnerBusy(true)
  try{
   const calibrated=await saveActiveOwnerRodinHead(source)
   setOwnFile(calibrated);setAsset(null);setQA(null);setManifest(null)
   setStatus('تم حفظ نسخة رأس Rodin الأصلية المضبوطة بشكل خاص في هذا المتصفح. '+
    'ارتفاع المعاينة 34 سم افتراضي وليس قياسًا تشريحيًا؛ لا توجد حركات وجه أو خامات الصور الأصلية.')
  }catch(error){
   setStatus('لم يتم حفظ أصل Rodin: '+String(error)+
    '. هذه الخاصية تقبل فقط مجسم Rodin المحدد سابقًا، وليس أي GLB.')
  }finally{setOwnerBusy(false)}
 }
 const restoreRodin=async()=>{
  if(ownerBusy)return
  setOwnerBusy(true)
  try{
   const last=await loadActiveOwnerRodinHead()
   if(!last){setStatus('لا يوجد رأس Rodin محفوظ في هذا المتصفح.');return}
   setOwnFile(last);setAsset(null);setQA(null);setManifest(null)
   setRightsApproved(false);setTransferConsent(false);setGpuConsent(false)
   setStatus('استعدنا نسخة Rodin الخاصة. أكّد حقوقها قبل فحصها أو نقلها للأقسام.')
  }catch(error){setStatus('تعذّر استعادة المجسم: '+String(error))}
  finally{setOwnerBusy(false)}
 }
 const forgetRodin=async()=>{
  if(ownerBusy)return
  setOwnerBusy(true)
  try{
   await clearActiveOwnerRodinHead()
   setStatus('حُذفت نسخة Rodin المحفوظة من هذا المتصفح؛ الملفات على جهازك لم تتغير.')
  }catch(error){setStatus('تعذّر حذف النسخة المحلية: '+String(error))}
  finally{setOwnerBusy(false)}
 }
 const deleteSavedDraft=async()=>{
  if(busy||ownerBusy)return
  setBusy(true)
  try{
   await Promise.all([
    clearStudioFanoutManifest(),clearLocalStudioGlb(),
   ])
   setStatus('حُذفت مسودة GLB وخطة الأقسام المحفوظتان من هذا المتصفح. '+
    'لم تتغير الملفات الأصلية على جهازك.')
  }catch(error){
   setStatus('تعذّر حذف المسودة المحلية: '+String(error))
  }finally{setBusy(false)}
 }
 const toggle=(target:DirectorTarget)=>{
  setManualTargets(prev=>{
   const chosen=prev??[...detectDirectorTargets(description)]
   return chosen.includes(target)?
    chosen.filter(x=>x!==target):[...chosen,target]
  })
 }
 const commitGlb=async(file:File,gpuJobsUsed:0|1,
  sourceEngine:'existing-glb'|'ai-360-gpu'|'browser-2.5d',
  special?:{targets:DirectorTarget[];description:string;save:boolean;fromCloud?:boolean;previewTopologyBlocked?:boolean},
  gpuProfile?:ForgeGpuProfile)=>{
  const bytes=await file.arrayBuffer()
  const inspection=inspectWordGeneratedGlb(bytes,file.name)
  const checked=evaluateDirectorAsset(inspection.audit,bytes.byteLength,
   special?.targets??plan.targets)
  if(!checked.valid)throw Error('director_failed_glb_qa')
  const topologyAudit=inspectStudioGlbTopology(bytes)
  const mustRepairTopology=topologyAudit.status==='checked'&&(
   topologyAudit.nonManifoldEdges>0||
   topologyAudit.degenerateIndexTriangles>0)
  const topologyUnknown=topologyAudit.status!=='checked'
  const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))
  const hash=Array.from(digest).map(b=>b.toString(16).padStart(2,'0')).join('')
  const draft=createStudioFanoutManifest({
   fileName:file.name,sha256:hash,bytes:bytes.byteLength,
   audit:inspection.audit,description:special?.description??description,
   rights,targets:special?.targets??plan.targets,
   gpuJobsUsed,sourceEngine,gpuProfile,
   previewTopologyBlocked:special?.previewTopologyBlocked===true||mustRepairTopology,
   topologyScanUnverified:topologyUnknown,
  })
  // GPU has already been billed once the GLB exists. A full browser
  // IndexedDB quota must NOT discard an otherwise valid successful result.
  let browserSaved=false
  try{
   await saveStudioFanoutBundle(file,draft)
   browserSaved=true
  }catch{
   // Retain GLB in memory and expose "Download GLB" as an emergency path.
  }
  setAsset(file);setQA(checked);setManifest(draft);setTopology(topologyAudit)
  if(sourceEngine!=='existing-glb')onGeneratedGlb?.(file)
  setStatus((special?.fromCloud?
   'تم تنزيل مجسم Vast.ai من Cloudflare R2 الخاص، والتحقق من بصمته وحفظ نسخة معاينة محلية. '+
   'أُنشئت مسودات للأقسام الخمسة؛ لم يُنشر المجسم للجمهور. ':
   special?.save?
   'تم التحقق من بصمة المجسم المولّد على Vast.ai وحفظه كمسودة خاصة في هذا المتصفح. '+
   'تم تجهيز مخطط جميع الأقسام الخمسة؛ لا يوجد رفع جديد إلى Cloudflare R2 ولا نشر للجمهور. ':
   sourceEngine==='browser-2.5d'?
   'نجح إنشاء GLB بارز 2.5D محليًا مجانًا دون رفع الصورة. '+
   'هذا ليس نموذج وجه/جسم 360° ولا تصلح حركاته تلقائيًا. ':
   'تم حفظ مسودة إنتاج للأقسام المختارة من GLB واحد في هذا المتصفح لمدة 24 ساعة. ')+
   'تم إنشاء خطة لكل قسم، لكن Rig والحركات واختبارات Android والنشر غير مكتملة.')+
   (browserSaved?'':' تعذّر الحفظ الدائم في المتصفح؛ نزّل GLB فورًا قبل إغلاق الصفحة.')
 }
 const generate=async()=>{
  if(busy||!source||!rightsApproved||!plan.targets.length)return
  setBusy(true);setAsset(null);setQA(null);setManifest(null)
  try{
   if(sourceKind==='glb'){
    setStatus('فحص GLB الحالي دون GPU أو رفع إلى مزوّد خارجي…')
    await commitGlb(source,0,'existing-glb')
    return
   }
   if(sourceKind!=='image')throw Error('director_source_required')
   if(imageMode==='local-2.5d'){
    setStatus('إنشاء مجسم 2.5D بارز من الصورة داخل المتصفح فقط…')
    const relief=await createDirectorReliefGlb(source)
    await commitGlb(relief.file,0,'browser-2.5d')
    return
   }
   if(!health?.enabled||!health?.authConfigured)throw Error('director_gpu_or_auth_disabled')
   if(health.provider!=='vast'||health.engine!=='trellis2')
    throw Error('director_requires_operator_vast_trellis2')
   if(!gpuConsent||!transferConsent)
    throw Error('director_explicit_gpu_and_image_transfer_consent_required')
   if(source.size<128||source.size>8*1024*1024)
    throw Error('director_invalid_image_size')
   if(qualityPreference==='studio-hd'&&!health?.hdAvailable)
    throw Error('studio_hd_requires_explicit_operator_and_gpu_approval')
   const gpuPlan=planForgeGpuGeneration({description,targets:plan.targets,
    preferredProfile:qualityPreference==='auto'?undefined:qualityPreference,
   })
   setStatus('إرسال مهمة GPU آمنة إلى TRELLIS.2 على Vast.ai بملف واحد…')
   // The Arabic prompt selects private destinations and safe output profile;
   // TRELLIS.2 itself is image-conditioned, not arbitrary text/terminal control.
   const generated=await generateForgeGpuDirect(source,rights,gpuPlan.profile)
   await commitGlb(generated.file,1,'ai-360-gpu',undefined,gpuPlan.profile)
  }catch(error){
   setStatus('لم تكتمل المهمة: '+(error instanceof Error?error.message:String(error))+
    '. إذا بدأ تشغيل GPU فالمحاولة قد تُحتسب؛ لا تعاود الإرسال دون فحص الحالة.')
  }finally{setBusy(false)}
 }
 const importFirstGpuAsset=async()=>{
  // No GPU, no external network upload: verify the exact known private
  // TRELLIS.2 artifact and save one local manifest for all five studios.
  if(busy||!source||sourceKind!=='glb'||!rightsApproved)return
  setBusy(true)
  try{
   const raw=await source.arrayBuffer()
   const hash=Array.from(new Uint8Array(
    await crypto.subtle.digest('SHA-256',raw)
   )).map(byte=>byte.toString(16).padStart(2,'0')).join('')
   if(!isFirstGpuAsset(hash,raw.byteLength))
    throw Error('glb_does_not_match_vast_first_successful_asset')
   const requested=[...DIRECTOR_TARGETS]
   const firstDescription='المجسم الأول من Spaktok GPU: أفاتار، لايف، فلتر، هدية، وعالم'
   await commitGlb(source,0,'existing-glb',{
    targets:requested,description:firstDescription,save:true,
   })
   setManualTargets(requested)
   setDescription(firstDescription)
  }catch(error){
   setStatus('تعذّر استيراد مجسم GPU الأول: '+
    (error instanceof Error?error.message:String(error))+
    '. تأكد أنك اخترت ملف GLB الأصلي الذي أنشأناه على Vast.ai.')
  }finally{setBusy(false)}
 }
 const importFirstGpuFromCloud=async()=>{
  if(busy||!rightsApproved||!studioPilot.enabled)return
  const chosen=SPAKTOK_FIRST_GPU_LODS[cloudLod]
  setBusy(true)
  try{
   const permission=await fetch('/api/spaktok-studio/pilot-ticket',{
    method:'POST',credentials:'same-origin',cache:'no-store',
    headers:{'content-type':'application/json'},
    body:JSON.stringify({lod:cloudLod}),
   })
   if(!permission.ok)throw Error('cloud_pilot_ticket_'+permission.status)
   const ticket:unknown=await permission.json()
   if(!ticket||typeof ticket!=='object')throw Error('cloud_pilot_invalid_ticket')
   const t=ticket as Record<string,unknown>
   const expectedUrl='https://spaktok-private-studio-asset.spaktok.workers.dev/v1/pilot/'+cloudLod+'.glb'
   if(t.url!==expectedUrl||t.lod!==cloudLod||
      t.bytes!==chosen.bytes||t.sha256!==chosen.sha256||
      t.fileName!==chosen.fileName||
      !t.headers||typeof t.headers!=='object')
    throw Error('cloud_pilot_wrong_server_or_hash')
   const headers=t.headers as Record<string,unknown>
   const signature=headers['X-Spaktok-Studio-Signature']
   const expiry=headers['X-Spaktok-Studio-Expires']
   const owner=headers['X-Spaktok-Studio-User']
   if(typeof signature!=='string'||!/^[a-z0-9_-]{86}$/i.test(signature)||
      typeof expiry!=='string'||!/^\d{10}$/.test(expiry)||
      Number(expiry)*1000<=Date.now()||
      typeof owner!=='string'||!/^[a-f0-9-]{36}$/i.test(owner))
    throw Error('cloud_pilot_invalid_signature_grant')
   const response=await fetch(expectedUrl,{
    method:'GET',mode:'cors',credentials:'omit',cache:'no-store',
    redirect:'error',signal:AbortSignal.timeout(45000),
    headers:{
     'X-Spaktok-Studio-Signature':signature,
     'X-Spaktok-Studio-Expires':expiry,
     'X-Spaktok-Studio-User':owner,
    },
   })
   if(!response.ok)throw Error('cloud_pilot_asset_'+response.status)
   if(response.headers.get('content-type')?.split(';')[0]!=='model/gltf-binary')
    throw Error('cloud_pilot_wrong_media_type')
   const declared=Number(response.headers.get('content-length'))
   if(declared!==chosen.bytes)
    throw Error('cloud_pilot_wrong_length')
   const blob=await response.blob()
   if(blob.size!==chosen.bytes)
    throw Error('cloud_pilot_wrong_size')
   const file=new File([blob],chosen.fileName,{
    type:'model/gltf-binary',
   })
   const buf=await file.arrayBuffer()
   const digest=Array.from(new Uint8Array(
    await crypto.subtle.digest('SHA-256',buf)
   )).map(b=>b.toString(16).padStart(2,'0')).join('')
   if(digest!==chosen.sha256||buf.byteLength!==chosen.bytes)
    throw Error('cloud_pilot_lod_sha256_mismatch')
   const destinations=[...DIRECTOR_TARGETS]
   const desc='Spaktok AI: '+chosen.id+
    ' معاينة خاصة من المجسم الأول — لا يوجد Rig أو اختبار AR معتمد'
   await commitGlb(file,0,'existing-glb',{
    targets:destinations,description:desc,save:true,fromCloud:true,
    previewTopologyBlocked:chosen.nonManifoldEdges>0,
   })
   setOwnFile(file)
   setManualTargets(destinations)
   setDescription(desc)
  }catch(error){
   setStatus('استيراد R2 الخاص غير مكتمل: '+
    (error instanceof Error?error.message:String(error))+
    '. لا تعاود تشغيل GPU؛ تأكد من نشر مسار القراءة الآمن وصلاحية حسابك.')
  }finally{setBusy(false)}
 }
 const persistDraft=async()=>{
  if(!asset||!manifest||busy)return
  setBusy(true)
  try{
   await saveStudioFanoutBundle(asset,manifest)
   setStatus('تم حفظ GLB والمسودة الخاصة معًا في هذا المتصفح لمدة 24 ساعة. لا يوجد رفع إلى السحابة.')
  }catch(error){
   setStatus('تعذّر حفظ المسودة الخاصة: '+String(error))
  }finally{setBusy(false)}
 }
 const restoreDraft=async()=>{
  if(busy)return
  setBusy(true)
  try{
   const [file,saved]=await Promise.all([
    loadLocalStudioGlb(),loadStudioFanoutManifest(),
   ])
   if(!file||!saved||file.name!==saved.source.fileName||
    file.size!==saved.source.bytes)
    throw Error('لا توجد مسودة متطابقة محفوظة خلال 24 ساعة')
   const bytes=await file.arrayBuffer()
   const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))
   const hash=Array.from(digest).map(b=>b.toString(16).padStart(2,'0')).join('')
   if(hash!==saved.source.sha256)
    throw Error('بصمة الملف لا تطابق المسودة')
   const inspection=inspectWordGeneratedGlb(bytes,file.name)
   const topologyAudit=inspectStudioGlbTopology(bytes)
   const checked=evaluateDirectorAsset(
    inspection.audit,bytes.byteLength,saved.project.outputTargets)
   setOwnFile(file);setAsset(file);setQA(checked);setManifest(saved);setTopology(topologyAudit)
   setDescription(saved.project.description)
   setManualTargets([...saved.project.outputTargets])
   setRightsApproved(false);setGpuConsent(false);setTransferConsent(false)
   setStatus('استُعيد مشروعك الخاص من هذا المتصفح، دون أي GPU. '+
    'موافقات استخدام المصدر تُراجع من جديد عند بدء إنتاج جديد.')
  }catch(error){
   setStatus('تعذّرت الاستعادة: '+String(error))
  }finally{setBusy(false)}
 }
 const send=(target:DirectorTarget)=>async()=>{
  if(!asset||!manifest||!qa?.previewReady||busy||
   (topology?.status!=='checked'||
    topology.nonManifoldEdges>0||topology.degenerateIndexTriangles>0)||
   !manifest.project.outputTargets.includes(target)||
   manifest.outputs.find(out=>out.target===target)?.state!=='private-preview')return
  setBusy(true)
  try{
   await saveStudioFanoutBundle(asset,manifest)
   window.location.assign(TARGET_DESTINATIONS[target])
  }catch(error){
   setStatus('تعذّر النقل المحلي: '+String(error)+
    '. استعمل تنزيل GLB والاستيراد اليدوي.')
   setBusy(false)
  }
 }
 const downloadQualityReport=()=>{
  if(!manifest)return
  const report=buildSpaktokQualityEvidence(manifest,topology)
  const blob=new Blob([JSON.stringify(report,null,2)],{type:'application/json'})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a')
  a.href=url
  a.download='spaktok-3d-quality-evidence.json'
  a.click()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
 }
 const downloadManifest=()=>{
  if(!manifest)return
  const blob=new Blob([JSON.stringify(manifest,null,2)],{
   type:'application/json',
  })
  const u=URL.createObjectURL(blob)
  const a=document.createElement('a')
  a.href=u;a.download='spaktok-studio-production-plan.json';a.click()
  window.setTimeout(()=>URL.revokeObjectURL(u),1000)
 }
 const download=()=>{
  if(!asset)return
  const u=URL.createObjectURL(asset)
  const a=document.createElement('a')
  a.href=u;a.download=asset.name;a.click()
  window.setTimeout(()=>URL.revokeObjectURL(u),1000)
 }
 return <section id="ai-director" dir="rtl"
  className="mx-auto mb-6 max-w-7xl space-y-4 rounded-2xl border border-violet-400/40 bg-[#101b31] p-4 text-white sm:p-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <p className="text-xs font-bold tracking-widest text-violet-300">
     SPAKTOK AI DIRECTOR • V1 PRIVATE DRAFT
    </p>
    <h2 className="mt-1 text-xl font-black">صورة واحدة → خطة إنتاج لكل أقسام Spaktok</h2>
   </div>
   <button type="button" onClick={()=>setShow(x=>!x)}
    className="rounded-lg border border-white/30 px-3 py-2 text-xs">
    {show?'إخفاء الأدوات':'فتح أدوات الإنتاج'}
   </button>
  </div>
  <p className="text-xs leading-6 text-slate-300">
   يحلل طلبك لتوجيه العمل بين الأقسام، ويستخدم GLB الحالي دون GPU أو
   يرسل صورة واحدة إلى TRELLIS.2 على Vast.ai بعد تفعيل الخادم وموافقتك.
   الوصف يحدد الأقسام ونمط جودة محدودًا، وليس أمرًا عامًا للترمنال.
   لا يوجد نشر جماهيري تلقائي ولا توليد وجه متحرك دون Rig حقيقي.
  </p>
  {show&&<>
   <div className="grid gap-4 lg:grid-cols-2">
    <div className="space-y-3">
     <label className="block text-xs font-semibold">
      المصدر: صورة أو GLB موجود (يُستخدم ملف Word تلقائيًا إن وُجد)
      <input type="file"
       accept=".png,.jpg,.jpeg,.webp,.glb,image/png,image/jpeg,image/webp,model/gltf-binary"
       onChange={select}
       className="mt-2 block w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-xs"/>
     </label>
     {sourceKind==='image'&&<div className="rounded-xl border border-white/20 bg-slate-950/60 p-3 text-xs">
      <label className="block font-semibold">
       طريقة الإنشاء من الصورة
       <select value={imageMode}
        onChange={e=>{
         setImageMode(e.target.value as typeof imageMode)
         setGpuConsent(false);setTransferConsent(false)
         setAsset(null);setQA(null);setManifest(null)
        }}
        className="mt-2 block w-full rounded-lg border border-white/20 bg-slate-950 p-2">
        <option value="local-2.5d">مجاني الآن: مجسم بارز 2.5D على الهاتف</option>
        <option value="gpu-360">AI 360°: يحتاج GPU مرخصًا وموافقات</option>
       </select>
      </label>
      {imageMode==='gpu-360'&&<div className="mt-3 rounded-lg border border-violet-300/25 p-3">
      <label className="block font-semibold">
       جودة توليد TRELLIS.2 — كل اختيار مدفوع بمهمة واحدة
       <select value={qualityPreference}
        onChange={e=>{
         setQualityPreference(e.target.value as typeof qualityPreference)
         setGpuConsent(false)
        }}
        className="mt-2 block w-full rounded-lg border border-white/20 bg-slate-950 p-2">
        <option value="auto">تلقائي: 512³ للهاتف، خامات مناسبة للقسم</option>
        <option value="mobile-preview">الهاتف 512³ — 1K PBR و120 ألف وجه مستهدف</option>
        <option value="detail-preview">تفصيلي 512³ — 2K PBR و200 ألف وجه مستهدف</option>
        <option value="studio-hd" disabled={!health?.hdAvailable}>
         Studio HD 1024³ — 2K PBR و300 ألف وجه (اختباري)
        </option>
       </select>
      </label>
      <p className="mt-2 leading-5 text-amber-100">
       HD يُسمح به فقط بعد تفعيله من الخادم والمشغّل وبذاكرة GPU كافية؛
       لم نثبت بعد تفوّقه على Rodin أو صلاحيته للأفاتار المتحرك.
       قد يتطلب وقتًا أعلى ويُخصم من حصة المهمة الواحدة.
      </p>
     </div>}
     {imageMode==='local-2.5d'&&<p className="mt-2 leading-5 text-amber-200">
       هذا اختبار مجاني للخط الإنتاج فقط. يحفظ سطح الصورة وخلفية مبسطة،
       ولا يعيد بناء الرأس أو الجسم ثلاثي الأبعاد بجودة Rodin.
      </p>}
     </div>}
     {source&&<p className="break-all text-xs text-cyan-200">
      {source.name} · {(source.size/1048576).toFixed(2)} MB ·
      {sourceKind==='glb'?' إعادة استخدام دون GPU':
       imageMode==='local-2.5d'?' نمط بارز 2.5D مجاني':' يتطلب GPU لتوليد 360°'}
     </p>}
     <div className="rounded-xl border border-cyan-400/30 bg-slate-950/70 p-3 text-xs">
      <p className="font-semibold text-cyan-200">استيراد مجسم Spaktok من Cloudflare R2 الخاص</p>
      <p className="mt-2 leading-5 text-slate-200">
       توجد خمس نسخ GLB فعلية من المجسم الأول محفوظة في Cloudflare R2
       الخاص، بينها نسختان احترافيتان محافظتان أنتجناهما باستخدام gltfpack.
       يتم الاستيراد بتصريح قصير العمر والتحقق من SHA-256 دون GPU جديد.
       النسختان التجريبيتان LOD1 وLOD2 لديهما حواف غير منتظمة؛
       النسختان LOD1c وLOD2c اجتازتا فحص الحواف المفهرسة لكن لم
       تصلا إلى مستوى التخفيض المطلوب. الجميع للمراجعة الخاصة فقط،
       ولا توجد نسخة معتمدة للايف أو AR أو الهدايا المدفوعة.
      </p>
      <label className="mt-3 block text-slate-100">
       نسخة المجسم الخاصة
       <select value={cloudLod}
        disabled={busy}
        onChange={e=>setCloudLod(e.target.value as SpaktokFirstLodId)}
        className="mt-2 w-full rounded-lg border border-cyan-200/40 bg-slate-950 p-2">
        {SPAKTOK_FIRST_GPU_LOD_IDS.map(lod=>
         <option key={lod} value={lod}>
          {SPAKTOK_FIRST_GPU_LODS[lod].description}
         </option>
        )}
       </select>
      </label>
      <div className="mt-2 rounded-lg border border-indigo-300/25 bg-slate-950/50 p-2 leading-5 text-slate-200"
       role="status">
       <p>
        {SPAKTOK_FIRST_GPU_LODS[cloudLod].triangles.toLocaleString('en-US')} مثلث
        {' · '}{(SPAKTOK_FIRST_GPU_LODS[cloudLod].bytes/1_000_000).toFixed(2)} MB
        {' · '}حواف غير منتظمة بفحص الفهارس: {SPAKTOK_FIRST_GPU_LODS[cloudLod].nonManifoldEdges.toLocaleString('en-US')}
       </p>
       <p className="mt-1 text-amber-200">
        حواف بأكثر من وجهين بعد دمج مواقع الرؤوس (سماحية 10⁻⁶ من قطر المجسم):
        {' '}{SPAKTOK_FIRST_GPU_LODS[cloudLod].positionWeldedNonManifoldEdges===null?
         'لم تُفحص':SPAKTOK_FIRST_GPU_LODS[cloudLod].positionWeldedNonManifoldEdges.toLocaleString('en-US')}
        {' '}— إشارة إلى تداخلات أو فواصل خامات، وليست بالضرورة ثقوبًا أو عيوبًا مرئية.
       </p>
       <p className="mt-1 text-cyan-200">
        اختلاف مواقع الرؤوس عن الأصل:
        {' '}{SPAKTOK_FIRST_GPU_LODS[cloudLod].meanVertexDriftPercent===null?
         'لم يُقَس بعد':
         SPAKTOK_FIRST_GPU_LODS[cloudLod].meanVertexDriftPercent.toFixed(2)+'% من قطر المجسم'}
        {' '}— ليس قياسًا لجودة الصورة.
       </p>
       {SPAKTOK_FIRST_GPU_LODS[cloudLod].nonManifoldEdges>0&&
        <p className="mt-1 text-amber-200">
         مسودة فحص فقط؛ يلزم إصلاح الشبكة قبل أي استخدام مباشر.
        </p>}
       {(cloudLod==='lod1c'||cloudLod==='lod2c')&&
        <p className="mt-1 text-amber-200">
         نسخة محافظة: صفر حواف غير منتظمة حسب فحص الفهارس فقط،
         لكنها لم تحقق نسبة LOD المستهدفة. تحتاج مراجعة بصرية
         واختبار Android قبل نقلها لأي قسم.
        </p>}
      </div>
      <p role="status" className="mt-2 text-amber-200">
       {studioPilot.enabled?
        'توقيع الموقع مهيأ لحساب المالك؛ اتصال Cloudflare الفعلي لم يُختبر بعد.':
        studioPilot.reason==='pilot_sign_in_required'?
         'سجّل الدخول بحساب المشغّل لتجربة الاستيراد الخاص.':
        studioPilot.reason==='pilot_owner_only'?
         'هذا الاستيراد متاح لحساب مالك الاستوديو فقط.':
        studioPilot.reason==='pilot_operator_not_configured'?
         'الاستيراد الخاص غير مُفعّل؛ إعدادات المشغّل والتوقيع لم تكتمل.':
         'تعذّر التأكد من حالة الاستيراد الخاص حاليًا.'}
      </p>
      <button type="button" onClick={()=>void importFirstGpuFromCloud()}
       disabled={busy||!rightsApproved||!studioPilot.enabled}
       className="mt-3 w-full rounded-lg bg-violet-700 px-3 py-3 font-bold text-white disabled:opacity-40">
       استيراد LOD من R2 إلى Spaktok Studio (خاص)
      </button>
      <p className="mt-2 text-slate-400">
       يعمل هذا المسار بعد نشر Worker القراءة الموقّع وتفعيل حساب المشغّل.
      </p>
     </div>
     {sourceKind==='glb'&&<div className="rounded-xl border border-indigo-300/30 bg-indigo-950/40 p-3 text-xs">
      <p className="font-semibold text-cyan-200">استيراد أول مجسم Spaktok GPU</p>
      <p className="mt-2 leading-5 text-slate-200">
       بعد تنزيل spaktok-first.glb من Vast.ai اختره أعلاه، وأكد حقوق
       الاستخدام، ثم احفظه مرة واحدة كمسودة للأفاتار واللايف والفلاتر
       والهدايا والعالم. نفحص SHA-256 والحجم المطابقين لنتيجة GPU الناجحة.
       التخزين محلي وخاص؛ هذا ليس رفعًا إلى Cloudflare R2 أو نشرًا مباشرًا.
      </p>
      <button type="button"
       onClick={()=>void importFirstGpuAsset()}
       disabled={busy||!rightsApproved}
       className="mt-3 w-full rounded-lg bg-cyan-700 px-3 py-3 font-bold text-white disabled:opacity-40">
       استيراد مجسم Vast.ai وتجهيزه للأقسام الخمسة دون GPU
      </button>
     </div>}
     <div className="flex flex-wrap gap-2 text-xs">
      <button type="button" onClick={()=>void deleteSavedDraft()}
       disabled={busy}
       className="rounded-lg border border-rose-300/25 px-3 py-2 text-rose-200 disabled:opacity-40">
       حذف مسودة الاستوديو المحفوظة
      </button>
      <button type="button" onClick={()=>void restoreDraft()}
       disabled={busy}
       className="rounded-lg border border-emerald-400/30 px-3 py-2 text-emerald-100 disabled:opacity-40">
       استعادة مشروع الإنتاج الأخير
      </button>
      <button type="button" onClick={()=>void restoreRodin()}
       disabled={ownerBusy}
       className="rounded-lg border border-cyan-400/30 px-3 py-2 text-cyan-100 disabled:opacity-40">
       استعادة رأس Rodin المحفوظ
      </button>
      <button type="button" onClick={()=>void storeRodin()}
       disabled={ownerBusy||sourceKind!=='glb'||!rightsApproved}
       className="rounded-lg border border-violet-400/30 px-3 py-2 text-violet-100 disabled:opacity-40">
       حفظ رأس Rodin الخاص
      </button>
      <button type="button" onClick={()=>void forgetRodin()}
       disabled={ownerBusy}
       className="rounded-lg border border-white/20 px-3 py-2 text-slate-300 disabled:opacity-40">
       حذف النسخة المحلية
      </button>
     </div>
     <label className="block text-xs font-semibold">ماذا تريد من الشخصية؟
      <textarea value={description} maxLength={1000}
       onChange={e=>setDescription(e.target.value)}
       rows={3} className="mt-2 w-full rounded-xl border border-white/20 bg-slate-950 p-3 text-sm"/>
     </label>
     <div className="space-y-2">
      <p className="text-xs font-semibold">الأقسام التي تريد استخدام المجسم فيها</p>
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
       {DIRECTOR_TARGETS.map(target=><label key={target}
        className="flex items-center gap-2 rounded-lg border border-white/15 bg-slate-950/60 p-2 text-xs">
        <input type="checkbox" checked={targets.includes(target)}
         onChange={()=>toggle(target)} className="accent-violet-400"/>
        {TARGET_LABELS[target]}
       </label>)}
      </div>
      {!!detectDirectorTargets(description).length&&<button type="button"
       onClick={()=>setManualTargets(null)}
       className="text-xs text-violet-200 underline">
       إعادة اختيار الأقسام تلقائيًا من الوصف
      </button>}
     </div>
    </div>
    <div className="space-y-3">
     <div className="rounded-xl border border-white/15 bg-slate-950/60 p-3 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-2">
       <p className="font-semibold">خطة الإنتاج المبدئية</p>
       <button type="button" disabled={healthBusy||busy}
        onClick={()=>void refreshGpuHealth()}
        className="rounded-lg border border-cyan-300/40 px-3 py-1 text-cyan-100 disabled:opacity-40">
        {healthBusy?'فحص الاتصال…':'إعادة فحص اتصال GPU'}
       </button>
      </div>
      {sourceKind==='image'&&imageMode==='gpu-360'&&
       <p role="status" className="mt-2 text-amber-200">
        حالة الاتصال: {health?.authConfigured===false?
          'نظام تسجيل الدخول بقاعدة بيانات المعاينة لم يُضبط بعد؛ لا ترسل صورة مدفوعة':
         health?.readiness==='ready'?'جاهز لاختبار صورة واحدة':
         health?.readiness==='gpu_loading_or_unreachable'?
          'الخادم المحدد لا يستجيب أو ما زال يحمّل النموذج':
         'لم يكتمل إعداد خادم GPU في هذه النسخة بعد'}
       </p>}
      <p className="mt-2 text-cyan-200">
       GPU: {plan.estimatedGpuJobs} مهمة ·
       {sourceKind==='glb'?' إعادة استعمال GLB':
        imageMode==='local-2.5d'?' Forge المحلي المجاني 2.5D':
        health?.enabled&&health.authConfigured&&health.provider==='vast'&&health.engine==='trellis2'?
        ' Vast.ai TRELLIS.2 متصل':' GPU متوقف'}
      </p>
      {plan.stages.map(step=><div key={step.id}
       className="mt-2 flex items-start justify-between gap-3">
       <span>{STAGE_NAMES[step.id]}</span>
       <span className={step.status==='ready'?'text-emerald-300':
        step.status==='blocked'?'text-rose-300':'text-amber-300'}>
        {step.status==='ready'?'مبدئي':
         step.status==='blocked'?'محجوب':'يحتاج عملًا'}
       </span>
      </div>)}
     </div>
     <label className="block text-xs">صفة حقوق المصدر
      <select value={rights} onChange={e=>setRights(e.target.value as 'original'|'licensed')}
       className="mt-2 block w-full rounded-lg border border-white/20 bg-slate-950 p-2">
       <option value="original">أنشأته بنفسي وأملك حق استخدامه</option>
       <option value="licensed">أملك ترخيصًا يسمح بالتحويل والاستخدام</option>
      </select>
     </label>
     <label className="flex items-start gap-2 text-xs leading-5">
      <input type="checkbox" checked={rightsApproved}
       onChange={e=>setRightsApproved(e.target.checked)} className="mt-1"/>
      أؤكد حقوق استخدام الصورة أو GLB وتحويله إلى أصل خاص للتجربة
     </label>
     {sourceKind==='image'&&imageMode==='gpu-360'&&<div className="space-y-2 rounded-lg border border-amber-400/30 bg-amber-950/20 p-3">
      <p className="text-xs text-amber-100">
       {health?.enabled&&health.authConfigured&&health.provider==='vast'&&health.engine==='trellis2'?
        'محرك TRELLIS.2 على Vast.ai متصل؛ GPU مدفوع للمشغّل.':
        'محرك AI 360° غير متصل بعد؛ يمكن إنشاء خطة أو استيراد GLB مجاني الآن.'}
      </p>
      {health?.enabled&&health.authConfigured&&<>
       <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" checked={transferConsent}
         onChange={e=>setTransferConsent(e.target.checked)}/>
        أوافق على نقل صورتي إلى خادم GPU الخاص بالمشغّل
       </label>
       <label className="flex items-start gap-2 text-xs">
        <input type="checkbox" checked={gpuConsent}
         onChange={e=>setGpuConsent(e.target.checked)}/>
        أوافق صراحةً على استهلاك مهمة GPU واحدة من الحصة المدفوعة
       </label>
      </>}
     </div>}
     <button type="button" onClick={()=>void generate()}
      disabled={busy||!rightsApproved||!source||!plan.targets.length||
       (sourceKind==='image'&&imageMode==='gpu-360'&&
        (!health?.enabled||!health?.authConfigured||!gpuConsent||!transferConsent||
         (qualityPreference==='studio-hd'&&!health?.hdAvailable)))||
       sourceKind==='none'}
      className="w-full rounded-xl bg-violet-500 px-4 py-3 font-bold text-white disabled:opacity-40">
      {busy?'يتم العمل…':sourceKind==='glb'?
       'فحص المجسم وتجهيزه للأقسام — مجاني':
       imageMode==='local-2.5d'?
       'توليد مجسم 2.5D مجاني وتجهيزه للأقسام':
       'بدء مهمة AI 360° واحدة بعد الموافقة'}
     </button>
    </div>
   </div>
   {qa&&asset&&<div className="space-y-3 rounded-xl border border-cyan-400/25 p-3">
    <p className="font-semibold text-cyan-200">
     الملف الناتج: {asset.name} · {qa.triangles.toLocaleString()} مثلث
    </p>
    <p className="text-xs">
     {qa.previewReady?'جاهز للمعاينة التقنية الخاصة فقط':
      'يلزم تحسين الشبكة/الملف قبل تسليمه إلى معاينات الهاتف'}
     {' · '}Morph Targets: {qa.morphs}
     {' · '}صور الخامات: {qa.textureImages}
    </p>
    {topology&&<p className="rounded-lg border border-white/15 p-2 text-xs text-slate-200">
     فحص الشبكة: {topology.status==='checked'?
      `${topology.triangles.toLocaleString()} مثلث · ${topology.nonManifoldEdges.toLocaleString()} حافة غير منتظمة · ${topology.degenerateIndexTriangles.toLocaleString()} مثلث منهار · ${topology.boundaryEdges.toLocaleString()} حافة مفتوحة`:
      'لم يُفحص كامل الملف هندسيًا: '+topology.reason}
    </p>}
    <PrivateStudioGlbPreview file={asset}
     topologyWarning={manifest?.outputs.some(o=>o.state==='needs-optimization'&&
      (o.blockers.includes('non_manifold_lod_requires_professional_retopology_and_visual_qa')||
       o.blockers.includes('position_welded_edges_require_visual_surface_review')))===true}/>
    {manifest&&SPAKTOK_FIRST_GPU_LOD_IDS.map(id=>{
     const candidate=SPAKTOK_FIRST_GPU_LODS[id]
     return manifest.source.sha256===candidate.sha256&&
      <p key={id} className="rounded-lg border border-amber-300/30 p-2 text-xs text-amber-100">
       {id.toUpperCase()} · {candidate.triangles.toLocaleString()} مثلث
       {' · '}حواف حسب الفهارس: {candidate.nonManifoldEdges.toLocaleString()}
       {' · '}حواف بعد دمج المواقع: {candidate.positionWeldedNonManifoldEdges===null?
        'لم تُفحص':candidate.positionWeldedNonManifoldEdges.toLocaleString()}
       {' · '}مثلثات UV منهارة: {candidate.uvCollapsedTriangles}
       {' · '}فرق مجموع المساحة السطحية: {candidate.surfaceAreaChangePercent.toFixed(1)}%
       {' · '}فرق مجموع مساحات UV: {candidate.uvAreaSumChangePercent===null?
        'لم يُقَس بعد':candidate.uvAreaSumChangePercent.toFixed(1)+'%'}
       {' · '}هذه قياسات هندسية لا تثبت جودة العرض.
       {' · '}المجسم خاص وغير معتمد للنشر
      </p>
    })}
    <div className="flex flex-wrap gap-2">
     <button type="button" onClick={download}
      className="rounded-lg border border-white/25 px-3 py-2 text-xs">
      تنزيل GLB
     </button>
     <button type="button" disabled={!manifest}
      onClick={downloadQualityReport}
      className="rounded-lg border border-cyan-300/35 px-3 py-2 text-xs disabled:opacity-40">
      تنزيل تقرير فحص جودة 3D
     </button>
     <button type="button" disabled={!manifest}
      onClick={downloadManifest}
      className="rounded-lg border border-white/25 px-3 py-2 text-xs disabled:opacity-40">
      تنزيل خطة إنتاج الأقسام JSON
     </button>
     <button type="button" disabled={!manifest||busy}
      onClick={()=>void persistDraft()}
      className="rounded-lg border border-emerald-400/25 px-3 py-2 text-xs disabled:opacity-40">
      حفظ مسودة GLB وخطة الأقسام
     </button>
     {manifest?.project.outputTargets.map(target=><button key={target} type="button"
      disabled={!qa.previewReady||busy||!manifest||
       (topology?.status!=='checked'||
        topology.nonManifoldEdges>0||topology.degenerateIndexTriangles>0)||
       manifest.outputs.find(o=>o.target===target)?.state!=='private-preview'}
      onClick={()=>void send(target)()}
      className="rounded-lg bg-indigo-600 px-3 py-2 text-xs disabled:opacity-40">
      معاينة {TARGET_LABELS[target]}
     </button>)}
    </div>
    {manifest&&<div className="grid gap-2 sm:grid-cols-2">
     {manifest.outputs.map(output=><div key={output.target}
      className="rounded-lg border border-white/15 bg-slate-950/50 p-3 text-xs">
      <p className="font-semibold text-cyan-200">
       {TARGET_LABELS[output.target]}
      </p>
      <p className="mt-1 text-slate-300">
       {output.state==='private-preview'?
        'مسودة معاينة قابلة للنقل · غير منشورة':
        'يلزم تخفيف/إصلاح GLB قبل نقلها للمعاينة'}
      </p>
      <p className="mt-1 text-amber-200">
       {output.rigNeeded?'Rig · ':''}
       {output.animationNeeded?'Animation · ':''}
       {output.cameraTrackingNeeded?'Camera QA · ':''}
       {output.collisionNeeded?'Collision · ':''}
       Android QA · مراجعة النشر
      </p>
     </div>)}
    </div>}
    {!!qa.issues.length&&<div className="text-xs leading-6 text-amber-100">
     <p className="font-semibold">ما ينقص قبل الاستخدام أمام الجمهور:</p>
     <p>{qa.issues.map(issue=>ISSUE_AR[issue]??issue).join(' · ')}</p>
    </div>}
   </div>}
   {!!status&&<p role="status" className="text-xs leading-6 text-cyan-100">{status}</p>}
   <p className="text-[11px] leading-5 text-slate-400">
    ملفات النقل المؤقت محفوظة في IndexedDB داخل هذا المتصفح، لا تُنشَر في
    Spaktok ولا تُزامَن مع تطبيق Android. لا تشارك الجهاز قبل حذف النسخ المحلية.
    النشر والهدايا المدفوعة وAgora live تحتاج تكاملًا ومراجعة مستقلين.
   </p>
  </>}
 </section>
}
