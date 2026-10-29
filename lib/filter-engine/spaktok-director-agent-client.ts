'use client'
import {
 agentStepSchema,validateAgentStep,type AgentEvent,type AgentRequest,
} from './spaktok-director-agent-contract'
import {evaluateDirectorAsset,type DirectorTarget,type DirectorAssetQA} from './spaktok-ai-director'
import {createDirectorReliefGlb} from './spaktok-director-local-relief'
import {generateForgeGpuDirect} from './spaktok-forge-direct-client'
import {styleDirectorGlb,detectDirectorMaterialStyle} from './spaktok-director-chat-material'
import {inspectWordGeneratedGlb} from './spaktok-word-import'
import {createStudioFanoutManifest,type StudioFanoutManifest} from './spaktok-studio-fanout'
import {createDirectorDispatch,type DirectorDispatch} from './spaktok-director-dispatch'
import {saveStudioFanoutBundle,loadVerifiedDirectorHandoff} from './reality-local-asset-handoff'
import {verifiedDirectorReply} from './spaktok-director-verified-reply'

export type AgentAssetResult=Readonly<{
 file:File;qa:DirectorAssetQA;manifest:StudioFanoutManifest
 dispatch:DirectorDispatch
 sourceEngine:'existing-glb'|'ai-360-gpu'|'browser-2.5d'
}>
export type AgentRunResult=Readonly<{
 reply:string
 result:AgentAssetResult|null
 actions:readonly AgentEvent[]
}>
type Params=Readonly<{
 prompt:string
 history:readonly {role:'user'|'assistant';text:string}[]
 source:File|null
 rights:'original'|'licensed'
 rightsApproved:boolean
 visionConsent:boolean
 gpuAvailable:boolean
 gpuTransferConsent:boolean
 gpuComputeConsent:boolean
 onProgress:(text:string)=>void
}>
const MAX_STEPS=6
const isGlb=(f:File)=>/\.glb$/i.test(f.name)
const isImage=(f:File)=>/\.(jpe?g|png|webp)$/i.test(f.name)
const safeError=(value:unknown)=>value instanceof Error?value.message:String(value)
/** Reduces photo to a capped image before passing it to a multimodal LLM.
 * Only called on explicit creator consent; 360 GPU source remains separate.
 */
async function optionalVisionPreview(file:File,consent:boolean):Promise<string|null>{
 if(!consent||!isImage(file)||typeof createImageBitmap!=='function')return null
 let image:ImageBitmap|null=null
 try{
  image=await createImageBitmap(file)
  const scale=Math.min(1,320/Math.max(image.width,image.height))
  const canvas=document.createElement('canvas')
  canvas.width=Math.max(1,Math.round(image.width*scale))
  canvas.height=Math.max(1,Math.round(image.height*scale))
  const context=canvas.getContext('2d')
  if(!context)return null
  context.drawImage(image,0,0,canvas.width,canvas.height)
  const jpeg=canvas.toDataURL('image/jpeg',0.65)
  return jpeg.length<=220000?jpeg:null
 }catch{return null}
 finally{image?.close()}
}
async function callAgent(payload:AgentRequest){
 const response=await fetch('/api/studio/director/agent/step',{
  method:'POST',headers:{'content-type':'application/json'},
  credentials:'same-origin',cache:'no-store',
  body:JSON.stringify(payload),
  signal:AbortSignal.timeout(19000),
 })
 const data=await response.json().catch(()=>({error:'agent_invalid_response'})) as {
  step?:unknown;error?:string;reason?:string
 }
 if(!response.ok||!data.step)
  throw Error('تعذر تشغيل وكيل AI: '+(data.reason||data.error||response.status))
 const parsed=agentStepSchema.parse(data.step)
 const policy=validateAgentStep(parsed,payload)
 if(!policy.ok)throw Error('تم منع أمر غير مصرح به: '+policy.reason)
 return parsed
}
async function inspect(file:File){
 if(!isGlb(file)||file.size>15*1024*1024)throw Error('invalid_glb_size')
 const audit=inspectWordGeneratedGlb(await file.arrayBuffer(),file.name).audit
 if(!audit.valid||!audit.selfContained)throw Error('invalid_or_external_glb')
 return audit
}
/** Bounded REAL planner -> tool -> observation -> model loop.
 * Browser executes only enumerated operations, no eval, arbitrary URLs,
 * auto publishing, spending without consent, or user-written code.
 */
export async function runDirectorAgent(params:Params):Promise<AgentRunResult>{
 if(!params.rightsApproved&&params.source)
  throw Error('يجب تأكيد حقوق استخدام الملف أولًا')
 const original=params.source
 let working=original
 let engine:AgentAssetResult['sourceEngine']='existing-glb'
 let delivered:AgentAssetResult|null=null
 let usedGpu=false
 let lastInspection=false
 const events:AgentEvent[]=[]
 const vision=original?await optionalVisionPreview(original,params.visionConsent):null
 const originalSource=original?(isGlb(original)?'glb':isImage(original)?'image':'none'):'none'
 for(let index=0;index<MAX_STEPS;index++){
  const workingSource=working?(isGlb(working)?'glb':isImage(working)?'image':'none'):'none'
  const request:AgentRequest={
   prompt:params.prompt.slice(0,1000),originalSource,workingSource,
   history:params.history.slice(-8).map(m=>({
    role:m.role,text:m.text.slice(0,350),
   })),
   steps:events.map(x=>({...x,detail:x.detail.slice(0,300)})),
   imagePreview:index===0?vision:null,
  }
  params.onProgress('AI Director: أفكر في الخطوة '+(index+1)+'، بعد فحص نتائج الأدوات الحقيقية…')
  const step=await callAgent(request)
  if(step.action==='finish'){
   if(!delivered&&working&&isGlb(working)&&events.some(x=>x.action==='dispatch_asset'&&x.ok))
    throw Error('agent_inconsistent_completion')
   // Never show the model's unverified "success" message as a result.
   // Only actual audited GLB + dispatch observations are completion proof.
   return {reply:verifiedDirectorReply(delivered,events),
    result:delivered,actions:events}
  }
  const event=(ok:boolean,detail:string)=>{
   events.push({action:step.action,ok,detail:detail.slice(0,300)})
  }
  try{
   if(step.action==='inspect_asset'){
    if(!working||!isGlb(working))throw Error('GLB_required')
    params.onProgress('أفحص هندسة GLB وخاماته وأبعاده فعليًا…')
    const a=await inspect(working)
    lastInspection=true
    event(true,'GLB inspected: triangles='+a.triangles+', textures='+a.textures+
     ', UV='+a.hasUV+', normals='+a.hasNormals+', PBR='+a.hasPBR+
     ', animations='+a.animations+', morphs='+a.rigTargets)
   }else if(step.action==='generate_relief'){
    if(!working||!isImage(working)||working!==original)throw Error('image_required')
    params.onProgress('أستخدم محرك Spaktok Forge لإنشاء شبكة 2.5D حقيقية على جهازك…')
    const made=await createDirectorReliefGlb(working)
    working=made.file;engine='browser-2.5d';lastInspection=false
    event(true,'2.5D GLB created locally: bytes='+working.size+'; not 360-degree reconstruction')
   }else if(step.action==='generate_3d_gpu'){
    if(usedGpu||!working||!isImage(working)||working!==original)
     throw Error('paid_gpu_run_not_allowed')
    if(!params.gpuAvailable||!params.gpuTransferConsent||!params.gpuComputeConsent)
     return {reply:'لإنشاء 3D كامل أحتاج GPU متصلًا وموافقتك المنفصلة على نقل الصورة وتكلفة مهمة واحدة. لم أرسل المهمة ولم أستبدلها بمجسم 2.5D.',result:null,actions:events}
    usedGpu=true // never retry charged reservations, even on thrown network error
    params.onProgress('أشغّل محرك TRELLIS الحقيقي بمهمة واحدة بعد موافقتك…')
    const made=await generateForgeGpuDirect(working,params.rights)
    working=made.file;engine='ai-360-gpu';lastInspection=false
    event(true,'Real GPU generated GLB: bytes='+working.size+'; needs actual audit')
   }else if(step.action==='recolor_asset'){
    if(!working||!isGlb(working))throw Error('GLB_required')
    const explicit=detectDirectorMaterialStyle(params.prompt)
    if(!explicit||explicit.id!==step.color)throw Error('material_not_in_creator_request')
    params.onProgress('أغيّر خامة PBR فعليًا وأصدر GLB جديدًا…')
    const updated=await styleDirectorGlb(working,explicit)
    working=updated;lastInspection=false
    event(true,'Real GLB PBR material updated: '+explicit.id+', bytes='+working.size)
   }else if(step.action==='dispatch_asset'){
    if(!working||!isGlb(working))throw Error('GLB_required')
    if(!lastInspection)throw Error('inspect_glb_before_dispatch')
    if(!step.targets.length)throw Error('missing_destinations')
    params.onProgress('أتحقق من SHA-256 وأوزع المجسم على الأقسام الخاصة المطلوبة…')
    const bytes=await working.arrayBuffer()
    const inspected=inspectWordGeneratedGlb(bytes,working.name)
    const qa=evaluateDirectorAsset(inspected.audit,bytes.byteLength,step.targets)
    if(!qa.valid||!qa.previewReady)throw Error('mobile_qa_prevents_dispatch')
    const hashBytes=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))
    const sha=Array.from(hashBytes).map(x=>x.toString(16).padStart(2,'0')).join('')
    const manifest=createStudioFanoutManifest({
     fileName:working.name,sha256:sha,bytes:working.size,
     audit:inspected.audit,description:params.prompt,rights:params.rights,
     targets:step.targets as DirectorTarget[],
     gpuJobsUsed:usedGpu?1:0,sourceEngine:engine,
    })
    await saveStudioFanoutBundle(working,manifest)
    const verified=await loadVerifiedDirectorHandoff(step.targets[0])
    if(!verified||verified.manifest.source.sha256!==sha)
     throw Error('handoff_integrity_failed')
    delivered={file:working,qa,manifest,
     dispatch:createDirectorDispatch(manifest),sourceEngine:engine}
    event(true,'PRIVATE preview handed to '+step.targets.join(',')+
     '; SHA256 verified; no rigging/live/AR/animation/publishing executed')
   }
  }catch(error){
   event(false,safeError(error))
   params.onProgress('تعطّل تنفيذ أداة '+step.action+': '+safeError(error))
   // Don't retry external charges/failed tools. Give model one chance to
   // explain the real error and finish, but never repeat the exact same tool.
   if(usedGpu||events.filter(e=>e.action===step.action).length>1)
    return {reply:'لم تكتمل الأداة: '+safeError(error)+
     '؛ لم أعد تشغيل المهمة المدفوعة تلقائيًا.',result:delivered,actions:events}
  }
 }
 return {
  reply:verifiedDirectorReply(delivered,events)+
   ' (توقفت دورة AI عند الحد الأقصى المسموح به: ست قرارات.)',
  result:delivered,actions:events,
 }
}
