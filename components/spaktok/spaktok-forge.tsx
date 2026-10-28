'use client'

import {useEffect,useRef,useState,type ChangeEvent} from 'react'
import * as THREE from 'three'
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js'
import {
 buildForgeReliefGeometry,DEFAULT_FORGE_RELIEF,
 type ForgeReliefOptions,type ForgeReliefStats,
} from '@/lib/filter-engine/spaktok-forge-relief'
import {inspectWordGeneratedGlb} from '@/lib/filter-engine/spaktok-word-import'

const MAX_PHOTO_BYTES=8*1024*1024
const isImage=(file:File|null):file is File=>
 !!file&&/\.(png|jpe?g|webp)$/i.test(file.name)
function disposePreview(mesh:THREE.Mesh|null){
 if(!mesh)return
 mesh.geometry.dispose()
 const materials=Array.isArray(mesh.material)?mesh.material:[mesh.material]
 for(const material of materials){
  if(material instanceof THREE.MeshStandardMaterial)material.map?.dispose()
  material.dispose()
 }
}
function saveFile(file:File){
 const url=URL.createObjectURL(file)
 const a=document.createElement('a')
 a.href=url;a.download=file.name;a.click()
 window.setTimeout(()=>URL.revokeObjectURL(url),1500)
}
export default function SpaktokForge({
 sourceFile,onGeneratedGlb,
}:Readonly<{
 sourceFile:File|null
 onGeneratedGlb:(file:File)=>void
}>){
 const canvasRef=useRef<HTMLCanvasElement|null>(null)
 const previewRef=useRef<THREE.Mesh|null>(null)
 const sceneRef=useRef<THREE.Scene|null>(null)
 const [selected,setSelected]=useState<File|null>(null)
 const [settings,setSettings]=useState<ForgeReliefOptions>(DEFAULT_FORGE_RELIEF)
 const [approved,setApproved]=useState(false)
 const [busy,setBusy]=useState(false)
 const [result,setResult]=useState<File|null>(null)
 const [stats,setStats]=useState<ForgeReliefStats|null>(null)
 const [message,setMessage]=useState('')
 const [webglAvailable,setWebglAvailable]=useState(true)
 const source=selected??(isImage(sourceFile)?sourceFile:null)
 const update=(part:Partial<ForgeReliefOptions>)=>{
  setSettings(o=>({...o,...part}))
  setResult(null)
 }
 useEffect(()=>{
  setResult(null);setApproved(false)
 },[sourceFile,selected])
 useEffect(()=>{
  const canvas=canvasRef.current
  if(!canvas)return
  let renderer:THREE.WebGLRenderer
  try{
   renderer=new THREE.WebGLRenderer({canvas,antialias:true,
    alpha:false,powerPreference:'low-power'})
  }catch{
   setWebglAvailable(false);return
  }
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5))
  renderer.outputColorSpace=THREE.SRGBColorSpace
  renderer.setClearColor(0x101828)
  const scene=new THREE.Scene()
  scene.background=new THREE.Color(0x101828)
  sceneRef.current=scene
  const camera=new THREE.PerspectiveCamera(36,1,.01,100)
  camera.position.set(0,0,5.2)
  scene.add(new THREE.HemisphereLight(0xf4f7ff,0x364f7b,2))
  const light=new THREE.DirectionalLight(0xffffff,2.1)
  light.position.set(2,3,5);scene.add(light)
  const resize=()=>{
   const w=Math.max(1,canvas.clientWidth),h=Math.max(1,canvas.clientHeight)
   renderer.setSize(w,h,false)
   camera.aspect=w/h;camera.updateProjectionMatrix()
  }
  const resizeObserver=new ResizeObserver(resize)
  resizeObserver.observe(canvas);resize()
  let running=true,handle=0
  const animate=()=>{
   if(!running)return
   if(previewRef.current)previewRef.current.rotation.y+=.004
   renderer.render(scene,camera)
   handle=requestAnimationFrame(animate)
  }
  handle=requestAnimationFrame(animate)
  return()=>{
   running=false;cancelAnimationFrame(handle)
   resizeObserver.disconnect()
   if(previewRef.current){
    scene.remove(previewRef.current)
    disposePreview(previewRef.current);previewRef.current=null
   }
   sceneRef.current=null
   renderer.dispose()
  }
 },[])
 const select=(event:ChangeEvent<HTMLInputElement>)=>{
  const next=event.target.files?.[0]??null
  event.target.value=''
  if(next&&(!isImage(next)||next.size<64||next.size>MAX_PHOTO_BYTES)){
   setMessage('اختر PNG أو JPG أو WEBP بحجم لا يزيد عن 8MB.')
   return
  }
  setSelected(next);setResult(null);setStats(null)
 }
 const build=async()=>{
  if(!source||busy||!approved)return
  setBusy(true);setMessage('إنشاء سطح 3D مجسّم على جهازك، دون API أو إرسال الصورة…')
  let mesh:THREE.Mesh|null=null
  try{
   if(!isImage(source)||source.size>MAX_PHOTO_BYTES||source.size<64)
    throw Error('forge_image_invalid_or_too_large')
   if(typeof createImageBitmap!=='function')
    throw Error('forge_browser_image_decoder_unavailable')
   const bitmap=await createImageBitmap(source)
   let imageCanvas:HTMLCanvasElement
   try{
    if(bitmap.width<8||bitmap.height<8||bitmap.width>8000||bitmap.height>8000)
     throw Error('forge_image_dimensions_unsupported')
    const longest=Math.max(bitmap.width,bitmap.height)
    const factor=Math.min(1,512/longest)
    imageCanvas=document.createElement('canvas')
    imageCanvas.width=Math.max(8,Math.round(bitmap.width*factor))
    imageCanvas.height=Math.max(8,Math.round(bitmap.height*factor))
    const ctx=imageCanvas.getContext('2d',{willReadFrequently:true})
    if(!ctx)throw Error('forge_canvas_unavailable')
    ctx.clearRect(0,0,imageCanvas.width,imageCanvas.height)
    ctx.drawImage(bitmap,0,0,imageCanvas.width,imageCanvas.height)
    const pixels=ctx.getImageData(0,0,imageCanvas.width,imageCanvas.height)
    const built=buildForgeReliefGeometry(pixels.data,
     imageCanvas.width,imageCanvas.height,settings)
    const texture=new THREE.CanvasTexture(imageCanvas)
    texture.colorSpace=THREE.SRGBColorSpace
    const transparent=pixels.data.some((v,i)=>i%4===3&&v<250)
    const material=new THREE.MeshStandardMaterial({
     map:texture,roughness:.68,metalness:.04,side:THREE.DoubleSide,
     transparent,alphaTest:transparent?.08:0,
    })
    mesh=new THREE.Mesh(built.geometry,material)
    mesh.name='Spaktok Forge • local relief (not reconstructed 360 mesh)'
    setStats(built.stats)
   }finally{bitmap.close()}
   const binary=await new GLTFExporter().parseAsync(mesh,{
    binary:true,onlyVisible:true,maxTextureSize:1024,
   })
   if(!(binary instanceof ArrayBuffer))throw Error('forge_glb_export_failed')
   const out=inspectWordGeneratedGlb(binary,'spaktok-forge-relief.glb')
   if(!out.audit.hasPBR||!out.audit.hasUV||!out.audit.hasNormals)
    throw Error('forge_glb_material_or_uv_qa_failed')
   const glb=new File([binary],out.fileName,{type:'model/gltf-binary'})
   setResult(glb)
   const scene=sceneRef.current
   if(scene){
    const previous=previewRef.current
    if(previous){scene.remove(previous);disposePreview(previous)}
    scene.add(mesh);previewRef.current=mesh
    mesh=null
   }
   setMessage('نجح إنشاء GLB محلي مع شبكة مغلقة وUV وخامة PBR. '+
    'هذه إعادة بناء 2.5D بارزة مناسبة لبعض الفلاتر، وليست رأسًا أو جسمًا 360°.')
  }catch(error){
   setMessage('تعذّر إنشاء المجسم: '+(error instanceof Error?error.message:String(error)))
   setResult(null)
  }finally{
   if(mesh)disposePreview(mesh)
   setBusy(false)
  }
 }
 return <section dir="rtl" className="mx-auto mb-6 max-w-7xl space-y-4 rounded-2xl border border-cyan-300/40 bg-[#102038] p-4 text-white sm:p-5">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <p className="text-xs font-bold tracking-wide text-cyan-200">SPAKTOK FORGE • ZERO-CREDIT GENERATION</p>
    <h2 className="mt-1 text-xl font-bold">أنشئ مجسمًا مجانًا من صورة — داخل المتصفح</h2>
   </div>
   <span className="rounded-full border border-cyan-400/35 px-3 py-1 text-xs text-cyan-200">
    0 رصيد Rodin · دون رفع الصورة
   </span>
  </div>
  <p className="max-w-3xl text-xs leading-6 text-slate-200">
   النمط المتاح الآن: <strong>2.5D Relief</strong>، يصنع لوحة بارزة حقيقية بعمق
   وخامات PBR قابلة للدوران والتصدير GLB. يصلح للملصقات البارزة والإكسسوارات
   وبعض فلاتر AR، لكنه لا يخمّن ظهر الجسم ولا يحول صورة وجه إلى أفاتار تشريحي كامل.
   المجسمات الكاملة 360° تتطلب محرك AI على GPU منفصلًا.
  </p>
  <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_300px]">
   <div className="space-y-3">
    <canvas ref={canvasRef} aria-label="معاينة مجسم Forge ثلاثي الأبعاد"
     className="h-72 w-full rounded-xl border border-white/10 bg-slate-950 sm:h-[370px]"/>
    {!webglAvailable&&<p className="text-xs text-amber-200">
     المعاينة تحتاج WebGL؛ يمكنك المحاولة من Chrome على هاتف أو حاسوب متوافق.
    </p>}
    {stats&&<p className="text-xs text-cyan-100">
     {stats.triangles.toLocaleString()} مثلث · {stats.vertices.toLocaleString()} رأس
     · عمق إضافي {stats.maxDisplacement.toFixed(3)} وحدة · GLB محلي
    </p>}
   </div>
   <div className="space-y-3">
    <label className="block text-xs font-semibold">الصورة الأصلية (PNG/JPG/WebP، حتى 8MB)
     <input type="file" accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
      onChange={select} className="mt-2 block w-full rounded-lg border border-white/20 bg-slate-950 p-3"/>
    </label>
    {source&&<p className="break-all text-xs text-cyan-200">
     {source.name} · {(source.size/1024/1024).toFixed(2)} MB
    </p>}
    <label className="block text-xs">دقة الشبكة · {settings.resolution} نقطة أفقيًا
     <select value={settings.resolution}
      onChange={e=>update({resolution:Number(e.target.value) as ForgeReliefOptions['resolution']})}
      className="mt-1 block w-full rounded-lg border border-white/20 bg-slate-950 p-2">
      <option value={32}>اقتصادية — 32</option>
      <option value={48}>متوازنة — 48</option>
      <option value={64}>تفاصيل — 64</option>
      <option value={96}>عالية — 96</option>
     </select>
    </label>
    <label className="block text-xs">ارتفاع النحت · {Math.round(settings.relief*100)}%
     <input type="range" min="0" max=".7" step=".025" value={settings.relief}
      onChange={e=>update({relief:Number(e.target.value)})}
      className="mt-1 w-full accent-cyan-300"/>
    </label>
    <label className="block text-xs">سماكة الجسم · {settings.thickness.toFixed(2)}
     <input type="range" min=".015" max=".3" step=".005" value={settings.thickness}
      onChange={e=>update({thickness:Number(e.target.value)})}
      className="mt-1 w-full accent-violet-300"/>
    </label>
    <label className="block text-xs">تباين سطح النحت · {settings.contrast.toFixed(2)}
     <input type="range" min=".4" max="2.5" step=".1" value={settings.contrast}
      onChange={e=>update({contrast:Number(e.target.value)})}
      className="mt-1 w-full accent-cyan-300"/>
    </label>
    <label className="flex gap-2 text-xs">
     <input type="checkbox" checked={settings.invert}
      onChange={e=>update({invert:e.target.checked})}/>
     عكس ارتفاع المناطق الفاتحة والداكنة
    </label>
    <label className="flex gap-2 text-xs leading-5">
     <input type="checkbox" checked={approved}
      onChange={e=>setApproved(e.target.checked)} className="mt-1"/>
     أملك حقوق الصورة أو إذن تعديلها وإنشاء مجسم مشتق منها
    </label>
    <button type="button" disabled={!source||busy||!approved}
     onClick={()=>void build()} className="w-full rounded-lg bg-cyan-400 px-4 py-3 text-sm font-bold text-slate-950 disabled:opacity-40">
     {busy?'جارٍ إنشاء GLB…':'إنشاء GLB محلي مجانًا'}
    </button>
    <div className="grid gap-2 sm:grid-cols-2">
     <button type="button" disabled={!result||busy} onClick={()=>result&&saveFile(result)}
      className="rounded-lg border border-white/25 px-3 py-2 text-xs font-semibold disabled:opacity-40">
      تنزيل GLB
     </button>
     <button type="button" disabled={!result||busy}
      onClick={()=>result&&onGeneratedGlb(result)}
      className="rounded-lg bg-violet-600 px-3 py-2 text-xs font-semibold disabled:opacity-40">
      إدخاله إلى الاستوديو
     </button>
    </div>
   </div>
  </div>
  <p role="status" className="text-xs leading-6 text-slate-200">{message}</p>
  <p className="text-[11px] leading-5 text-slate-400">
   عند إرسال الناتج إلى Spaktok Word تُعاد حالة حقوق الاستخدام والمراجعات إلى غير معتمدة.
   يتطلب تحويل الصور إلى مجسمات 360° فوتوغرافية تدريبًا أو تشغيل نموذج GPU منفصلًا.
  </p>
 </section>
}
