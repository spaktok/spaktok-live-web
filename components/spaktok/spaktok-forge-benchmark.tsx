'use client'

import {useEffect,useState,type ChangeEvent} from 'react'
import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {auditStudioGlbBytes} from '@/lib/filter-engine/reality-production-glb-audit'
import {repairForgeGlbNormals} from '@/lib/filter-engine/spaktok-forge-normals-repair'
import {
 summarizeForgeCandidate,compareForgeManualRatings,
 FORGE_BENCHMARK_PREVIEW_MAX_BYTES,
 type ForgeCandidate,type ForgeManualReview,type ForgeTechnicalSnapshot,
} from '@/lib/filter-engine/spaktok-forge-benchmark'

const EMPTY_REVIEW:ForgeManualReview={
 frontAppearance:null,backGeometry:null,
 textureQuality:null,geometryQuality:null,
}
const criteria:ReadonlyArray<Readonly<{
 key:keyof ForgeManualReview;label:string
}>>=[
 {key:'frontAppearance',label:'مطابقة الصورة الأمامية'},
 {key:'backGeometry',label:'شكل الظهر والجوانب عند الدوران'},
 {key:'textureQuality',label:'جودة الخامات والتفاصيل'},
 {key:'geometryQuality',label:'سلامة النحت والشبكة'},
]
type State=Readonly<{
 file:File|null;stats:ForgeTechnicalSnapshot|null
 error:string
}>
type RepairedAsset=Readonly<{
 file:File;stats:ForgeTechnicalSnapshot;repairedMeshes:number
}>
function Preview3D({file}:Readonly<{file:File|null}>){
 const [canvas,setCanvas]=useState<HTMLCanvasElement|null>(null)
 const [message,setMessage]=useState('لا يوجد مجسم للمعاينة')
 useEffect(()=>{
  if(!file||!canvas)return
  if(file.size>FORGE_BENCHMARK_PREVIEW_MAX_BYTES){
   setMessage('حجم المجسم أكبر من حد المعاينة 15MB');return
  }
  let cancelled=false,raf=0,loaded:THREE.Object3D|null=null
  let renderer:THREE.WebGLRenderer
  try{
   renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'})
  }catch{setMessage('WebGL غير متاح');return}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5))
  renderer.setSize(Math.max(1,canvas.clientWidth),
   Math.max(1,canvas.clientHeight),false)
  renderer.outputColorSpace=THREE.SRGBColorSpace
  const scene=new THREE.Scene()
  scene.background=new THREE.Color('#141b2b')
  scene.add(new THREE.HemisphereLight('#ffffff','#455c75',2))
  const fill=new THREE.DirectionalLight('#ffffff',2)
  fill.position.set(3,4,4);scene.add(fill)
  const camera=new THREE.PerspectiveCamera(34,1,.01,1000)
  const resize=()=>{
   const width=Math.max(1,canvas.clientWidth)
   const height=Math.max(1,canvas.clientHeight)
   renderer.setSize(width,height,false)
   camera.aspect=width/height
   camera.updateProjectionMatrix()
  }
  const observer=new ResizeObserver(resize)
  observer.observe(canvas);resize()
  let last=0
  const draw=(time:number)=>{
   if(cancelled)return
   if(!document.hidden&&time-last>=1000/18){
    if(loaded)loaded.rotation.y+=.012
    renderer.render(scene,camera)
    last=time
   }
   raf=requestAnimationFrame(draw)
  }
  raf=requestAnimationFrame(draw)
  setMessage('تحميل المجسم للمعاينة المحلية…')
  ;(async()=>{
   try{
    const buffer=await file.arrayBuffer()
    const audit=auditStudioGlbBytes(buffer)
    if(!audit.valid||!audit.selfContained)
     throw Error('المجسم غير صالح للفحص ثلاثي الأبعاد')
    const parsed=await new GLTFLoader().parseAsync(buffer,'')
    if(cancelled)return
    const root=parsed.scene
    const box=new THREE.Box3().setFromObject(root)
    const size=new THREE.Vector3(),center=new THREE.Vector3()
    box.getSize(size);box.getCenter(center)
    const longest=Math.max(size.x,size.y,size.z)
    if(box.isEmpty()||longest<1e-5)throw Error('أبعاد المجسم غير صالحة')
    root.position.sub(center)
    root.scale.setScalar(2.4/longest)
    scene.add(root);loaded=root
    camera.position.set(0,0,5.6)
    camera.lookAt(0,0,0)
    setMessage('معاينة GLB محلية — يدور ببطء لإظهار الجهات')
   }catch(err){
    if(!cancelled)setMessage(err instanceof Error?err.message:'فشل عرض GLB')
   }
  })()
  return()=>{
   cancelled=true;cancelAnimationFrame(raf);observer.disconnect()
   if(loaded){
    const meshes=new Set<THREE.BufferGeometry>()
    const materials=new Set<THREE.Material>()
    const textures=new Set<THREE.Texture>()
    loaded.traverse(child=>{
     if(!(child instanceof THREE.Mesh))return
     meshes.add(child.geometry)
     for(const material of (Array.isArray(child.material)?child.material:[child.material])){
      materials.add(material)
      for(const value of Object.values(material))
       if(value instanceof THREE.Texture)textures.add(value)
     }
    })
    meshes.forEach(x=>x.dispose())
    materials.forEach(x=>x.dispose())
    textures.forEach(x=>x.dispose())
   }
   renderer.dispose()
  }
 },[file,canvas])
 return <div className="space-y-2">
  <canvas ref={setCanvas} className="h-52 w-full rounded-xl bg-slate-950"
   aria-label="معاينة تفاعلية دائرية للمجسم"/>
  <p className="text-[11px] text-slate-400">{message}</p>
 </div>
}
const fmt=(x:number)=>x.toLocaleString('en-US')
function auditFile(file:File,engine:ForgeCandidate):Promise<ForgeTechnicalSnapshot>{
 if(!/\.glb$/i.test(file.name)||file.size<28||
  file.size>35*1024*1024)throw Error('اختر GLB لا يزيد عن 35MB')
 return file.arrayBuffer().then(bytes=>
  summarizeForgeCandidate(engine,bytes.byteLength,auditStudioGlbBytes(bytes)))
}
export default function SpaktokForgeBenchmark({
 onRepairedGlb,
}:Readonly<{onRepairedGlb?:(file:File)=>void}>){
 const [open,setOpen]=useState(false)
 const [repairBusy,setRepairBusy]=useState<ForgeCandidate|null>(null)
 const [repaired,setRepaired]=useState<Record<ForgeCandidate,RepairedAsset|null>>({
  rodin:null,forge:null,
 })
 const [repairMessages,setRepairMessages]=useState<Record<ForgeCandidate,string>>({
  rodin:'',forge:'',
 })
 const [rodin,setRodin]=useState<State>({file:null,stats:null,error:''})
 const [forge,setForge]=useState<State>({file:null,stats:null,error:''})
 const [rReview,setRReview]=useState<ForgeManualReview>(EMPTY_REVIEW)
 const [fReview,setFReview]=useState<ForgeManualReview>(EMPTY_REVIEW)
 const setFile=(engine:ForgeCandidate,event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0]??null
  event.target.value=''
  const update=engine==='rodin'?setRodin:setForge
  update({file,stats:null,error:file?'جارٍ فحص GLB…':''})
  setRepaired(prev=>({...prev,[engine]:null}))
  setRepairMessages(prev=>({...prev,[engine]:''}))
  if(engine==='rodin')setRReview(EMPTY_REVIEW)
  else setFReview(EMPTY_REVIEW)
  if(!file)return
  auditFile(file,engine).then(stats=>
   update(s=>s.file===file?{file,stats,error:''}:s)
  ).catch(error=>
   update(s=>s.file===file?{file,stats:null,
    error:error instanceof Error?error.message:'فشل فحص GLB'}:s))
 }
 const repairNormals=async(engine:ForgeCandidate)=>{
  const source=engine==='rodin'?rodin:forge
  if(repairBusy||!source.file||!source.stats||source.stats.normals)return
  setRepairBusy(engine)
  setRepairMessages(prev=>({...prev,
   [engine]:'يجري إنشاء نسخة GLB جديدة وإعادة فحص Normals محليًا…'}))
  try{
   if(source.file.size>FORGE_BENCHMARK_PREVIEW_MAX_BYTES)
    throw Error('حجم المجسم يتجاوز حد الإصلاح المحلي 15MB')
   const before=await source.file.arrayBuffer()
   const result=await repairForgeGlbNormals(before)
   if(result.alreadyComplete)throw Error('Normals موجودة بالفعل')
   const name=source.file.name.replace(/\.glb$/i,'-normals-fixed.glb')
   const next=new File([result.bytes],name,{type:'model/gltf-binary'})
   const stats=summarizeForgeCandidate(engine,next.size,result.after)
   setRepaired(prev=>({...prev,[engine]:{
    file:next,stats,repairedMeshes:result.repairedMeshes,
   }}))
   setRepairMessages(prev=>({...prev,[engine]:
    'تم إصلاح '+result.repairedMeshes+' شبكة وإعادة فحص GLB. '+
    'النسخة الأصلية محفوظة. افحص الإضاءة والخامات بصريًا قبل الاستخدام.'}))
  }catch(error){
   setRepaired(prev=>({...prev,[engine]:null}))
   setRepairMessages(prev=>({...prev,[engine]:
    'لم يُطبَّق الإصلاح: '+(
     error instanceof Error?error.message:'خطأ غير معروف')+
    '. الملفات المتحركة تتطلب أداة نحت متخصصة.'}))
  }finally{setRepairBusy(null)}
 }
 const downloadRepair=(engine:ForgeCandidate)=>{
  const asset=repaired[engine]
  if(!asset)return
  const url=URL.createObjectURL(asset.file)
  const a=document.createElement('a')
  a.href=url;a.download=asset.file.name;a.click()
  window.setTimeout(()=>URL.revokeObjectURL(url),1500)
 }
 const verdict=compareForgeManualRatings(rReview,fReview)
 const exportEvidence=()=>{
  if(!rodin.stats||!forge.stats)return
  const record={
   format:'SpaktokForgeBenchmark',version:1,
   createdAt:new Date().toISOString(),
   note:'Single-rater subjective comparison; not proof of model superiority or live readiness',
   rodin:rodin.stats,forge:forge.stats,
   human:{rodin:rReview,forge:fReview,verdict},
  }
  const blob=new Blob([JSON.stringify(record,null,2)],
   {type:'application/json'})
  const url=URL.createObjectURL(blob)
  const a=document.createElement('a')
  a.href=url;a.download='spaktok-forge-benchmark.json';a.click()
  window.setTimeout(()=>URL.revokeObjectURL(url),1500)
 }
 return <section dir="rtl"
  className="mx-auto mb-6 max-w-7xl space-y-4 rounded-2xl border border-white/15 bg-[#121a2b] p-4 text-white">
  <div className="flex flex-wrap justify-between gap-3">
   <div>
    <p className="text-xs font-bold text-violet-200">FORGE QUALITY LAB</p>
    <h2 className="mt-1 text-lg font-semibold">مقارنة Rodin وSpaktok Forge بالملفات الحقيقية</h2>
   </div>
   <button type="button" onClick={()=>setOpen(x=>!x)}
    className="rounded-xl border border-violet-400/40 px-4 py-2 text-xs text-violet-200">
    {open?'إغلاق المقارنة':'فتح مقارنة 3D'}
   </button>
  </div>
  <p className="text-xs leading-6 text-slate-300">
   استخدم ملف GLB من كل مولّد لنفس الصورة. نحسب الشبكة والخامات وحجم الهاتف
   محليًا، ثم تقيّم أنت الوجه الأمامي والخلفي. الاختبارات التقنية وحدها لا
   تثبت التفوق البصري.
  </p>
  {open&&<>
   <div className="grid gap-4 md:grid-cols-2">
    {([
     ['rodin','Rodin',rodin] as const,
     ['forge','Spaktok Forge',forge] as const,
    ]).map(([engine,label,state])=><div key={engine}
     className="space-y-3 rounded-xl border border-white/15 bg-slate-950/50 p-3">
     <h3 className="font-semibold">{label}</h3>
     <input type="file" accept=".glb,model/gltf-binary"
      onChange={e=>setFile(engine,e)}
      className="block w-full text-xs" aria-label={'تحميل GLB من '+label}/>
     {state.file&&<p className="break-all text-[11px] text-slate-400">
      {state.file.name}
     </p>}
     {state.error&&<p role="status" className="text-xs text-amber-300">
      {state.error}
     </p>}
     {state.stats&&<Preview3D file={state.file}/>}
     {state.stats&&!state.stats.normals&&
      <div className="space-y-2 rounded-xl border border-cyan-400/25 bg-cyan-950/15 p-3">
       <p className="text-xs font-semibold text-cyan-200">
        إصلاح Normals في GLB — دون إعادة التوليد
       </p>
       <p className="text-[11px] leading-5 text-slate-300">
        يولّد اتجاهات إضاءة جديدة من المثلثات الموجودة. لا يصلح التشريح
        أو يضيف حركات الوجه. يرفض المجسمات ذات Rig أو Animation للحفاظ عليها.
       </p>
       <button type="button"
        disabled={repairBusy!==null||state.file===null||
         state.file.size>FORGE_BENCHMARK_PREVIEW_MAX_BYTES}
        onClick={()=>void repairNormals(engine)}
        className="rounded-lg bg-cyan-600 px-3 py-2 text-xs font-semibold disabled:opacity-40">
        {repairBusy===engine?'إصلاح Normals جارٍ…':'إصلاح Normals وإعادة الفحص'}
       </button>
       {repaired[engine]&&<div className="space-y-2 text-xs">
        <p className="text-emerald-200">
         أُصلحت {repaired[engine].repairedMeshes} شبكة ·
         Normals: {repaired[engine].stats.normals?'موجودة':'ناقصة'} ·
         حجم النسخة {(repaired[engine].stats.bytes/1048576).toFixed(2)} MB ·
         {repaired[engine].stats.readyForMobilePreview?
          'اجتازت شروط الفحص التقني للهاتف':'يلزم تحسين إضافي قبل الهاتف'}
        </p>
        <div className="flex flex-wrap gap-2">
         <button type="button" onClick={()=>downloadRepair(engine)}
          className="rounded-lg border border-white/30 px-3 py-2">
          تنزيل GLB المصحح
         </button>
         {onRepairedGlb&&
          <button type="button"
           onClick={()=>onRepairedGlb(repaired[engine]!.file)}
           className="rounded-lg bg-violet-600 px-3 py-2">
           فتح النسخة في Spaktok Word
          </button>}
        </div>
       </div>}
       {repairMessages[engine]&&<p role="status"
        className="text-[11px] leading-5 text-amber-200">
        {repairMessages[engine]}
       </p>}
      </div>}
     {state.stats&&<div className="space-y-1 text-xs text-slate-200">
      <p>المثلثات: {fmt(state.stats.triangles)} · الخامات: {fmt(state.stats.materials)}</p>
      <p>الصور المضمّنة: {fmt(state.stats.textures)} · قنوات Rig: {fmt(state.stats.morphs)}</p>
      <p>الحجم: {(state.stats.bytes/1048576).toFixed(2)} MB</p>
      <p>{state.stats.readyForMobilePreview?
       'مناسب لشروط الفحص الأولي للهاتف، وليس معتمدًا للأداء':
       'يتطلب مراجعة تقنية أو تحسينًا قبل تجربة الهاتف'}</p>
      {!!state.stats.warnings.length&&<p className="text-amber-300">
       التحذيرات: {state.stats.warnings.join(' · ')}
      </p>}
     </div>}
     {state.stats&&criteria.map(({key,label:criterion})=>{
      const review=engine==='rodin'?rReview:fReview
      const set=engine==='rodin'?setRReview:setFReview
      return <label key={key} className="block text-xs">
       {criterion}
       <select value={review[key]??''}
        onChange={e=>set(prev=>({...prev,
         [key]:e.target.value?Number(e.target.value):null}))}
        className="mt-1 block w-full rounded-lg border border-white/20 bg-slate-900 p-2">
        <option value="">لم أقيّم بعد</option>
        {[1,2,3,4,5].map(n=><option key={n} value={n}>{n} / 5</option>)}
       </select>
      </label>
     })}
    </div>)}
   </div>
   {rodin.stats&&forge.stats&&<div className="space-y-2 text-xs">
    <p className="text-slate-200">
     {verdict==='unrated'?'أكمل التقييمات الأربعة لكلا النموذجين لمقارنة الشكل.':
      verdict==='tie'?'تقييمك الشخصي متعادل بين النموذجين.':
      verdict==='forge-better'?'حسب تقييمك الشخصي في هذه العينة، Forge أعلى.':
      'حسب تقييمك الشخصي في هذه العينة، Rodin أعلى.'}
    </p>
    <button type="button" onClick={exportEvidence}
     className="rounded-lg bg-violet-600 px-3 py-2 font-semibold">
     تنزيل تقرير المقارنة JSON
    </button>
   </div>}
  </>}
  <p className="text-[11px] text-slate-400">
   المقارنة تعمل داخل متصفحك؛ لا تُرفع ملفات GLB إلى خادم. التقييم الشخصي
   لا يمثل اختبارًا علميًا شاملًا ولا يتضمن بعد قياس FPS أو تكلفة GPU الفعلية.
  </p>
 </section>
}
