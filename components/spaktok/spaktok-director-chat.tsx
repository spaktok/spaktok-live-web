'use client'
import {useEffect,useMemo,useRef,useState,type ChangeEvent} from 'react'
import {
 Cpu,ImagePlus,Send,Download,CheckCircle2,AlertTriangle,
 Sparkles,WandSparkles,Layers3,ShieldCheck,Loader2,
 ChevronRight,MessageSquareText,Camera,Box as BoxIcon,
} from 'lucide-react'
import {createDirectorReliefGlb} from '@/lib/filter-engine/spaktok-director-local-relief'
import {generateForgeGpuDirect} from '@/lib/filter-engine/spaktok-forge-direct-client'
import {inspectWordGeneratedGlb} from '@/lib/filter-engine/spaktok-word-import'
import {
 createStudioFanoutManifest,type StudioFanoutManifest,
} from '@/lib/filter-engine/spaktok-studio-fanout'
import {createDirectorDispatch,type DirectorDispatch} from '@/lib/filter-engine/spaktok-director-dispatch'
import {saveStudioFanoutBundle,loadVerifiedDirectorHandoff} from '@/lib/filter-engine/reality-local-asset-handoff'
import {
 evaluateDirectorAsset,DIRECTOR_TARGETS,type DirectorAssetQA,type DirectorTarget,
} from '@/lib/filter-engine/spaktok-ai-director'
import {
 routeDirectorChat,directorChatReplyForTargets,
 explainUnfinishedSpecialists,requiresSeparatePublishingReview,
} from '@/lib/filter-engine/spaktok-director-chat-router'
import DirectorChatGlbViewer from './studio/director-chat-glb-viewer'
import StudioPrivateCloudPanel from './studio/studio-private-cloud-panel'

type Result=Readonly<{
 file:File;manifest:StudioFanoutManifest;dispatch:DirectorDispatch
 qa:DirectorAssetQA;sourceEngine:'existing-glb'|'ai-360-gpu'|'browser-2.5d'
}>
type ChatMessage=Readonly<{
 id:string;role:'assistant'|'user';text:string
 fileName?:string;result?:Result;state?:'thinking'|'error'|'done'
}>
type SourceFile=File|null
const SUGGESTIONS=[
 'حوّل صورتي إلى أفاتار ثلاثي الأبعاد',
 'جهّز هذه الهدية لـ Spaktok Live',
 'اصنع مجسم ديكور للعالم من الصورة',
 'أرسل GLB إلى جميع الأقسام',
]
const TARGET_LABELS:Readonly<Record<DirectorTarget,string>>={
 avatar:'Avatar',live:'Live',filter:'AR Filters',
 gift:'Gifts',world:'Spaktok World',video:'Video 3D',
}
const GLB=/\.glb$/i,IMAGE=/\.(png|jpe?g|webp)$/i
const canRead=(file:File)=>GLB.test(file.name)||IMAGE.test(file.name)
const friendlyError=(error:unknown)=>error instanceof Error?error.message:String(error)
const download=(file:File)=>{
 const url=URL.createObjectURL(file)
 const element=document.createElement('a')
 element.href=url;element.download=file.name;element.click()
 window.setTimeout(()=>URL.revokeObjectURL(url),1000)
}
const manifestDownload=(manifest:StudioFanoutManifest)=>{
 download(new File([JSON.stringify(manifest,null,2)],
  'spaktok-director-private-plan.json',{type:'application/json'}))
}
const initial:ChatMessage[]=[
 {id:'welcome',role:'assistant',state:'done',
  text:'مرحبًا بك في Spaktok AI Director. ارفع صورة أو ملف GLB، وقل لي النتيجة المطلوبة. سأختار المحركات الداخلية وأنفّذ ما هو متاح، ثم أعرض المجسم والتقرير هنا مباشرة. لا تحتاج إلى فتح أقسام المنصة يدويًا.'},
]
/** Chat-first studio. The LLM/text router never gets source pixels.
 * The actual result comes ONLY from real local GLB/relief or approved GPU.
 * All specialty departments receive an audited private draft, not an
 * invented animation, facial rig, filter APK, public gift or live stream.
 */
export default function SpaktokDirectorChat({sourceFile=null,onGeneratedGlb}:Readonly<{
 sourceFile?:SourceFile;onGeneratedGlb?:(file:File)=>void
}>){
 const [messages,setMessages]=useState<ChatMessage[]>(initial)
 const [text,setText]=useState('')
 const [selected,setSelected]=useState<SourceFile>(null)
 const [lastInput,setLastInput]=useState<SourceFile>(null)
 const [lastResult,setLastResult]=useState<Result|null>(null)
 const [rightsApproved,setRightsApproved]=useState(false)
 const [rights,setRights]=useState<'original'|'licensed'>('original')
 const [transferApproved,setTransferApproved]=useState(false)
 const [computeApproved,setComputeApproved]=useState(false)
 const [gpuEnabled,setGpuEnabled]=useState(false)
 const [busy,setBusy]=useState(false)
 const [imagePreview,setImagePreview]=useState('')
 const fileRef=useRef<HTMLInputElement|null>(null)
 const listEndRef=useRef<HTMLDivElement|null>(null)
 const currentFile=selected??lastInput??sourceFile??lastResult?.file??null
 const sourceKind=currentFile?
  (GLB.test(currentFile.name)?'glb':IMAGE.test(currentFile.name)?'image':'none'):'none'
 const draftIntent=useMemo(()=>routeDirectorChat(text,sourceKind),[text,sourceKind])
 useEffect(()=>{
  let live=true
  fetch('/api/spaktok-forge/gpu-ticket',{cache:'no-store'})
   .then(res=>res.ok?res.json():Promise.reject(Error('gpu_offline')))
   .then(data=>{if(live)setGpuEnabled(data.enabled===true)})
   .catch(()=>{if(live)setGpuEnabled(false)})
  return()=>{live=false}
 },[])
 useEffect(()=>{
  // Only the attached photograph is displayed as thumbnail. Never send it
  // to an image generation service without explicit GPU transfer consent.
  const photo=selected&&IMAGE.test(selected.name)?selected:null
  if(!photo){setImagePreview('');return}
  const url=URL.createObjectURL(photo)
  setImagePreview(url)
  return()=>URL.revokeObjectURL(url)
 },[selected])
 useEffect(()=>{
  listEndRef.current?.scrollIntoView({behavior:'smooth',block:'end'})
 },[messages,busy])
 useEffect(()=>{
  if(sourceFile){
   setSelected(sourceFile)
   setRightsApproved(false)
   setTransferApproved(false)
   setComputeApproved(false)
  }
 },[sourceFile])
 const attach=(event:ChangeEvent<HTMLInputElement>)=>{
  const candidate=event.target.files?.[0]??null
  event.target.value=''
  if(!candidate)return
  if(!canRead(candidate)||candidate.size<128||
     candidate.size>(IMAGE.test(candidate.name)?8:15)*1024*1024){
   setMessages(prev=>[...prev,{id:crypto.randomUUID(),role:'assistant',state:'error',
    text:'الملف غير مدعوم. اختر PNG/JPG/WEBP حتى 8MB أو GLB حتى 15MB.'}])
   return
  }
  setSelected(candidate);setLastInput(candidate)
  setRightsApproved(false);setTransferApproved(false);setComputeApproved(false)
 }
 const patch=(id:string,fields:Partial<ChatMessage>)=>
  setMessages(prev=>prev.map(m=>m.id===id?{...m,...fields}:m))
 const deliver=async(file:File,originalPrompt:string,targets:readonly DirectorTarget[],
   engine:Result['sourceEngine']):Promise<Result>=>{
  const bytes=await file.arrayBuffer()
  const inspected=inspectWordGeneratedGlb(bytes,file.name)
  const qa=evaluateDirectorAsset(inspected.audit,file.size,targets)
  if(!qa.valid)throw Error('المجسم الناتج لم يجتز فحص سلامة GLB.')
  const sha=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))
  const sha256=Array.from(sha).map(x=>x.toString(16).padStart(2,'0')).join('')
  const manifest=createStudioFanoutManifest({
   fileName:file.name,sha256,bytes:file.size,
   audit:inspected.audit,description:originalPrompt,rights,targets,
   gpuJobsUsed:engine==='ai-360-gpu'?1:0,sourceEngine:engine,
  })
  const dispatch=createDirectorDispatch(manifest)
  if(manifest.outputs.every(o=>o.state==='private-preview')){
   // One atomic local asset+manifest; six specialists can consume the same
   // verified source, and no additional GPU calls are needed.
   await saveStudioFanoutBundle(file,manifest)
   const verified=await loadVerifiedDirectorHandoff(targets[0])
   if(!verified||verified.manifest.source.sha256!==sha256)
    throw Error('تعذر التحقق من حفظ المسودة الخاصة؛ لم تُسلّم للأقسام.')
  }
  return {file,manifest,dispatch,qa,sourceEngine:engine}
 }
 const send=async(override?:string)=>{
  const prompt=(override??text).trim()
  if(busy||!prompt)return
  const uploaded=selected
  const file=uploaded??lastResult?.file??lastInput??sourceFile
  const kind=file?(GLB.test(file.name)?'glb':IMAGE.test(file.name)?'image':'none'):'none'
  let intent=routeDirectorChat(prompt,kind)
  let semanticSummary=''
  const userId=crypto.randomUUID()
  const assistantId=crypto.randomUUID()
  setMessages(prev=>[...prev,
   {id:userId,role:'user',text:prompt,fileName:uploaded?.name},
   {id:assistantId,role:'assistant',state:'thinking',
    text:'أفهم طلبك وأجهّز المحرك المناسب…'}])
  setText('');setBusy(true)
  try{
   // The optional private LLM classifies ONLY the command text. Source
   // images/models are NEVER sent to it. If it is offline, the deterministic
   // local routing logic is immediately available, with no paid retry.
   if(prompt.length>=2){
    try{
     const response=await fetch('/api/studio/director/interpret',{
      method:'POST',cache:'no-store',credentials:'same-origin',
      headers:{'content-type':'application/json'},
      body:JSON.stringify({prompt,source:kind}),
      signal:AbortSignal.timeout(8000),
     })
     if(response.ok){
      const data=await response.json() as {
       interpretation?:{targets?:unknown;intentSummary?:string}
      }
      const targets=data.interpretation?.targets
      if(Array.isArray(targets)&&targets.length>=1&&targets.length<=6&&
       targets.every(t=>typeof t==='string'&&
        DIRECTOR_TARGETS.includes(t as DirectorTarget))){
       // An explicit all-studios instruction cannot be silently narrowed.
       const explicitAll=/جميع\\s+(?:الأقسام|الاقسام)|all\\s+studios/i.test(prompt)
       if(!explicitAll){
        intent={...intent,targets:[...new Set(targets as DirectorTarget[])]}
       }
       semanticSummary=typeof data.interpretation?.intentSummary==='string'?
        data.interpretation.intentSummary.slice(0,250):''
      }
     }
    }catch{
     // No local file or rights state is changed when the AI parser is offline.
    }
   }
   if(kind==='none'||!file){
    patch(assistantId,{text:intent.explanation,state:'done'})
    return
   }
   if(!rightsApproved){
    patch(assistantId,{text:'قبل معالجة الملف، فعّل تأكيد حقوق المصدر أسفل الدردشة، ثم أعد إرسال الطلب. لن تُرفع الصورة أو يُشغّل GPU.',state:'error'})
    return
   }
   if(!intent.targets.length)throw Error('لم أجد قسمًا يمكن توجيه الطلب إليه.')
   let generated:File
   let engine:Result['sourceEngine']
   if(kind==='glb'){
    // A real CPU/browser GLB material editor is available for static props.
    // Other requested operations remain specialist preview tasks.
    const {detectDirectorMaterialStyle,styleDirectorGlb}=await import(
     '@/lib/filter-engine/spaktok-director-chat-material')
    const style=detectDirectorMaterialStyle(prompt)
    if(style){
     patch(assistantId,{text:'أطبّق خامة '+style.label+
      ' فعليًا على الأسطح ثلاثية الأبعاد، وأتحقق من التصدير…'})
     generated=await styleDirectorGlb(file,style)
    }else{
     generated=file
     patch(assistantId,{text:'أتحقق من الشبكة وUV والخامة وبصمة GLB ثم أعدّ النتائج داخل الدردشة…'})
    }
    engine='existing-glb'
   }else if(intent.execution==='local-relief'){
    patch(assistantId,{text:'أنشئ نموذج 2.5D بارزًا على جهازك؛ لا أرسل الصورة إلى أي خادم…'})
    const result=await createDirectorReliefGlb(file)
    generated=result.file;engine='browser-2.5d'
   }else{
    if(!gpuEnabled){
     patch(assistantId,{state:'done',text:
      'فهمت طلبك: '+directorChatReplyForTargets(intent.targets)+
      '. لإنشاء مجسم حقيقي 360° من الصورة أحتاج إلى تشغيل GPU الخاص بـSpaktok. هو غير متصل حاليًا، لذلك لم أزعم إنشاء شخصية أو هدية 3D. يمكن كتابة «اصنع مجسمًا بارزًا 2.5D» لتجربة محلية محدودة، أو إعادة الطلب بعد تشغيل GPU.'})
     return
    }
    if(!transferApproved||!computeApproved){
     patch(assistantId,{state:'done',text:
      'المحرك المناسب هو TRELLIS على GPU. يتطلب تنفيذ المهمة موافقتك على إرسال الصورة إلى خادم GPU وعلى استهلاك مهمة مدفوعة واحدة. فعّل الموافقتين الظاهرتين أسفل الدردشة ثم أعد إرسال الطلب؛ لم تُنفّذ أي مهمة مدفوعة.'})
     return
    }
    patch(assistantId,{text:'أرسلت مهمة GPU واحدة بعد الموافقة؛ أتحقق من GLB وأوزعه بعد اكتمال التوليد…'})
    const result=await generateForgeGpuDirect(file,rights)
    generated=result.file;engine='ai-360-gpu'
    setComputeApproved(false);setTransferApproved(false)
   }
   const result=await deliver(generated,prompt,intent.targets,engine)
   setLastResult(result)
   setLastInput(null)
   setSelected(null)
   onGeneratedGlb?.(generated)
   const staged=result.manifest.outputs.every(o=>o.state==='private-preview')
   const heads=directorChatReplyForTargets(intent.targets)
   const extra=requiresSeparatePublishingReview(prompt)?
    ' طلبت النشر، لكن النشر العام يحتاج موافقة ومراجعة منفصلتين ولم يُنفّذ.':''
   patch(assistantId,{state:'done',result,text:
    'أنجزت '+(engine==='existing-glb'?(generated===file?'فحص GLB الموجود':'تعديل الخامة على GLB فعلي') :engine==='browser-2.5d'?
     'إنشاء نسخة بارزة 2.5D':'التوليد الحقيقي على GPU')+
    '، وحصلت على '+result.qa.triangles.toLocaleString('en-US')+
    ' مثلث. '+(staged?
     'جهزت ملفًا خاصًا واحدًا للأقسام: '+heads+'.':
     'لا يمكن تسليم الملف تلقائيًا للمعاينات حتى يحقق حدود الهاتف؛ التفاصيل بالأسفل.')+
    ' يمكنك تدوير النتيجة هنا وتنزيلها؛ Rig والتتبّع والحركات والبث أو التصادمات ما زالت مهام فنية غير مكتملة.'+
    (semanticSummary?'\\nتفسير الطلب: '+semanticSummary:'')+extra})
  }catch(error){
   patch(assistantId,{state:'error',text:'تعذر إكمال هذه المهمة: '+
    friendlyError(error)+'. لم يُنشَر أي أصل. إذا أُرسلت مهمة GPU فلا أكررها تلقائيًا.'})
  }finally{setBusy(false)}
 }
 return <div dir="rtl" className="relative mx-auto min-h-[calc(100vh-3rem)] max-w-6xl overflow-hidden rounded-[30px] border border-white/10 bg-[#080d19] text-white shadow-[0_28px_100px_rgba(0,0,0,.45)]">
  <div className="pointer-events-none absolute -right-40 -top-40 h-96 w-96 rounded-full bg-indigo-500/15 blur-[110px]"/>
  <div className="pointer-events-none absolute -bottom-40 left-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-[100px]"/>
  <header className="relative flex flex-wrap items-center justify-between gap-4 border-b border-white/10 bg-white/[.025] px-5 py-5 sm:px-8">
   <div className="flex items-center gap-3">
    <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gradient-to-br from-indigo-500 via-violet-600 to-sky-500 shadow-lg shadow-indigo-600/20">
     <Sparkles size={24}/>
    </div>
    <div>
     <p className="text-[11px] font-bold uppercase tracking-[.24em] text-sky-300">SPAKTOK INTELLIGENCE • STUDIO</p>
     <h1 className="text-xl font-bold tracking-tight sm:text-2xl">AI Director <span className="font-normal text-slate-400">/ Creative Engine</span></h1>
    </div>
   </div>
   <div className="flex items-center gap-2 rounded-full border border-emerald-400/20 bg-emerald-400/[.06] px-3 py-1.5 text-[11px] text-emerald-300">
    <span className="h-2 w-2 rounded-full bg-emerald-400"/>
    {gpuEnabled?'GPU متصل · مهام باشتراك':'المحركات المحلية جاهزة · GPU غير متصل'}
   </div>
  </header>
  <div className="relative grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_225px]">
   <div className="flex min-w-0 flex-col">
    <main aria-label="محادثة Spaktok AI Director" className="max-h-[68vh] min-h-[380px] space-y-5 overflow-y-auto px-4 py-7 sm:px-8">
     {messages.map(message=><div key={message.id} className={'flex '+(message.role==='user'?'justify-start':'justify-end')}>
      <div className={'max-w-[96%] min-w-0 space-y-3 rounded-[22px] p-4 text-sm leading-7 sm:max-w-[91%] sm:p-5 '+
       (message.role==='user'?'border border-indigo-400/20 bg-indigo-500/15':
        'border border-white/10 bg-white/[.045]')}>
       <div className="flex items-center gap-2 text-[11px] font-bold text-slate-300">
        {message.role==='assistant'?<WandSparkles size={15} className="text-sky-300"/>:
         <MessageSquareText size={15} className="text-indigo-300"/>}
        {message.role==='assistant'?'Spaktok AI Director':'أنت'}
        {message.state==='thinking'&&<Loader2 size={14} className="animate-spin text-sky-300"/>}
       </div>
       <p className="whitespace-pre-wrap break-words text-slate-100">{message.text}</p>
       {message.fileName&&<p className="flex items-center gap-2 rounded-lg border border-white/10 bg-black/20 px-3 py-1 text-xs text-sky-200">
        <ImagePlus size={14}/><span className="break-all">{message.fileName}</span></p>}
       {message.result&&<div className="space-y-3">
        <DirectorChatGlbViewer file={message.result.file}/>
        <div className="flex flex-wrap items-center justify-between gap-3">
         <div className="flex items-center gap-2 text-xs text-emerald-300">
          <CheckCircle2 size={17}/> GLB حقيقي · {(message.result.file.size/1048576).toFixed(2)} MiB
         </div>
         <div className="flex flex-wrap gap-2">
          <button type="button" onClick={()=>download(message.result!.file)}
           className="flex items-center gap-2 rounded-xl bg-indigo-500 px-3 py-2 text-xs font-bold hover:bg-indigo-400">
           <Download size={15}/> تنزيل GLB
          </button>
          <button type="button" onClick={()=>manifestDownload(message.result!.manifest)}
           className="rounded-xl border border-white/20 px-3 py-2 text-xs hover:bg-white/10">
           تنزيل خطة المحركات
          </button>
         </div>
        </div>
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
         {message.result.dispatch.steps.map(step=><div key={step.target}
          className="rounded-xl border border-white/10 bg-[#0b1528] p-3">
          <div className="mb-1 flex items-center justify-between gap-2">
           <strong className="text-xs text-sky-200">{TARGET_LABELS[step.target]}</strong>
           <span className={'text-[10px] '+(step.status==='private-preview-staged'?'text-emerald-300':'text-amber-300')}>
            {step.status==='private-preview-staged'?'ملف معاينة جاهز':'يحتاج تحسين GLB'}
           </span>
          </div>
          <p className="text-[11px] leading-5 text-slate-400">{explainUnfinishedSpecialists(step.target)}</p>
         </div>)}
        </div>
        {message.result.sourceEngine==='browser-2.5d'&&
         <p className="flex gap-2 rounded-lg border border-amber-400/20 bg-amber-950/20 p-2 text-xs text-amber-200">
          <AlertTriangle size={15} className="mt-1 shrink-0"/> هذه معاينة بارزة 2.5D وليست إعادة بناء خلفية للصورة أو وجهًا متحركًا.
         </p>}
       </div>}
      </div>
     </div>)}
     <div ref={listEndRef}/>
    </main>
    {messages.length<3&&<div className="flex flex-wrap gap-2 px-4 pb-3 sm:px-8">
     {SUGGESTIONS.map(prompt=><button key={prompt} type="button" disabled={busy}
      onClick={()=>{setText(prompt)}} className="rounded-full border border-indigo-300/15 bg-white/5 px-3 py-2 text-xs text-slate-300 transition hover:border-indigo-400/40 hover:text-white">
      {prompt}
     </button>)}
    </div>}
    <footer className="relative space-y-3 border-t border-white/10 bg-[#0b1221] p-4 sm:p-6">
     {selected&&<div className="flex items-center justify-between gap-3 rounded-xl border border-sky-500/25 bg-sky-500/10 px-3 py-2 text-xs">
      <div className="flex min-w-0 items-center gap-3">
       {imagePreview?<img src={imagePreview} alt="الصورة المرفقة" className="h-12 w-12 rounded-lg object-cover"/>:
        <BoxIcon size={24} className="text-sky-300"/>}
       <span className="truncate">{selected.name} · {(selected.size/1048576).toFixed(2)} MiB</span>
      </div>
      <button type="button" aria-label="إزالة الملف" onClick={()=>{setSelected(null);setLastInput(null);setRightsApproved(false)}} className="rounded-lg px-2 py-1 hover:bg-white/10">×</button>
     </div>}
     <div className="flex items-end gap-2 rounded-2xl border border-white/15 bg-[#131d30] p-2 focus-within:border-indigo-400/70">
      <input ref={fileRef} type="file" accept=".png,.jpg,.jpeg,.webp,.glb,image/png,image/jpeg,image/webp,model/gltf-binary"
       onChange={attach} className="sr-only" aria-label="إرفاق صورة أو مجسم"/>
      <button type="button" onClick={()=>fileRef.current?.click()} disabled={busy}
       title="إرفاق صورة أو ملف GLB" aria-label="إرفاق صورة أو مجسم"
       className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl text-sky-300 transition hover:bg-white/10 disabled:opacity-50">
       <ImagePlus size={22}/>
      </button>
      <textarea aria-label="اكتب أمرًا إلى Spaktok AI Director" rows={2} maxLength={1000}
       value={text} onChange={e=>setText(e.target.value)}
       onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();void send()}}}
       placeholder="مثال: حوّل هذه الصورة إلى عنصر للعالم مع نسخة للهدية والفلاتر…"
       className="max-h-36 min-h-11 flex-1 resize-y bg-transparent px-2 py-2 text-sm text-white outline-none placeholder:text-slate-500"/>
      <button type="button" disabled={busy||!text.trim()} onClick={()=>void send()}
       aria-label="إرسال الأمر"
       className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-indigo-500 to-sky-500 text-white shadow-lg shadow-indigo-500/20 disabled:cursor-not-allowed disabled:opacity-40">
       {busy?<Loader2 size={20} className="animate-spin"/>:<Send size={20}/>}
      </button>
     </div>
     <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-300">
      <label className="flex cursor-pointer items-center gap-2">
       <input type="checkbox" checked={rightsApproved} onChange={e=>setRightsApproved(e.target.checked)}
        className="accent-indigo-400"/>
       أؤكد حقوق استخدام الصورة أو المجسم
      </label>
      <select value={rights} onChange={e=>{setRights(e.target.value as typeof rights);setRightsApproved(false)}}
       aria-label="نوع حقوق المصدر" className="rounded-lg border border-white/15 bg-[#131d30] px-2 py-1 text-xs">
       <option value="original">ملكي الأصلي</option><option value="licensed">لدي ترخيص</option>
      </select>
     </div>
     {(draftIntent.needsPaidCompute&&sourceKind==='image'&&gpuEnabled)&&
      <div className="flex flex-wrap gap-4 text-[11px] text-amber-100">
       <label className="flex items-center gap-2"><input type="checkbox" checked={transferApproved} onChange={e=>setTransferApproved(e.target.checked)}/> أوافق على إرسال الصورة إلى GPU</label>
       <label className="flex items-center gap-2"><input type="checkbox" checked={computeApproved} onChange={e=>setComputeApproved(e.target.checked)}/> أوافق على تكلفة مهمة GPU واحدة</label>
      </div>}
     <p className="text-[10px] leading-5 text-slate-500">
      المخرجات خاصة وغير منشورة. لا تُحلَّل محتويات الصور في نموذج لغوي؛ تُستخدم الصورة فقط في محرك التوليد الذي وافقت عليه. لا يُعاد تشغيل GPU تلقائيًا.
     </p>
    </footer>
   </div>
   <aside className="hidden border-r border-white/10 bg-white/[.025] p-5 lg:block">
    <p className="mb-4 text-xs font-bold tracking-wider text-slate-300">المحركات الداخلية</p>
    <div className="space-y-2">
     {(Object.keys(TARGET_LABELS) as DirectorTarget[]).map(target=><div key={target}
      className="flex items-center justify-between rounded-xl border border-white/[.06] bg-white/[.035] px-3 py-3 text-xs">
      <div className="flex items-center gap-2"><Layers3 size={15} className="text-indigo-300"/>{TARGET_LABELS[target]}</div>
      <ChevronRight size={13} className="rotate-180 text-slate-500"/>
     </div>)}
    </div>
    <div className="mt-6 space-y-2 rounded-xl border border-sky-300/10 bg-sky-400/5 p-3 text-[11px] leading-5 text-slate-300">
     <ShieldCheck size={18} className="text-sky-300"/>
     <p>الأقسام تعمل كمحركات خلف الدردشة. النشر والمدفوعات والبث الحقيقي تتطلب موافقات واختبارات إضافية.</p>
    </div>
   </aside>
  </div>
  {lastResult&&<div className="border-t border-white/10 px-4 py-3 sm:px-8">
   <StudioPrivateCloudPanel asset={lastResult.file} manifest={lastResult.manifest}
    rightsApproved={rightsApproved}
    onRestore={(file,targets)=>{
     setSelected(file);setLastInput(file);setLastResult(null)
     setRightsApproved(false);setTransferApproved(false);setComputeApproved(false)
     setText('أعد فحص هذا المجسم ووزعه على '+targets.map(x=>TARGET_LABELS[x]).join(' و '))
    }}/>
  </div>}
 </div>
}
