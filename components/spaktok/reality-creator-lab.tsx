'use client'

import {useEffect,useRef,useState,type ChangeEvent} from 'react'
import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {OBJLoader} from 'three/addons/loaders/OBJLoader.js'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {validateAuthoringAsset,type RealityAuthoringAsset} from '@/lib/filter-engine/reality-canonical-head'
import {buildCanonicalRetarget,parseCanonicalOBJ} from '@/lib/filter-engine/reality-canonical-retarget'

type Vec3=readonly [number,number,number]
const anchors=['eyes_center','forehead_center','head_top','nose_bridge',
 'left_temple','right_temple','chin','jaw_left','jaw_right'] as const
const categories=['glasses','hair','hat','mask','jewelry','other'] as const
function safeSlug(name:string){
 return (name.replace(/\.(glb|obj)$/i,'').toLowerCase().replace(/[^a-z0-9-]/g,'-')
  .replace(/-+/g,'-').replace(/^-|-$/g,'').slice(0,60)||'my-effect')+'-v1'
}
function releaseModel(root:THREE.Object3D){
 root.traverse(child=>{
  if(child instanceof THREE.Mesh){
   child.geometry.dispose()
   const m=Array.isArray(child.material)?child.material:[child.material]
   for(const material of m){
    for(const value of Object.values(material)){
     if(value instanceof THREE.Texture)value.dispose()
    }
    material.dispose()
   }
  }
 })
}
export default function RealityCreatorLab(){
 const stage=useRef<HTMLDivElement|null>(null)
 const pivotRef=useRef<Vec3>([0,0,0])
 const [file,setFile]=useState<File|null>(null)
 const [name,setName]=useState('My 3D Effect')
 const [category,setCategory]=useState<typeof categories[number]>('glasses')
 const [anchor,setAnchor]=useState<typeof anchors[number]>('eyes_center')
 const [pivot,setPivot]=useState<Vec3>([0,0,0])
 const [grip,setGrip]=useState<Vec3>([.08,-.03,0])
 const [status,setStatus]=useState('Choose a GLB effect or an OBJ canonical reference to inspect.')
 const [size,setSize]=useState<Vec3|null>(null)
 const [modelInfo,setModelInfo]=useState({triangles:0,materials:0})
 const [articulated,setArticulated]=useState(false)
 const [wire,setWire]=useState(false)
 const [retargetBusy,setRetargetBusy]=useState(false)
 const [retargetInfo,setRetargetInfo]=useState<string|null>(null)
 const wireRef=useRef(false)
 useEffect(()=>{pivotRef.current=pivot},[pivot])
 useEffect(()=>{wireRef.current=wire},[wire])
 useEffect(()=>{
  const root=stage.current
  if(!root)return
  let stopped=false,handle=0,loaded:THREE.Object3D|null=null
  const scene=new THREE.Scene()
  scene.background=new THREE.Color(0x101725)
  const renderer=new THREE.WebGLRenderer({antialias:true,alpha:false})
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2))
  renderer.outputColorSpace=THREE.SRGBColorSpace
  renderer.toneMapping=THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure=1.1
  renderer.shadowMap.enabled=true
  root.appendChild(renderer.domElement)
  const camera=new THREE.PerspectiveCamera(35,1,.01,100)
  camera.position.set(0,.15,3.2)
  const orbit=new OrbitControls(camera,renderer.domElement)
  orbit.enableDamping=true
  const ambient=new THREE.HemisphereLight(0xeaf1ff,0x374356,2.2)
  scene.add(ambient)
  const key=new THREE.DirectionalLight(0xffeac7,3)
  key.position.set(-2,4,5);scene.add(key)
  const rim=new THREE.DirectionalLight(0x72a4ff,2)
  rim.position.set(3,1,-3);scene.add(rim)
  const grid=new THREE.GridHelper(4,40,0x395e85,0x263b50)
  grid.position.y=-.85;scene.add(grid)
  const axes=new THREE.AxesHelper(.6);scene.add(axes)
  const holder=new THREE.Group()
  scene.add(holder)
  const resize=()=>{
   const w=Math.max(320,root.clientWidth),h=Math.max(320,root.clientHeight)
   renderer.setSize(w,h,false)
   camera.aspect=w/h;camera.updateProjectionMatrix()
  }
  const observer=new ResizeObserver(resize)
  observer.observe(root);resize()
  if(file){
   const reference=/\.obj$/i.test(file.name)
   setStatus(reference?'Parsing OBJ reference locally...':'Parsing GLB locally...')
   const parsed:Promise<THREE.Group>=reference?
    file.text().then(text=>new OBJLoader().parse(text)):
    file.arrayBuffer().then(buffer=>new Promise<THREE.Group>((resolve,reject)=>{
     new GLTFLoader().parse(buffer,'',gltf=>resolve(gltf.scene),reject)
    }))
   parsed.then(model=>{
    if(stopped){releaseModel(model);return}
    loaded=model
    holder.add(model)
    model.updateMatrixWorld(true)
    const bbox=new THREE.Box3().setFromObject(model)
    if(bbox.isEmpty())throw Error('Model is empty.')
    const dim=new THREE.Vector3(),center=new THREE.Vector3()
    bbox.getSize(dim);bbox.getCenter(center)
    const triangles={count:0,materials:new Set<THREE.Material>()}
    model.traverse(node=>{
     if(node instanceof THREE.Mesh){
      const geometry=node.geometry
      const index=geometry.getIndex()
      triangles.count+=Math.floor((index?index.count:geometry.getAttribute('position').count)/3)
      for(const mat of Array.isArray(node.material)?node.material:[node.material])
       triangles.materials.add(mat)
     }
    })
    setSize([dim.x,dim.y,dim.z])
    setModelInfo({triangles:triangles.count,materials:triangles.materials.size})
    orbit.target.copy(center)
    const maxDim=Math.max(dim.x,dim.y,dim.z,.25)
    camera.position.set(center.x,center.y+maxDim*.4,center.z+maxDim*2.9)
    camera.near=Math.max(.001,maxDim*.001)
    camera.far=Math.max(100,maxDim*10)
    camera.updateProjectionMatrix();orbit.update()
    setStatus(reference?
     'OBJ canonical reference loaded. Template triangles/UVs are NOT tracked 3D measurements; convert/retarget before use.':
     'GLB loaded locally. Review its geometry, UVs, pivots and materials.')
   }).catch(error=>{if(!stopped)setStatus('Unable to parse model: '+String(error))})
  }
  const animate=()=>{
   if(stopped)return
   handle=requestAnimationFrame(animate)
   orbit.update()
   if(loaded){
    loaded.position.set(-pivotRef.current[0],-pivotRef.current[1],-pivotRef.current[2])
    loaded.traverse(n=>{
     if(n instanceof THREE.Mesh&&n.material){
      for(const mat of Array.isArray(n.material)?n.material:[n.material]){
       const material=mat as THREE.Material & {wireframe?:boolean}
       if(typeof material.wireframe==='boolean')material.wireframe=wireRef.current
      }
     }
    })
   }
   renderer.render(scene,camera)
  }
  animate()
  return()=>{
   stopped=true;cancelAnimationFrame(handle);observer.disconnect()
   orbit.dispose()
   if(loaded)releaseModel(loaded)
   renderer.dispose()
   renderer.domElement.remove()
  }
 },[file])
 const importGLB=(event:ChangeEvent<HTMLInputElement>)=>{
  const next=event.target.files?.[0]
  if(!next)return
  if(!/\.(glb|obj)$/i.test(next.name)||next.size>35*1024*1024){
   setStatus('Please import .glb or .obj under 35 MB; no remote models.')
   return
  }
  setFile(next);setName(next.name.replace(/\.(glb|obj)$/i,'').replace(/[_-]/g,' '))
  setPivot([0,0,0]);setSize(null)
 }
 const numberEditor=(title:string,value:Vec3,apply:(v:Vec3)=>void)=>(
  <div className="space-y-2">
   <p className="text-sm font-semibold text-white">{title}</p>
   <div className="grid grid-cols-3 gap-2">
    {(['X','Y','Z'] as const).map((axis,index)=>(
     <label key={axis} className="text-xs text-slate-300">{axis}
      <input type="number" step=".01" value={value[index]}
       onChange={e=>{
        const next=[...value] as number[]
        next[index]=Number(e.target.value)
        apply(next as unknown as Vec3)
       }}
       className="mt-1 w-full rounded-lg border border-slate-700 bg-slate-900 px-2 py-2 text-white"
      />
     </label>
    ))}
   </div>
  </div>
 )
 const exportRetarget=async()=>{
  if(!file||!/\.obj$/i.test(file.name)||retargetBusy)return
  setRetargetBusy(true)
  setRetargetInfo(null)
  setStatus('Building a neutral, approximate 1220-to-468 retarget map locally...')
  try{
   const [userText,response]=await Promise.all([
    file.text(),
    fetch('/face-assets/mediapipe-canonical-face-468.obj',{cache:'force-cache'}),
   ])
   if(!response.ok)throw Error('canonical_reference_unavailable')
   const source=parseCanonicalOBJ(userText)
   const target=parseCanonicalOBJ(await response.text())
   if(target.vertices.length!==468)throw Error('unexpected_canonical_model')
   // Give the browser one frame to display loading feedback.
   await new Promise<void>(resolve=>requestAnimationFrame(()=>resolve()))
   const map=buildCanonicalRetarget(source,target)
   const payload={
    format:'SpakTokCanonicalRetargetDraft',version:1,
    sourceFile:file.name,
    sourceVertexCount:source.vertices.length,
    sourceTriangleCount:source.triangles.length,
    copyright:'Keep the original OBJ copyright/license notices when redistributing geometry',
    canonical:'MediaPipe canonical_face_model.obj (468 vertices, Apache-2.0)',
    targetMap:map,
    validatedForLiveCamera:false,
    note:'Projected neutral correspondences are estimates; device and pose calibration required.',
   }
   const blob=new Blob([JSON.stringify(payload)],{type:'application/json'})
   const url=URL.createObjectURL(blob)
   const a=document.createElement('a')
   a.href=url;a.download=safeSlug(file.name)+'.retarget.json'
   a.click();setTimeout(()=>URL.revokeObjectURL(url),2000)
   setRetargetInfo(`${map.sourceVertices} → 468 | mean error ${map.meanProjectionError.toFixed(4)} | worst ${map.worstProjectionError.toFixed(4)}`)
   setStatus('Retarget draft created locally. Do NOT publish without 3D fit verification.')
  }catch(error){
   setStatus('Retarget generation failed: '+String(error))
  }finally{setRetargetBusy(false)}
 }
 const exportDraft=()=>{
  if(!file)return
  if(/\.obj$/i.test(file.name)){
   setStatus('OBJ is reference geometry only. Convert and rig as GLB before exporting a publishable effect draft.')
   return
  }
  try{
   const slug=safeSlug(file.name)
   const asset:RealityAuthoringAsset={
    id:slug,uri:'/face-assets/'+slug+'.glb',
    category,units:'meter',pivotM:pivot,grippingPointsM:[grip],
    supportsArticulatedRig:articulated,
    materials:{pbrMetallicRoughness:true,normalMap:false,occlusionMap:false},
   }
   validateAuthoringAsset(asset)
   const draft={
    format:'SpakTokRealityAuthoringDraft',
    version:1,name,
    authoringAsset:asset,
    anchor,
    interaction:{
     mode:'hand-pinch-grab',
     grabRadiusHeadWidths:.72,
     release:'fingers-open-or-tracking-lost',
     articulationNodes:['SpakTokTempleLeft','SpakTokTempleRight','SpakTokHairLock*'],
    },
    geometry:{sourceFilename:file.name,bytes:file.size,dimensionsM:size,
     triangles:modelInfo.triangles,materials:modelInfo.materials},
    publishing:'requires-review-and-first-party-upload',
   }
   const url=URL.createObjectURL(new Blob([JSON.stringify(draft,null,2)],{type:'application/json'}))
   const link=document.createElement('a')
   link.href=url;link.download=slug+'.reality.json';link.click()
   setTimeout(()=>URL.revokeObjectURL(url),2500)
   setStatus('Draft exported; the GLB is still local and NOT published.')
  }catch(error){setStatus('Invalid draft: '+String(error))}
 }
 return (
  <main dir="rtl" className="min-h-screen bg-[#080e19] px-5 py-8 text-white">
   <header className="mx-auto mb-7 max-w-7xl space-y-2">
    <span className="text-xs font-semibold uppercase tracking-widest text-cyan-300">SpakTok Reality Creator Studio · Local Beta</span>
    <h1 className="text-3xl font-bold">استوديو صناعة المؤثرات ثلاثية الأبعاد</h1>
    <p className="max-w-3xl text-sm leading-7 text-slate-300">استورد مجسم GLB أو شبكة وجه مرجعية OBJ، افحص الخامات والهندسة، حدد موضع الارتباط بالوجه ونقاط الإمساك باليد. جميع الملفات تبقى في متصفحك، والتصدير ينتج مسودة تعريف فقط.</p>
   </header>
   <div className="mx-auto grid max-w-7xl gap-6 lg:grid-cols-[minmax(0,1fr)_350px]">
    <section className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-950">
     <div ref={stage} className="h-[390px] w-full sm:h-[620px]" aria-label="3D object inspector"/>
     <div className="border-t border-slate-800 px-4 py-3 text-sm text-slate-300">
      <div className="flex flex-wrap gap-5"><span>Triangles: {modelInfo.triangles.toLocaleString()}</span>
      <span>Materials: {modelInfo.materials}</span>
      <span>Object size (model units): {size?size.map(n=>n.toFixed(3)).join(' × '):'—'}</span></div>
      <p className="mt-2 text-xs text-cyan-300">{status}</p>
     </div>
    </section>
    <section className="space-y-5 rounded-2xl border border-slate-700 bg-slate-900/70 p-5">
     <label className="block space-y-2 text-sm font-semibold">ملف المجسم (.glb أو .obj)
      <input type="file" accept=".glb,.obj,model/gltf-binary,text/plain" onChange={importGLB}
       className="block w-full rounded-xl border border-dashed border-slate-600 bg-slate-950 px-3 py-4 text-sm font-normal"/>
     </label>
     <label className="block space-y-2 text-sm font-semibold">اسم المؤثر
      <input value={name} onChange={e=>setName(e.target.value)} maxLength={80}
       className="block w-full rounded-lg border border-slate-700 bg-slate-950 px-3 py-2"/>
     </label>
     <div className="grid grid-cols-2 gap-3">
      <label className="text-sm font-semibold">الفئة
       <select value={category} onChange={e=>setCategory(e.target.value as typeof category)}
        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-2">
        {categories.map(c=><option key={c} value={c}>{c}</option>)}
       </select>
      </label>
      <label className="text-sm font-semibold">نقطة الارتباط
       <select value={anchor} onChange={e=>setAnchor(e.target.value as typeof anchor)}
        className="mt-2 w-full rounded-lg border border-slate-700 bg-slate-950 p-2">
        {anchors.map(a=><option key={a} value={a}>{a}</option>)}
       </select>
      </label>
     </div>
     {numberEditor('الإزاحة إلى مركز التثبيت (متر / وحدات النموذج)',pivot,setPivot)}
     {numberEditor('نقطة إمساك اليد داخل المجسم',grip,setGrip)}
     <label className="flex gap-2 text-sm text-slate-300">
      <input type="checkbox" checked={articulated} onChange={e=>setArticulated(e.target.checked)}/>
      المجسم يحتوي على مفاصل أو عظام للتحريك
     </label>
     <label className="flex gap-2 text-sm text-slate-300">
      <input type="checkbox" checked={wire} onChange={e=>setWire(e.target.checked)}/>
      عرض الشبكة الهندسية للمجسم
     </label>
     {file&&/\.obj$/i.test(file.name)&&
       <div className="space-y-2 rounded-xl border border-cyan-800 bg-cyan-950/30 p-3">
        <p className="text-sm font-semibold">Canonical Face Retarget — 468 landmarks</p>
        <p className="text-xs leading-5 text-slate-300">
         مطابقة هندسية تقريبية بين نموذج OBJ المرجعي ومثلثات وجه MediaPipe القياسية؛
         لا تضيف نقاط تتبّع جديدة أو قياسات حقيقية للجسم.
        </p>
        <button onClick={exportRetarget} disabled={retargetBusy}
         className="w-full rounded-lg bg-indigo-500 px-3 py-2 text-sm font-semibold disabled:opacity-50">
         {retargetBusy?'يتم إعداد الخريطة...':'توليد وتصدير خريطة Retarget'}
        </button>
        {retargetInfo&&<p className="text-xs text-cyan-300">{retargetInfo}</p>}
       </div>
     }
     <button onClick={exportDraft} disabled={!file||/\.obj$/i.test(file.name)}
      className="w-full rounded-xl bg-cyan-500 px-4 py-3 font-bold text-slate-950 disabled:cursor-not-allowed disabled:opacity-40">
      تصدير مسودة Effect Package
     </button>
     <p className="text-xs leading-6 text-slate-400">لا يتم رفع الملفات ولا نشرها. لإنتاج مؤثر واقعي يجب تصميم UV/PBR وRig بجودة جيدة، ثم رفع الأصل إلى مستودع SpakTok ومراجعته واختباره على الهاتف.</p>
    </section>
   </div>
  </main>
 )
}
