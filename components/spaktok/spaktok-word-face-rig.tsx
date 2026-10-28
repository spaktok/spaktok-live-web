'use client'

import {useEffect,useRef,useState} from 'react'
import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js'
import {auditStudioGlbBytes} from '@/lib/filter-engine/reality-production-glb-audit'
import {inspectWordGeneratedGlb} from '@/lib/filter-engine/spaktok-word-import'
import {inspectWordRigQuality,rankWordFaceMeshes,verifyWordRigGlbChannels,
 type WordRigQualityReport} from '@/lib/filter-engine/spaktok-word-rig-qa'
import {
 buildCalibratedWordFaceRig,eligibleWordRigMeshes,
 DEFAULT_WORD_RIG_CALIBRATION,WORD_RIG_CHANNELS,
 type WordRigCalibration,type WordRigChannel,
} from '@/lib/filter-engine/spaktok-word-face-rig'
import {
 saveLocalStudioGlb,REALITY_HANDOFF_MAX_BYTES,
} from '@/lib/filter-engine/reality-local-asset-handoff'
import type {StudioProductionPackage} from '@/lib/filter-engine/reality-production-pipeline'

type RigSession={
 renderer:THREE.WebGLRenderer;scene:THREE.Scene;camera:THREE.PerspectiveCamera
 model:THREE.Group;meshes:THREE.Mesh[]
 sourceGeometries:Map<THREE.Mesh,THREE.BufferGeometry>
 preview:THREE.Mesh|null;modified:THREE.BufferGeometry|null
 guides:THREE.Group
 raf:number;observer:ResizeObserver
}
const titles:Record<WordRigChannel,string>={
 jawOpen:'فتح الفك',eyeBlinkLeft:'رمش العين اليسرى',
 eyeBlinkRight:'رمش العين اليمنى',
 mouthSmileLeft:'الابتسام جهة اليسار',
 mouthSmileRight:'الابتسام جهة اليمين',
 browInnerUp:'رفع الحاجبين',
 mouthPucker:'ضم الشفتين',
}
const sliders:ReadonlyArray<Readonly<{
 key:keyof Pick<WordRigCalibration,'eyeY'|'eyeSeparation'|'mouthY'|
 'faceDepthThreshold'|'strength'>
 title:string;min:number;max:number;step:number
}>>=[
 {key:'eyeY',title:'ارتفاع العينين',min:.36,max:.82,step:.01},
 {key:'eyeSeparation',title:'المسافة بين العينين',min:.16,max:.75,step:.01},
 {key:'mouthY',title:'ارتفاع الفم',min:.12,max:.55,step:.01},
 {key:'faceDepthThreshold',title:'تحديد السطح الأمامي للوجه',min:.15,max:.7,step:.01},
 {key:'strength',title:'قوة التشوه',min:.1,max:1,step:.05},
]
function disposeAll(root:THREE.Object3D){
 const geometry=new Set<THREE.BufferGeometry>()
 const materials=new Set<THREE.Material>()
 const textures=new Set<THREE.Texture>()
 root.traverse(obj=>{
  if(!(obj instanceof THREE.Mesh))return
  geometry.add(obj.geometry)
  for(const m of (Array.isArray(obj.material)?obj.material:[obj.material])){
   materials.add(m)
   for(const value of Object.values(m))
    if(value instanceof THREE.Texture)textures.add(value)
  }
 })
 geometry.forEach(x=>x.dispose())
 materials.forEach(x=>x.dispose())
 textures.forEach(x=>x.dispose())
}
export default function SpaktokWordFaceRig({
 file,project,onRiggedGlb,
}:Readonly<{
 file:File|null;project:StudioProductionPackage
 onRiggedGlb?:(file:File)=>void
}>){
 const canvasRef=useRef<HTMLCanvasElement|null>(null)
 const sessionRef=useRef<RigSession|null>(null)
 const frontRef=useRef<'positive-z'|'negative-z'>('positive-z')
 const yawRef=useRef(0)
 const [opened,setOpened]=useState(false)
 const [calibration,setCalibration]=useState<WordRigCalibration>(DEFAULT_WORD_RIG_CALIBRATION)
 const [meshIndex,setMeshIndex]=useState(0)
 const [meshLabels,setMeshLabels]=useState<string[]>([])
 const [suggestions,setSuggestions]=useState<ReadonlyArray<{
  index:number;score:number;reason:string
 }>>([])
 const [quality,setQuality]=useState<WordRigQualityReport|null>(null)
 const [visualApproved,setVisualApproved]=useState(false)
 const [playback,setPlayback]=useState(false)
 const [mode,setMode]=useState<WordRigChannel>('jawOpen')
 const [intensity,setIntensity]=useState(.75)
 const [yaw,setYaw]=useState(0)
 const [ready,setReady]=useState(false)
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const [stats,setStats]=useState('')
 const [dirty,setDirty]=useState(false)
 const canOpen=file!==null&&project.sourceFormat==='glb'
 const approved=project.tests.sourceReviewed&&
  (project.rights==='original'||
   (project.rights==='licensed'&&project.rightsEvidence.trim().length>=12))
 useEffect(()=>{
  frontRef.current=calibration.front
  const s=sessionRef.current
  if(s)s.camera.position.z=(calibration.front==='positive-z'?1:-1)*
   Math.max(2,Math.abs(s.camera.position.z))
 },[calibration.front])
 useEffect(()=>{yawRef.current=yaw},[yaw])
 useEffect(()=>{
  if(!canOpen){setOpened(false);setReady(false);setPlayback(false);setVisualApproved(false)}
 },[canOpen,file])
 useEffect(()=>{
  if(!opened||!canOpen||!canvasRef.current||!file)return
  let disposed=false
  const canvas=canvasRef.current
  const renderer=new THREE.WebGLRenderer({canvas,antialias:true,
   powerPreference:'low-power',alpha:false})
  renderer.outputColorSpace=THREE.SRGBColorSpace
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5))
  renderer.setClearColor(0x111827)
  const scene=new THREE.Scene()
  scene.background=new THREE.Color(0x111827)
  const camera=new THREE.PerspectiveCamera(33,1,.01,500)
  scene.add(new THREE.HemisphereLight(0xeaf5ff,0x596578,2))
  const light=new THREE.DirectionalLight(0xffffff,2.2)
  light.position.set(-2,4,5);scene.add(light)
  const fill=new THREE.DirectionalLight(0x82b2ff,1)
  fill.position.set(3,-2,-3);scene.add(fill)
  const pivot=new THREE.Group()
  scene.add(pivot)
  const guides=new THREE.Group()
  guides.name='WordRigGuidesPreviewOnly'
  pivot.add(guides)
  for(const color of [0x54e1ff,0x54e1ff,0xffa45b]){
   const marker=new THREE.Mesh(
    new THREE.SphereGeometry(1,12,8),
    new THREE.MeshBasicMaterial({
     color,depthTest:false,transparent:true,opacity:.92,
    }),
   )
   marker.renderOrder=999
   guides.add(marker)
  }
  const resize=()=>{
   const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight)
   renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()
  }
  const observer=new ResizeObserver(resize)
  observer.observe(canvas);resize()
  const s:RigSession={
   renderer,scene,camera,model:pivot,meshes:[],
   sourceGeometries:new Map(),preview:null,modified:null,guides,raf:0,observer,
  }
  sessionRef.current=s
  const tick=()=>{
   if(disposed)return
   pivot.rotation.y=yawRef.current*Math.PI/180
   renderer.render(scene,camera)
   s.raf=requestAnimationFrame(tick)
  }
  s.raf=requestAnimationFrame(tick)
  setReady(false);setMeshLabels([]);setStats('');setQuality(null)
  setVisualApproved(false);setPlayback(false);setSuggestions([])
  setMessage('فحص GLB المحلي قبل إنشاء أي حركة وجه…')
  ;(async()=>{
   try{
    const bytes=await file.arrayBuffer()
    const structural=auditStudioGlbBytes(bytes)
    if(!structural.valid||!structural.selfContained)
     throw Error('GLB غير صالح أو يحتاج موارد خارجية')
    if(bytes.byteLength>15*1024*1024)
     throw Error('حجم الملف يتجاوز حد محرر الوجه المحلي 15MB')
    const model=await new GLTFLoader().parseAsync(bytes,'')
    if(disposed){disposeAll(model.scene);return}
    model.scene.updateMatrixWorld(true)
    const bbox=new THREE.Box3().setFromObject(model.scene)
    const size=new THREE.Vector3(),center=new THREE.Vector3()
    bbox.getSize(size);bbox.getCenter(center)
    if(bbox.isEmpty()||Math.max(size.x,size.y,size.z)<1e-5)
     throw Error('مجسم بدون أبعاد هندسية صالحة')
    model.scene.position.sub(center)
    pivot.add(model.scene)
    s.model=model.scene
    s.meshes=eligibleWordRigMeshes(model.scene)
    for(const mesh of s.meshes)s.sourceGeometries.set(mesh,mesh.geometry)
    const dist=Math.max(size.x,size.y,size.z)*2.4
    camera.position.set(0,0,dist*(frontRef.current==='negative-z'?-1:1))
    camera.near=Math.max(dist/10000,.001)
    camera.far=dist*20
    camera.lookAt(0,0,0);camera.updateProjectionMatrix()
    if(!s.meshes.length)
     throw Error('لم أجد شبكة وجه يمكن تعديلها. تحقق من عدد نقاط Mesh وحركاته الموجودة.')
    setMeshLabels(s.meshes.map((m,i)=>
     (m.name||'Mesh '+(i+1))+' · '+m.geometry.getAttribute('position').count+' رأس'))
    const ranking=rankWordFaceMeshes(s.meshes)
    setSuggestions(ranking)
    setMeshIndex(ranking[0]?.score>=25?ranking[0].index:0)
    setReady(true)
    setMessage(ranking[0]?.score>=25?
     'اقترح Word شبكة محتملة للوجه اعتمادًا على الاسم والأبعاد. يجب مراجعتها بصريًا قبل النحت.':
     'لم أجد وجهًا واضحًا تلقائيًا. اختر شبكة الوجه يدويًا وتجنب الشعر والملابس.')
   }catch(e){
    if(!disposed)setMessage(e instanceof Error?e.message:'تعذّر تحميل المجسم')
   }
  })()
  return()=>{
   disposed=true;cancelAnimationFrame(s.raf);observer.disconnect()
   if(s.modified){
    s.preview!.geometry=s.sourceGeometries.get(s.preview!)!
    s.modified.dispose()
   }
   disposeAll(pivot)
   renderer.dispose()
   if(sessionRef.current===s)sessionRef.current=null
  }
 },[opened,file,canOpen])
 // Preview-only calibration markers are not included in the exported GLB.
 // They help users identify wrong front orientation or hair/body meshes.
 useEffect(()=>{
  const s=sessionRef.current
  const mesh=s?.meshes[meshIndex]
  if(!s||!mesh||!ready)return
  const p=mesh.geometry.getAttribute('position')
  if(!p)return
  if(!mesh.geometry.boundingBox)mesh.geometry.computeBoundingBox()
  const bounds=mesh.geometry.boundingBox?.clone()
  if(!bounds)return
  const size=new THREE.Vector3()
  bounds.getSize(size)
  if(Math.max(size.x,size.y,size.z)<1e-6)return
  const depth=calibration.front==='positive-z'?
   bounds.max.z+size.z*.045:bounds.min.z-size.z*.045
  const positions=[
   [(1-calibration.eyeSeparation)/2,calibration.eyeY],
   [(1+calibration.eyeSeparation)/2,calibration.eyeY],
   [.5,calibration.mouthY],
  ] as const
  s.scene.updateMatrixWorld(true)
  for(let i=0;i<positions.length;i++){
   const [u,v]=positions[i]
   const point=new THREE.Vector3(
    bounds.min.x+u*size.x,bounds.min.y+v*size.y,depth)
   const world=mesh.localToWorld(point)
   const local=s.guides.parent!.worldToLocal(world)
   const marker=s.guides.children[i]
   marker.position.copy(local)
   marker.scale.setScalar(Math.max(size.x,size.y,size.z)*.015)
  }
 },[calibration,meshIndex,ready,opened])
 const resetPreview=()=>{
  const s=sessionRef.current
  if(s?.preview&&s.modified){
   s.preview.geometry=s.sourceGeometries.get(s.preview)!
   s.preview.updateMorphTargets()
   s.modified.dispose()
  }
  if(s){s.preview=null;s.modified=null}
  setDirty(false);setStats('');setQuality(null)
  setVisualApproved(false);setPlayback(false)
 }
 const build=()=>{
  const s=sessionRef.current
  if(!s||!ready||busy)return
  try{
   resetPreview()
   const selected=s.meshes[meshIndex]
   if(!selected)throw Error('اختر شبكة الوجه الصحيحة')
   const original=s.sourceGeometries.get(selected)
   if(!original)throw Error('شبكة الوجه الأصلية غير موجودة')
   const result=buildCalibratedWordFaceRig(original,calibration)
   selected.geometry=result.geometry
   selected.updateMorphTargets()
   s.preview=selected;s.modified=result.geometry
   const inspection=inspectWordRigQuality(result.geometry,result.diagnostics)
   setQuality(inspection)
   setVisualApproved(false)
   setDirty(true)
   setStats(
    'رؤوس الشبكة: '+result.diagnostics.vertices.toLocaleString('en-US')+
    ' · القنوات: '+WORD_RIG_CHANNELS.length+
    ' · تأثير الفك: '+result.diagnostics.activeVertices.jawOpen+
    (result.diagnostics.warnings.length?
     ' · تحذيرات: '+result.diagnostics.warnings.join('، '):'')
   )
   setMessage(inspection.status==='needs-recalibration'?
    'هناك تحذيرات هندسية. عدّل معايرة العينين والفم وافحص القنوات قبل اعتماد التصدير.':
    'تم إنشاء سبع حركات للشبكة. اختبر كل تعبير بصريًا وراجع مواضع الوجه قبل التصدير.')
  }catch(e){setMessage(e instanceof Error?e.message:'فشل معايرة Rig')}
 }
 useEffect(()=>{
  const s=sessionRef.current
  if(!s?.preview?.morphTargetInfluences)return
  const influences=s.preview.morphTargetInfluences
  influences.fill(0)
  const index=s.preview.morphTargetDictionary?.[mode]
  if(typeof index==='number'&&index<influences.length)
   influences[index]=intensity
 },[mode,intensity,dirty,stats])
 useEffect(()=>{
  if(!playback||!dirty)return
  let index=0
  setMode(WORD_RIG_CHANNELS[index])
  setIntensity(.85)
  const timer=window.setInterval(()=>{
   index=(index+1)%WORD_RIG_CHANNELS.length
   setMode(WORD_RIG_CHANNELS[index])
  },1200)
  return()=>window.clearInterval(timer)
 },[playback,dirty])
 const exportRig=async(destination:'download'|'avatar')=>{
  const s=sessionRef.current
  if(!s?.preview||!s.modified||!dirty||busy)return
  if(!approved){
   setMessage('يجب مراجعة حقوق GLB المصدر وتأكيدها قبل تصدير نسخة معدلة.')
   return
  }
  if(!visualApproved||quality?.status!=='ready-for-visual-review'){
   setMessage('لا يمكن التصدير قبل تصحيح تحذيرات الحركة واعتماد المراجعة البصرية اليدوية.')
   return
  }
  setPlayback(false)
  setBusy(true)
  setMessage('تصدير GLB مع Morph Targets ثم إعادة فحصه…')
  try{
   s.preview.morphTargetInfluences?.fill(0)
   const binary=await new GLTFExporter().parseAsync(s.model,{
    binary:true,onlyVisible:true,maxTextureSize:2048,
   })
   if(!(binary instanceof ArrayBuffer))
    throw Error('word_rig_export_not_binary')
   const audited=inspectWordGeneratedGlb(binary,'spaktok-word-face-rig.glb')
   if(audited.audit.rigTargets<WORD_RIG_CHANNELS.length)
    throw Error('word_rig_export_lost_morph_targets')
   const names=verifyWordRigGlbChannels(binary)
   if(names.missing.length)
    throw Error('word_rig_export_missing_names_'+names.missing.join('_'))
   if(destination==='avatar'){
    if(binary.byteLength>REALITY_HANDOFF_MAX_BYTES)
     throw Error('ملف GLB يتجاوز 15MB؛ حسّن الخامات والهندسة أولًا')
    await saveLocalStudioGlb(audited.fileName,binary)
    window.location.assign('/avatar-studio')
    return
   }
   const blob=new Blob([binary],{type:'model/gltf-binary'})
   const url=URL.createObjectURL(blob)
   const link=document.createElement('a')
   link.href=url;link.download=audited.fileName;link.click()
   window.setTimeout(()=>URL.revokeObjectURL(url),1200)
   setMessage('تم تصدير GLB والتحقق من وجود القنوات السبع. لا يضمن ذلك تطابق الملامح أو الجودة البصرية على الهاتف.')
   if(onRiggedGlb){
    // Preserve source provenance but reset prior approvals in the parent.
    onRiggedGlb(new File([binary],audited.fileName,{type:'model/gltf-binary'}))
   }
  }catch(e){
   setMessage('فشل تصدير Face Rig: '+(e instanceof Error?e.message:String(e)))
  }finally{setBusy(false)}
 }
 return <section dir="rtl" className="space-y-3 rounded-2xl border border-fuchsia-400/35 bg-[#151328] p-4 text-white">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <p className="text-xs font-semibold text-fuchsia-200">Spaktok Word • Face Rig Builder V1</p>
    <h3 className="mt-1 text-xl font-bold">ربط شبكة وجه GLB بتعابير اللايف</h3>
   </div>
   <button type="button" disabled={!canOpen}
    onClick={()=>setOpened(o=>!o)}
    className="rounded-xl bg-fuchsia-600 px-4 py-2 text-xs font-semibold disabled:opacity-40">
    {opened?'إغلاق محرر الوجه':'فتح محرر Face Rig'}
   </button>
  </div>
  <p className="text-xs leading-6 text-slate-300">
   محرر تحريك هندسي حقيقي، وليس إسقاط صورة أو توليدًا من الصفر. حدد شبكة الوجه فقط
   واضبط أماكن العين والفم. ينتج 7 Morph Targets متوافقة مع محرك Avatar Studio.
   يحتاج النموذج إلى معايرة فنية، خاصة إذا كان الرأس مدمجًا مع الشعر أو الجسم.
  </p>
  {opened&&canOpen&&<div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_320px]">
   <div className="overflow-hidden rounded-xl border border-white/10 bg-slate-900">
    <canvas ref={canvasRef} className="h-[48dvh] min-h-72 w-full"
     aria-label="معاينة مجسم GLB وتحريك شبكة الوجه"/>
    <div className="space-y-2 p-3 text-xs">
     <p className="text-cyan-200">● ● موضع العينين المقترح — <span className="text-orange-300">● الفم المقترح</span>. العلامات للمعايرة فقط ولا تُصدّر.</p>
     <label className="block">تدوير المجسم {yaw}°
      <input type="range" min="-180" max="180" step="5" value={yaw}
       onChange={e=>setYaw(Number(e.target.value))}
       className="mt-1 w-full accent-fuchsia-400"/>
     </label>
     <label className="block">اختبار التعبير {Math.round(intensity*100)}%
      <input type="range" min="0" max="1" step=".05" value={intensity}
       onChange={e=>setIntensity(Number(e.target.value))}
       className="mt-1 w-full accent-cyan-400"/>
     </label>
    </div>
   </div>
   <div className="space-y-3">
    <label className="block text-xs">شبكة الوجه المختارة
     <select value={meshIndex} onChange={e=>{resetPreview();setMeshIndex(Number(e.target.value))}}
      className="mt-1 block w-full rounded-lg border border-white/20 bg-slate-950 p-2">
      {meshLabels.map((name,i)=><option key={i} value={i}>{name}</option>)}
     </select>
    </label>
    {suggestions.length>0&&<p className="rounded-lg border border-white/10 p-2 text-[11px] leading-5 text-slate-300">
     اقتراح الشبكة: {suggestions.find(s=>s.index===meshIndex)?.score??0} نقطة تقييم تقريبية.
     {suggestions.find(s=>s.index===meshIndex)?.reason??'افحصه بصريًا'}
     <span className="block text-amber-200">الاقتراح لا يحدد وجهًا تشريحيًا آليًا.</span>
    </p>}
    <label className="block text-xs">جهة الوجه الأمامية
     <select value={calibration.front}
      onChange={e=>{resetPreview();setCalibration(c=>({...c,front:e.target.value as WordRigCalibration['front']}))}}
      className="mt-1 block w-full rounded-lg border border-white/20 bg-slate-950 p-2">
      <option value="positive-z">+Z — الوجه للأمام</option>
      <option value="negative-z">−Z — الوجه للخلف</option>
     </select>
    </label>
    {sliders.map(setting=><label key={setting.key} className="block text-xs">
     <span className="flex justify-between gap-2"><span>{setting.title}</span>
      <span>{calibration[setting.key].toFixed(2)}</span></span>
     <input type="range" min={setting.min} max={setting.max}
      step={setting.step} value={calibration[setting.key]}
      onChange={e=>{resetPreview();setCalibration(c=>({...c,[setting.key]:Number(e.target.value)}))}}
      className="h-7 w-full accent-violet-400"/>
    </label>)}
    <button type="button" onClick={build} disabled={!ready||busy}
     className="w-full rounded-lg bg-violet-600 px-4 py-3 text-sm font-bold disabled:opacity-40">
     توليد 7 حركات على الشبكة المختارة
    </button>
    {dirty&&<label className="block text-xs">التعبير الذي تريد معاينته
     <select value={mode} onChange={e=>setMode(e.target.value as WordRigChannel)}
      className="mt-1 block w-full rounded-lg border border-white/20 bg-slate-950 p-2">
      {WORD_RIG_CHANNELS.map(k=><option value={k} key={k}>{titles[k]}</option>)}
     </select>
    </label>}
    {dirty&&quality&&<div className="rounded-lg border border-white/15 bg-slate-950 p-3 text-xs">
     <p className="font-bold">{quality.status==='needs-recalibration'?
      'تحتاج المعايرة إلى تصحيح':'الفحص الهندسي الأولي جاهز للمراجعة البصرية'}</p>
     <div className="mt-2 grid grid-cols-2 gap-1">
      {quality.channelNames.map(k=><span key={k} className="text-slate-300">
       {titles[k]}: {quality.coverage[k]}% من نقاط الشبكة
      </span>)}
     </div>
     {quality.warnings.map(w=><p key={w} className="mt-1 text-amber-200">{w}</p>)}
     <button type="button" onClick={()=>setPlayback(v=>!v)}
      className="mt-3 rounded-lg border border-cyan-300/35 px-3 py-2 text-cyan-100">
      {playback?'إيقاف تشغيل الحركات':'تشغيل جميع الحركات بالتتابع'}
     </button>
     <label className="mt-3 flex items-start gap-2 leading-6 text-white/80">
      <input type="checkbox" checked={visualApproved}
       onChange={e=>setVisualApproved(e.target.checked)}
       disabled={quality.status!=='ready-for-visual-review'} className="mt-1"/>
      راجعت التعابير من الأمام والجانبين ولم ألاحظ تشوه العين أو الفم أو الشعر.
      هذه مراجعة ذاتية وليست شهادة جاهزية للبث.
     </label>
    </div>}
    <button type="button" onClick={()=>void exportRig('download')}
     disabled={!dirty||busy||!approved||!visualApproved||
      quality?.status!=='ready-for-visual-review'}
     className="w-full rounded-lg bg-cyan-600 px-3 py-3 text-xs font-bold disabled:opacity-40">
     تصدير Rigged GLB (مع فحص الشبكة)
    </button>
    <button type="button" onClick={()=>void exportRig('avatar')}
     disabled={!dirty||busy||!approved||!visualApproved||
      quality?.status!=='ready-for-visual-review'}
     className="w-full rounded-lg border border-cyan-300/60 px-3 py-3 text-xs font-bold disabled:opacity-40">
     اختبار المجسم مباشرة في Avatar Studio
    </button>
   </div>
   <p role="status" className="lg:col-span-2 text-xs leading-6 text-cyan-200">
    {message} {stats}
   </p>
  </div>}
  {!approved&&<p className="text-xs leading-6 text-amber-200">
   قبل التصدير: أكّد حقوق الملف الأصلي وأكمل مراجعة المصدر في Production Director.
  </p>}
  <p className="text-[11px] leading-6 text-slate-400">
   هذه نسخة Rig بداية تتطلب معايرة اليدوية والمراجعة الحية. ليست Auto-Rig تشريحيًا
   كاملاً أو 52 تعبير ARKit، ولا تعني أن الشخصية تتطابق مع صورة المرجع.
  </p>
 </section>
}
