'use client'
import {useEffect,useMemo,useRef,useState} from 'react'
import type {StudioProductionPackage} from '@/lib/filter-engine/reality-production-pipeline'
import {auditStudioGlbBytes,type StudioGlbAudit} from '@/lib/filter-engine/reality-production-glb-audit'
import {
 buildSpaktokWordPlan,executeWordParallelChecks,
 type WordLocalCheck,type WordCheckKey,
} from '@/lib/filter-engine/spaktok-word'

const states:Readonly<Record<string,string>>={
 ready:'جاهز بنيويًا',waiting:'بانتظار أصل',blocked:'محجوب',external:'مزوّد خارجي',manual:'مراجعة مطلوبة',
}
const stateClass:Readonly<Record<string,string>>={
 ready:'border-emerald-400/30 bg-emerald-400/10 text-emerald-200',
 waiting:'border-slate-600 bg-slate-950/50 text-slate-300',
 blocked:'border-rose-400/30 bg-rose-900/10 text-rose-200',
 external:'border-violet-400/30 bg-violet-900/20 text-violet-200',
 manual:'border-amber-400/25 bg-amber-400/5 text-amber-200',
}
export default function SpaktokWordConsole({
 project,sourceFile,onGlbAudit,
}:Readonly<{
 project:StudioProductionPackage
 sourceFile:File|null
 onGlbAudit?:(audit:StudioGlbAudit)=>void
}>){
 const plan=useMemo(()=>buildSpaktokWordPlan(project),[project])
 const [checks,setChecks]=useState<WordLocalCheck[]>([])
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const runRef=useRef(0)
 useEffect(()=>{
  runRef.current+=1
  setChecks([])
  setBusy(false)
  setMessage('')
 },[sourceFile])
 const runChecks=async()=>{
  if(!sourceFile||busy)return
  const file=sourceFile
  const seq=++runRef.current
  setBusy(true);setChecks([]);setMessage('تُنفَّذ فحوص الملف المستقلة بالتوازي داخل متصفحك…')
  const isGlb=/\.glb$/i.test(file.name)
  const isImage=/\.(png|jpe?g|webp)$/i.test(file.name)
  const bytes=file.arrayBuffer()
  const jobs:{
   id:WordCheckKey;label:string;run:()=>Promise<string>
  }[]=[
   {id:'metadata',label:'فحص المصدر والحدود',run:async()=>{
    if(file.size<1||file.size>35*1024*1024)
     throw Error('الملف فارغ أو أكبر من الحد المحلي 35MB')
    if(!/\.(png|jpe?g|webp|glb|obj)$/i.test(file.name))
     throw Error('الامتداد غير مدعوم')
    const header=new Uint8Array(await file.slice(0,16).arrayBuffer())
    if(isGlb&&new DataView(header.buffer).getUint32(0,true)!==0x46546c67)
     throw Error('توقيع GLB غير صحيح')
    if(isImage&&file.type&&!file.type.startsWith('image/'))
     throw Error('ملف الصورة لا يطابق نوع MIME')
    return `${file.name} · ${(file.size/1024/1024).toFixed(2)}MB · محلي`
   }},
   {id:'sha256',label:'بصمة الملف SHA-256',run:async()=>{
    if(!crypto?.subtle)throw Error('SHA-256 يتطلب متصفح HTTPS آمنًا')
    const hash=await crypto.subtle.digest('SHA-256',await bytes)
    return Array.from(new Uint8Array(hash)).map(n=>n.toString(16).padStart(2,'0')).join('').slice(0,20)+'… (بصمة محلية)'
   }},
  ]
  if(isGlb)jobs.push({
   id:'geometry',label:'المجسم والخامات والـ Rig',run:async()=>{
    const audit=auditStudioGlbBytes(await bytes)
    if(seq===runRef.current)onGlbAudit?.(audit)
    if(!audit.valid)throw Error('GLB غير صالح بنيويًا: '+audit.warnings.join('، '))
    return `${audit.triangles.toLocaleString('en-US')} مثلث · ${audit.materials} خامة · PBR ${audit.hasPBR?'✓':'✕'} · Morph ${audit.rigTargets} · UV ${audit.hasUV?'✓':'✕'}`
   },
  })
  if(isImage)jobs.push({
   id:'image',label:'أبعاد الصورة القابلة للتوليد',run:async()=>{
    if(typeof createImageBitmap!=='function')
     throw Error('المتصفح لا يدعم قراءة أبعاد الصورة محليًا')
    const bitmap=await createImageBitmap(file)
    try{
     if(bitmap.width<128||bitmap.height<128)
      throw Error('الدقة منخفضة جدًا للتوليد، اختر مرجعًا أوضح')
     return `${bitmap.width} × ${bitmap.height} بكسل، جاهزة للمراجعة لا لاستخراج مجسم تلقائي`
    }finally{bitmap.close()}
   },
  })
  await executeWordParallelChecks(jobs,result=>{
   if(seq!==runRef.current)return
   setChecks(prev=>[...prev.filter(x=>x.id!==result.id),result])
  })
  if(seq===runRef.current){
   setBusy(false)
   setMessage('انتهت فحوص المتصفح. العمل على Rodin أو GPU لم يبدأ؛ راجع حالة مراحل الإنتاج أدناه.')
  }
 }
 return <section id="spaktok-word" dir="rtl"
  className="space-y-4 rounded-2xl border border-violet-400/35 bg-[#0d1126] p-4 text-white shadow-2xl sm:p-6">
  <header className="flex flex-wrap items-center justify-between gap-4">
   <div className="space-y-1">
    <p className="text-xs font-bold uppercase tracking-widest text-violet-300">Spaktok Word • Production Control Plane V1</p>
    <h2 className="text-2xl font-extrabold sm:text-3xl">Spaktok Word — مركز تنسيق جميع محركات الاستوديو</h2>
    <p className="max-w-3xl text-sm leading-7 text-slate-300">
     نظام واحد يربط مصدر الصورة وRodin والشبكة والخامات والتحريك والموضع والكاميرا والفيديو واللايف.
     يعرض الاعتماد بين المراحل ويشغّل الفحوص المحلية المستقلة بالتوازي، دون ادعاء تشغيل GPU خارجي تلقائي.
    </p>
   </div>
   <div className="rounded-xl bg-violet-900/30 px-4 py-3 text-center">
    <p className="text-xl font-bold text-cyan-200">{plan.readyCount}/{plan.lanes.length}</p>
    <p className="text-[11px] text-slate-300">مراحل جاهزة بنيويًا</p>
   </div>
  </header>
  <div className="flex flex-wrap gap-2 text-xs">
   <span className="rounded-lg bg-slate-800 px-3 py-2">1. الأصل + الحقوق</span>
   <span className="rounded-lg bg-violet-900/50 px-3 py-2">2. Rodin / Geometry</span>
   <span className="rounded-lg bg-cyan-900/40 px-3 py-2">3. خامات + Rig + معايرة</span>
   <span className="rounded-lg bg-slate-800 px-3 py-2">4. كاميرا + فيديو + لايف</span>
  </div>
  <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
   {plan.lanes.map(lane=><article key={lane.id}
    className="rounded-xl border border-white/10 bg-white/[.035] p-3">
    <div className="flex flex-wrap items-center justify-between gap-2">
     <h3 className="text-sm font-bold">{lane.name}</h3>
     <span className={'rounded-lg border px-2 py-1 text-[11px] '+stateClass[lane.status]}>
      {states[lane.status]}</span>
    </div>
    <p className="mt-2 min-h-12 text-xs leading-6 text-slate-300">{lane.reason}</p>
    <div className="mt-2 flex flex-wrap items-center justify-between gap-2">
     <span className="text-[10px] text-slate-500">
      {lane.dependencies.length?'يعتمد على: '+lane.dependencies.join('، '):'مستقل'}
     </span>
     {lane.href&&<a href={lane.href}
       target={lane.href.startsWith('https:')?'_blank':undefined}
       rel={lane.href.startsWith('https:')?'noopener noreferrer':undefined}
       className="text-xs font-semibold text-cyan-300 underline">فتح القسم</a>}
    </div>
   </article>)}
  </div>
  <div className="rounded-xl border border-emerald-400/20 bg-slate-950/70 p-4">
   <div className="flex flex-wrap items-center justify-between gap-2">
    <div>
     <h3 className="text-sm font-bold">الفحص المتوازي الحقيقي للملف</h3>
     <p className="mt-1 text-xs leading-6 text-slate-400">
      فحوص مستقلة ومتزامنة: توقيع المصدر والحجم، SHA-256، الهندسة أو أبعاد الصورة.
      لا تنشر الملف ولا تنقله للخارج.
     </p>
    </div>
    <button type="button" disabled={!sourceFile||busy} onClick={runChecks}
     className="rounded-lg bg-cyan-500 px-4 py-3 text-xs font-bold text-slate-950 disabled:opacity-40">
     {busy?'جارٍ الفحص…':'فحص الأعمال بالتوازي'}
    </button>
   </div>
   {checks.length>0&&<div className="mt-3 grid gap-2 sm:grid-cols-2">
    {checks.map(c=><div key={c.id}
     className={'rounded-lg border px-3 py-2 text-xs '+(c.status==='passed'?
      'border-emerald-600/40 bg-emerald-900/10':'border-rose-600/40 bg-rose-900/10')}>
     <p className="font-semibold">{c.status==='passed'?'✓':'✕'} {c.label}</p>
     <p className="mt-1 break-all leading-5 text-slate-300">{c.detail}</p>
    </div>)}
   </div>}
   {message&&<p role="status" className="mt-3 text-xs text-cyan-200">{message}</p>}
  </div>
  <footer className="flex flex-wrap gap-2 border-t border-white/10 pt-3 text-xs text-slate-300">
   <a href="/avatar-studio" className="rounded-lg border border-white/20 px-3 py-2">Avatar Studio</a>
   <a href="/video-studio" className="rounded-lg border border-white/20 px-3 py-2">Video 3D</a>
   <a href="/live-studio-preview" className="rounded-lg border border-white/20 px-3 py-2">Local Live</a>
   <a href="/reality-studio" className="rounded-lg border border-white/20 px-3 py-2">Reality Studio</a>
   <p className="w-full text-[11px] text-amber-200">
    لا توليد Rodin مدفوعًا ولا تصدير للأفاتار تلقائيًا ولا بث للجمهور بعد. اعتماد الحقوق
    والمطابقة الفنية وRig والاختبارات شرط للنشر.
   </p>
  </footer>
 </section>
}
