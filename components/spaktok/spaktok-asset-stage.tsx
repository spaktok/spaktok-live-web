'use client'
import {useEffect,useRef,useState,type ChangeEvent} from 'react'
import Link from 'next/link'
import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {loadLocalStudioGlb,loadStudioFanoutManifest} from '@/lib/filter-engine/reality-local-asset-handoff'
import type {StudioFanoutManifest} from '@/lib/filter-engine/spaktok-studio-fanout'
import {assertSelfContainedVideo3DGlb} from '@/lib/filter-engine/reality-video3d-project'
import {auditStudioGlbBytes} from '@/lib/filter-engine/reality-production-glb-audit'

type StageKind='gift'|'world'
function free(root:THREE.Object3D){
 const geometries=new Set<THREE.BufferGeometry>()
 const materials=new Set<THREE.Material>()
 const textures=new Set<THREE.Texture>()
 root.traverse(node=>{
  if(!(node instanceof THREE.Mesh))return
  geometries.add(node.geometry)
  for(const material of Array.isArray(node.material)?node.material:[node.material]){
   materials.add(material)
   for(const val of Object.values(material))
    if(val instanceof THREE.Texture)textures.add(val)
  }
 })
 geometries.forEach(x=>x.dispose())
 materials.forEach(x=>x.dispose())
 textures.forEach(x=>x.dispose())
}
export default function SpaktokAssetStage({
 kind,
}:Readonly<{kind:StageKind}>){
 const canvasRef=useRef<HTMLCanvasElement|null>(null)
 const modelRef=useRef<THREE.Object3D|null>(null)
 const sceneRef=useRef<THREE.Scene|null>(null)
 const orbitRef=useRef<OrbitControls|null>(null)
 const [file,setFile]=useState<File|null>(null)
 const [status,setStatus]=useState('استورد آخر GLB من AI Director، أو اختر ملفًا محليًا.')
 const [scale,setScale]=useState(1)
 const [stats,setStats]=useState('')
 const [running,setRunning]=useState(false)
 const [activePlan,setActivePlan]=useState<StudioFanoutManifest|null>(null)
 const [fingerprint,setFingerprint]=useState('')
 const [motion,setMotion]=useState<'none'|'spin'|'float'>('none')
 const motionRef=useRef<'none'|'spin'|'float'>('none')
 const [position,setPosition]=useState<readonly [number,number,number]>([0,0,0])
 const positionRef=useRef<readonly [number,number,number]>([0,0,0])
 const isWorld=kind==='world'
 const title=isWorld?'Spaktok World — 3D Preview':'Spaktok Gift Studio — 3D Preview'
 useEffect(()=>{
  const canvas=canvasRef.current
  if(!canvas)return
  let renderer:THREE.WebGLRenderer
  try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'})}
  catch{setStatus('WebGL غير متوفر على هذا المتصفح');return}
  renderer.setPixelRatio(Math.min(devicePixelRatio||1,1.5))
  renderer.outputColorSpace=THREE.SRGBColorSpace
  const scene=new THREE.Scene()
  scene.background=new THREE.Color(isWorld?0x111c2a:0x180e27)
  sceneRef.current=scene
  const camera=new THREE.PerspectiveCamera(38,1,.01,200)
  camera.position.set(0,1.5,4.5)
  const orbit=new OrbitControls(camera,canvas)
  orbit.enableDamping=true
  orbit.maxDistance=12
  orbitRef.current=orbit
  orbit.target.set(0,isWorld?1.35:.45,0)
  orbit.update()
  scene.add(new THREE.HemisphereLight(0xf0f4ff,0x526b82,2.2))
  const key=new THREE.DirectionalLight(0xffffff,2.4)
  key.position.set(-3,5,5);scene.add(key)
  const floor=new THREE.GridHelper(8,32,0x477495,0x29364d)
  floor.position.y=0;scene.add(floor)
  const resize=()=>{
   const w=Math.max(canvas.clientWidth,1),h=Math.max(canvas.clientHeight,1)
   renderer.setSize(w,h,false)
   camera.aspect=w/h;camera.updateProjectionMatrix()
  }
  const observer=new ResizeObserver(resize)
  observer.observe(canvas);resize()
  let raf=0,stopped=false,last=0
  const tick=(now:number)=>{
   if(stopped)return
   if(!document.hidden&&now-last>=1000/24){
    const holder=modelRef.current
    if(holder){
     const seconds=now/1000,selected=motionRef.current
     holder.rotation.y=selected==='spin'?seconds*.7:0
     holder.position.y=positionRef.current[1]+
      (selected==='float'?.08*Math.sin(seconds*2.4):0)
    }
    orbit.update();renderer.render(scene,camera);last=now
   }
   raf=requestAnimationFrame(tick)
  }
  raf=requestAnimationFrame(tick)
  return()=>{
   stopped=true;cancelAnimationFrame(raf)
   observer.disconnect();orbit.dispose()
   orbitRef.current=null
   if(modelRef.current){
    scene.remove(modelRef.current);free(modelRef.current);modelRef.current=null
   }
   sceneRef.current=null
   renderer.dispose()
  }
 },[isWorld])
 useEffect(()=>{
  if(!file)return
  let cancelled=false
  const load=async()=>{
   setRunning(true);setStatus('قراءة GLB وإجراء الفحص البنيوي محليًا…')
   try{
    if(!/\.glb$/i.test(file.name)||file.size<28||
     file.size>15*1024*1024)throw Error('يُشترط GLB بحجم أقل من 15MB')
    const bytes=await file.arrayBuffer()
    const audit=auditStudioGlbBytes(bytes)
    assertSelfContainedVideo3DGlb(bytes)
    if(!audit.valid||!audit.selfContained)
     throw Error('المجسم يحتوي بيانات غير صالحة أو روابط خارجية')
    const digest=new Uint8Array(await crypto.subtle.digest('SHA-256',bytes))
    const hash=Array.from(digest).map(b=>b.toString(16).padStart(2,'0')).join('')
    if(!cancelled)setFingerprint(hash)
    const gltf=await new GLTFLoader().parseAsync(bytes,'')
    if(cancelled){free(gltf.scene);return}
    const scene=sceneRef.current
    if(!scene){free(gltf.scene);return}
    const bounds=new THREE.Box3().setFromObject(gltf.scene)
    const size=new THREE.Vector3(),center=new THREE.Vector3()
    bounds.getSize(size);bounds.getCenter(center)
    const max=Math.max(size.x,size.y,size.z)
    if(bounds.isEmpty()||!Number.isFinite(max)||max<1e-5){
     free(gltf.scene);throw Error('أبعاد مجسم غير صالحة')
    }
    // Display calibration only; never claim these are real body dimensions.
    const targetH=isWorld ? .9 : .68
    const normalized=targetH/max
    const holder=new THREE.Group()
    const base=new THREE.Group()
    gltf.scene.position.set(-center.x,-bounds.min.y,-center.z)
    base.add(gltf.scene)
    base.scale.setScalar(normalized)
    holder.position.set(...positionRef.current)
    holder.add(base)
    if(modelRef.current){scene.remove(modelRef.current);free(modelRef.current)}
    scene.add(holder);modelRef.current=holder
    holder.scale.setScalar(scale)
    setStats(
     audit.triangles.toLocaleString('en-US')+' مثلث · '+
     audit.textures+' صورة خامة · '+
     audit.rigTargets+' Morph Targets · '+
     audit.animations+' حركة'
    )
    setStatus(isWorld?
     'معاينة داخل مشهد عالم خاص؛ لم تُختبر التصادمات أو الارتفاع الفعلي أو المزامنة الجماهيرية.':
     'معاينة هدية ثلاثية الأبعاد؛ حركة الهدية والعملة والدفع والموافقة على النشر غير متصلة.')
   }catch(error){
    if(!cancelled)setStatus('تعذّر الاستيراد: '+String(error))
   }finally{if(!cancelled)setRunning(false)}
  }
  void load()
  return()=>{cancelled=true}
 // Deliberately don't recreate the GLB when only the preview scale changes.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[file,isWorld])
 useEffect(()=>{
  if(modelRef.current)modelRef.current.scale.setScalar(scale)
 },[scale])
 useEffect(()=>{motionRef.current=motion},[motion])
 useEffect(()=>{
  positionRef.current=position
  if(modelRef.current)modelRef.current.position.set(...position)
 },[position])
 const importPrevious=async()=>{
  setStatus('جلب النسخة الخاصة من هذا المتصفح…')
  try{
   const [last,manifest]=await Promise.all([
    loadLocalStudioGlb(),loadStudioFanoutManifest(),
   ])
   if(!last){setStatus('لا يوجد GLB محفوظ. افتح AI Director ثم اضغط معاينة القسم.');return}
   setActivePlan(manifest&&manifest.source.fileName===last.name&&
    manifest.source.bytes===last.size?manifest:null)
   setFile(last)
  }catch(error){setStatus('فشل جلب المجسم المحلي: '+String(error))}
 }
 const autoImportRef=useRef(false)
 useEffect(()=>{
  if(!autoImportRef.current&&
   new URLSearchParams(window.location.search).get('from')==='ai-director'){
   autoImportRef.current=true
   void importPrevious()
  }
 // Only on navigation into this private preview; never retry paid work.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[])
 const choose=(event:ChangeEvent<HTMLInputElement>)=>{
  const f=event.target.files?.[0]??null
  event.target.value=''
  if(f){setActivePlan(null);setFingerprint('');setFile(f)}
 }
 const editPosition=(axis:0|1|2,value:number)=>{
  if(!Number.isFinite(value)||Math.abs(value)>5)return
  setPosition(previous=>{
   const next=[...previous] as [number,number,number]
   next[axis]=value
   return next
  })
 }
 const saveDraftSettings=()=>{
  if(!file||!fingerprint)return
  const draft={
   format:'SpaktokPrivatePlacement',version:1,
   createdAt:new Date().toISOString(),target:kind,
   sourceSha256:fingerprint,sourceFile:file.name,
   scale,position:[...position],motionPreview:motion,
   publication:'private-draft',collisionsVerified:false,
   androidPerformanceVerified:false,animationBakedIntoGlb:false,
  }
  const url=URL.createObjectURL(new Blob([
   JSON.stringify(draft,null,2)],{type:'application/json'}))
  const a=document.createElement('a')
  a.href=url;a.download='spaktok-'+kind+'-placement.json';a.click()
  window.setTimeout(()=>URL.revokeObjectURL(url),1000)
 }
 return <main dir="rtl" className="min-h-screen bg-[#080e1b] px-4 py-6 text-white">
  <section className="mx-auto max-w-5xl space-y-4">
   <header className="space-y-3">
    <p className="text-xs font-semibold tracking-widest text-cyan-200">
     PRIVATE 3D DRAFT • NO PUBLIC RELEASE
    </p>
    <h1 className="text-2xl font-bold">{title}</h1>
    <p className="text-sm leading-7 text-slate-300">
     {isWorld?'وضع عنصر 3D في مشهد معاينة للعالم وإجراء ضبط الحجم بصورة تجريبية.':
      'استعراض المجسم كهدية افتراضية قبل إنشاء الحركة والمؤثرات.'}
     {' '}هذا ليس نشرًا في التطبيق الرسمي ولا ربطًا بالمتجر أو Agora.
    </p>
    <div className="flex flex-wrap gap-2 text-xs">
     <Link href="/spaktok-word#ai-director"
      className="rounded-lg border border-white/20 px-3 py-2 text-cyan-200">
      AI Director
     </Link>
     <Link href="/avatar-studio"
      className="rounded-lg border border-white/20 px-3 py-2">Avatar Studio</Link>
     <Link href="/reality-studio"
      className="rounded-lg border border-white/20 px-3 py-2">Reality Studio</Link>
    </div>
   </header>
   <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_290px]">
    <canvas ref={canvasRef} aria-label="معاينة GLB 3D خاصة"
     className="h-[370px] w-full rounded-xl border border-white/10 bg-slate-950 sm:h-[540px]"/>
    <section className="space-y-4 rounded-xl border border-white/15 bg-slate-900/60 p-4">
     <button type="button" onClick={()=>void importPrevious()} disabled={running}
      className="w-full rounded-xl bg-indigo-600 px-3 py-3 text-sm font-semibold disabled:opacity-50">
      استيراد آخر GLB من AI Director
     </button>
     <label className="block text-xs">أو اختر GLB من جهازك (15MB)
      <input type="file" accept=".glb,model/gltf-binary" onChange={choose}
       className="mt-2 block w-full rounded-lg border border-white/20 bg-slate-950 p-2"/>
     </label>
     {file&&<p className="break-all text-xs text-cyan-200">{file.name}</p>}
     <label className="block text-xs">
      حجم المعاينة التجريبي: {scale.toFixed(2)}×
      <input type="range" min=".25" max="2" step=".05" value={scale}
       onChange={e=>setScale(Number(e.target.value))}
       className="mt-2 block w-full accent-violet-400"/>
     </label>
     {stats&&<p className="text-xs leading-6 text-slate-200">{stats}</p>}
     {activePlan&&fingerprint===activePlan.source.sha256&&
      <div className="space-y-2 rounded-lg border border-violet-300/30 bg-violet-950/20 p-3 text-xs">
       <p className="font-bold text-violet-200">خطة AI Director المطابقة لبصمة GLB</p>
       <p>معاينة خاصة فقط؛ لا تمنح صلاحية نشر أو معاملات مالية.</p>
       <p className="text-amber-100">
        {activePlan.outputs.find(o=>o.target===kind)?.blockers.join(' · ')||
         'لم يحدد AI Director هذا القسم ضمن خطته'}
       </p>
      </div>}
     <label className="block text-xs">
      حركة عرض محلية (لا تُحفظ كـAnimation في GLB)
      <select value={motion} onChange={e=>setMotion(e.target.value as typeof motion)}
       className="mt-2 block w-full rounded-lg border border-white/20 bg-slate-950 p-2">
       <option value="none">ثابت</option>
       <option value="spin">دوران هادئ</option>
       <option value="float">طفو بصري تجريبي</option>
      </select>
     </label>
     <div className="grid grid-cols-3 gap-2 text-xs">
      {(['X','Y','Z'] as const).map((name,axis)=><label key={name}>
       الموضع {name}
       <input type="number" min="-5" max="5" step=".05"
        value={position[axis]}
        onChange={e=>editPosition(axis as 0|1|2,Number(e.target.value))}
        className="mt-1 w-full rounded-lg border border-white/20 bg-slate-950 p-2"/>
      </label>)}
     </div>
     <button type="button" onClick={saveDraftSettings}
      disabled={!file||!fingerprint||running}
      className="w-full rounded-lg border border-white/25 p-2 text-xs disabled:opacity-40">
      تنزيل إعدادات الحركة والموضع JSON
     </button>
     <p role="status" className="text-xs leading-6 text-amber-100">{status}</p>
     <p className="text-[11px] leading-5 text-slate-400">
      الملف محلي وغير منشور. لا يُضاف لمكتبة الهدايا المدفوعة أو إلى
      عالم المستخدمين أو بث مباشر دون اختبار حقوق وRig وأداء Android.
      معايرة الحجم هنا بصرية وليست قياسًا حقيقيًا.
     </p>
    </section>
   </div>
  </section>
 </main>
}
