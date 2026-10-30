'use client'

import {useEffect,useRef,useState} from 'react'
import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {centeredPreviewTransform} from '@/lib/filter-engine/spaktok-glb-preview-transform'

/**
 * Strictly local, unpublished 360° private GLB visual inspection.
 * No camera/mic permissions, uploads, public URLs or geometry mutation.
 * PBR textures are shown through Three's EXT_texture_webp-capable GLTFLoader.
 */
export default function PrivateStudioGlbPreview({
 file,topologyWarning=false,
}:Readonly<{file:File;topologyWarning?:boolean}>){
 const canvas=useRef<HTMLCanvasElement|null>(null)
 const root=useRef<THREE.Object3D|null>(null)
 const [wireframe,setWireframe]=useState(false)
 const [turn,setTurn]=useState(true)
 const [message,setMessage]=useState('تحميل المعاينة المحلية…')
 const wireRef=useRef(wireframe)
 const turnRef=useRef(turn)
 useEffect(()=>{wireRef.current=wireframe
  root.current?.traverse(node=>{
   if(!(node instanceof THREE.Mesh))return
   const materials=Array.isArray(node.material)?node.material:[node.material]
   for(const m of materials)if(m instanceof THREE.MeshStandardMaterial){
    m.wireframe=wireframe
    m.needsUpdate=true
   }
  })
 },[wireframe])
 useEffect(()=>{turnRef.current=turn},[turn])

 useEffect(()=>{
  const el=canvas.current
  if(!el)return
  let disposed=false,scene:THREE.Scene|null=null,renderer:THREE.WebGLRenderer|null=null
  let observer:ResizeObserver|null=null,frame=0
  let loaded:THREE.Object3D|null=null
  let displayRoot:THREE.Group|null=null
  let last=0,lastAngle=0,manualDrag=false,xPrev=0
  const disposables=new Set<THREE.BufferGeometry>()
  const materials=new Set<THREE.Material>()
  const textures=new Set<THREE.Texture>()
  const disposeLoaded=()=>{
   loaded?.traverse(node=>{
    if(!(node instanceof THREE.Mesh))return
    disposables.add(node.geometry)
    const mats=Array.isArray(node.material)?node.material:[node.material]
    for(const mat of mats){
     materials.add(mat)
     for(const prop of Object.values(mat))
      if(prop instanceof THREE.Texture)textures.add(prop)
    }
   })
   for(const t of textures){
    // GLTFLoader may use ImageBitmap; the bitmap is not GC-disposed by
    // texture.dispose(), so close it once on cleanup if possible.
    const image=t.image as {close?:()=>void}|undefined
    if(image&&typeof image.close==='function')image.close()
    t.dispose()
   }
   for(const mat of materials)mat.dispose()
   for(const geo of disposables)geo.dispose()
  }
  const pointerDown=(e:PointerEvent)=>{
   manualDrag=true;xPrev=e.clientX
   el.setPointerCapture?.(e.pointerId)
  }
  const pointerMove=(e:PointerEvent)=>{
   if(!manualDrag)return
   lastAngle+=(e.clientX-xPrev)*0.008
   xPrev=e.clientX
  }
  const pointerUp=()=>{manualDrag=false}
  const onContextLost=(e:Event)=>{
   e.preventDefault();setMessage('انقطع WebGL. أعد فتح المعاينة على الجهاز.')
  }
  el.addEventListener('pointerdown',pointerDown)
  el.addEventListener('pointermove',pointerMove)
  el.addEventListener('pointerup',pointerUp)
  el.addEventListener('pointercancel',pointerUp)
  el.addEventListener('webglcontextlost',onContextLost)
  const run=async()=>{
   try{
    if(file.size>15*1024*1024||file.size<28)
     throw Error('private_preview_glb_size_invalid')
    // The GLB was audited on import. Re-check its own length before decode.
    const bytes=await file.arrayBuffer()
    if(disposed)return
    const view=new DataView(bytes)
    if(view.getUint32(0,true)!==0x46546c67||
     view.getUint32(4,true)!==2||
     view.getUint32(8,true)!==bytes.byteLength)
     throw Error('private_preview_glb_header_invalid')
    renderer=new THREE.WebGLRenderer({
     canvas:el,antialias:true,alpha:false,powerPreference:'low-power',
    })
    renderer.outputColorSpace=THREE.SRGBColorSpace
    renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5))
    renderer.setClearColor(0x111827,1)
    scene=new THREE.Scene()
    scene.background=new THREE.Color(0x111827)
    const camera=new THREE.PerspectiveCamera(36,1,0.02,100)
    const hemi=new THREE.HemisphereLight(0xe5edff,0x1f304d,2)
    scene.add(hemi)
    const light=new THREE.DirectionalLight(0xffffff,2.4)
    light.position.set(3,5,6);scene.add(light)
    const rim=new THREE.DirectionalLight(0x8cbcfb,1.2)
    rim.position.set(-4,2,-5);scene.add(rim)
    const gltf=await new GLTFLoader().parseAsync(bytes,'')
    if(disposed){
     loaded=gltf.scene;disposeLoaded()
     return
    }
    loaded=gltf.scene
    // Apply controls toggled while the WebP textures were decoding.
    loaded.traverse(node=>{
     if(!(node instanceof THREE.Mesh))return
     const mats=Array.isArray(node.material)?node.material:[node.material]
     for(const mat of mats)if(mat instanceof THREE.MeshStandardMaterial)
      mat.wireframe=wireRef.current
    })
    const box=new THREE.Box3().setFromObject(loaded)
    if(box.isEmpty())throw Error('private_preview_empty_geometry')
    const size=box.getSize(new THREE.Vector3())
    const center=box.getCenter(new THREE.Vector3())
    const transform=centeredPreviewTransform(center,size)
    displayRoot=new THREE.Group()
    displayRoot.scale.setScalar(transform.scale)
    displayRoot.position.set(
     transform.offset.x,transform.offset.y,transform.offset.z,
    )
    displayRoot.add(loaded)
    root.current=loaded
    scene.add(displayRoot)
    camera.position.set(0,0,4.5)
    camera.lookAt(0,0,0)
    const redraw=()=>{
     if(!renderer||!canvas.current)return
     const w=Math.max(1,el.clientWidth),h=Math.max(1,el.clientHeight)
     renderer.setSize(w,h,false)
     camera.aspect=w/h;camera.updateProjectionMatrix()
    }
    observer=new ResizeObserver(redraw)
    observer.observe(el);redraw()
    setMessage('معاينة PBR محلية — اسحب لتدوير النموذج')
    const loop=(timestamp:number)=>{
     if(disposed||!renderer||!scene)return
     frame=requestAnimationFrame(loop)
     if(timestamp-last<33||document.visibilityState==='hidden')return
     const dt=last?Math.min((timestamp-last)/1000,0.15):0
     last=timestamp
     if(turnRef.current&&!manualDrag)lastAngle+=dt*.33
     if(displayRoot){
      // The model origin can be off-center; adjust translation as the
      // centered, scaled object rotates so its geometric center stays put.
      displayRoot.rotation.y=lastAngle
      const pivot=center.clone().multiplyScalar(transform.scale)
      pivot.applyAxisAngle(new THREE.Vector3(0,1,0),lastAngle)
      displayRoot.position.set(-pivot.x,-pivot.y,-pivot.z)
     }
     renderer.render(scene,camera)
    }
    frame=requestAnimationFrame(loop)
   }catch(error){
    if(!disposed)setMessage('تعذّر عرض المجسم على هذا الجهاز: '+
     (error instanceof Error?error.message:'viewer_error'))
   }
  }
  void run()
  return ()=>{
   disposed=true;cancelAnimationFrame(frame);observer?.disconnect()
   el.removeEventListener('pointerdown',pointerDown)
   el.removeEventListener('pointermove',pointerMove)
   el.removeEventListener('pointerup',pointerUp)
   el.removeEventListener('pointercancel',pointerUp)
   el.removeEventListener('webglcontextlost',onContextLost)
   root.current=null
   disposeLoaded()
   renderer?.dispose()
  }
 },[file])
 return <section className="rounded-xl border border-cyan-400/25 bg-slate-950/70 p-3"
  aria-label="معاينة GLB محلية خاصة">
  <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
   <p className="text-xs font-bold text-cyan-200">فحص بصري خاص • 360°</p>
   <div className="flex flex-wrap gap-2">
    <button type="button" onClick={()=>setTurn(v=>!v)}
     className="rounded border border-white/25 px-2 py-1 text-xs">
     {turn?'إيقاف الدوران':'دوران تلقائي'}
    </button>
    <button type="button" onClick={()=>setWireframe(v=>!v)}
     className="rounded border border-white/25 px-2 py-1 text-xs">
     {wireframe?'عرض خامات PBR':'عرض الشبكة Wireframe'}
    </button>
   </div>
  </div>
  <canvas ref={canvas} style={{touchAction:'none'}}
   className="h-72 w-full rounded-lg bg-slate-900 sm:h-96"
   aria-label="عارض المجسم الخاص القابل للتدوير"/>
  <p role="status" className="mt-2 text-xs text-slate-300">{message}</p>
  {topologyWarning&&<p className="mt-2 text-xs leading-5 text-amber-200">
   تحذير: توجد مؤشرات هندسية تتطلب مراجعة متخصصة، مثل
   حواف غير منتظمة حسب الفهارس أو تداخلات بعد دمج مواقع الرؤوس.
   لا يعني هذا بالضرورة وجود ثقب مرئي. المعاينة خاصة فقط،
   وغير معتمدة للايف أو فلاتر AR أو الهدايا المدفوعة.
  </p>}
  <p className="mt-1 text-[11px] text-slate-400">
   يعرض الملف من ذاكرة هذا المتصفح دون نشره. لا يثبت جودة Rig أو
   دقة الصورة الأصلية أو سرعة Android.
  </p>
 </section>
}
