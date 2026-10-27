'use client'

import {useEffect,useRef,useState} from 'react'
import * as THREE from 'three'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'
import {
 DEFAULT_IMAGE_PROJECTION,
 getProjectionUVs,inspectStudioImage,REALITY_MAX_IMAGE_PIXELS,
 type RealityImageProjection,type XYBounds,
} from '@/lib/filter-engine/reality-image-projection'
import {parseCanonicalOBJ} from '@/lib/filter-engine/reality-canonical-retarget'

const CANONICAL_FACE='/face-assets/mediapipe-canonical-face-468.obj'
type ImageInfo=Readonly<{width:number;height:number;format:string;extensionMismatch:boolean}>
const download=(blob:Blob,name:string)=>{
 const url=URL.createObjectURL(blob)
 const link=document.createElement('a')
 link.href=url;link.download=name;link.click()
 window.setTimeout(()=>URL.revokeObjectURL(url),3000)
}
export default function RealityImageReference({file}:{file:File}){
 const mount=useRef<HTMLDivElement|null>(null)
 const exportedMesh=useRef<THREE.Mesh|null>(null)
 const positions=useRef<Float32Array|null>(null)
 const bounds=useRef<XYBounds|null>(null)
 const [projection,setProjection]=useState<RealityImageProjection>(DEFAULT_IMAGE_PROJECTION)
 const [imageInfo,setImageInfo]=useState<ImageInfo|null>(null)
 const [error,setError]=useState<string|null>(null)
 const [loading,setLoading]=useState(true)
 const [exporting,setExporting]=useState(false)
 const [wire,setWire]=useState(false)
 const [referenceUrl,setReferenceUrl]=useState<string|null>(null)
 useEffect(()=>{
  const url=URL.createObjectURL(file)
  setReferenceUrl(url)
  return()=>URL.revokeObjectURL(url)
 },[file])
 useEffect(()=>{
  const stage=mount.current
  if(!stage)return
  let cancelled=false,animation=0,mesh:THREE.Mesh|null=null
  setError(null);setLoading(true);setImageInfo(null)
  exportedMesh.current=null;positions.current=null;bounds.current=null
  const scene=new THREE.Scene()
  scene.background=new THREE.Color(0x141c2b)
  const camera=new THREE.PerspectiveCamera(35,1,.001,10)
  camera.position.set(0,0,.47)
  const renderer=new THREE.WebGLRenderer({antialias:true})
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2))
  renderer.outputColorSpace=THREE.SRGBColorSpace
  renderer.toneMapping=THREE.ACESFilmicToneMapping
  renderer.toneMappingExposure=1
  stage.appendChild(renderer.domElement)
  const controls=new OrbitControls(camera,renderer.domElement)
  controls.enableDamping=true
  controls.minDistance=.25;controls.maxDistance=1
  scene.add(new THREE.HemisphereLight(0xffffff,0x455b73,2))
  const key=new THREE.DirectionalLight(0xffefd4,2)
  key.position.set(-1,2,2);scene.add(key)
  const resize=()=>{
   const w=Math.max(180,stage.clientWidth),h=Math.max(250,stage.clientHeight)
   renderer.setSize(w,h,false)
   camera.aspect=w/h;camera.updateProjectionMatrix()
  }
  const observer=new ResizeObserver(resize)
  observer.observe(stage);resize()
  const run=async()=>{
   let imageBitmap:ImageBitmap|null=null
   try{
    const info=await inspectStudioImage(file)
    // Use detected header, not the file extension: user-provided .png files
    // can contain actual JPEG bytes and still decode correctly.
    const image=new Blob([file],{type:'image/'+info.format})
    imageBitmap=await createImageBitmap(image)
    if(imageBitmap.width*imageBitmap.height>REALITY_MAX_IMAGE_PIXELS)
     throw Error('Image resolution exceeds the 16-megapixel authoring limit.')
    const dimension=Math.min(1536/Math.max(imageBitmap.width,imageBitmap.height),1)
    const texCanvas=document.createElement('canvas')
    texCanvas.width=Math.max(1,Math.round(imageBitmap.width*dimension))
    texCanvas.height=Math.max(1,Math.round(imageBitmap.height*dimension))
    const texCtx=texCanvas.getContext('2d',{alpha:true})
    if(!texCtx)throw Error('Image decoding canvas unavailable.')
    texCtx.drawImage(imageBitmap,0,0,texCanvas.width,texCanvas.height)
    setImageInfo({width:imageBitmap.width,height:imageBitmap.height,
     format:info.format,extensionMismatch:info.extensionMismatch})
    const response=await fetch(CANONICAL_FACE,{cache:'force-cache'})
    if(!response.ok)throw Error('Canonical 468-vertex face could not be loaded.')
    const canonical=parseCanonicalOBJ(await response.text())
    if(canonical.vertices.length!==468)
     throw Error('Canonical face must contain 468 reference vertices.')
    const vertices=new Float32Array(canonical.vertices.flat())
    const geometry=new THREE.BufferGeometry()
    const pos=new THREE.Float32BufferAttribute(vertices,3)
    geometry.setAttribute('position',pos)
    geometry.setIndex(canonical.triangles.flat())
    geometry.computeVertexNormals()
    geometry.computeBoundingBox()
    const bb=geometry.boundingBox!
    const xyBounds:XYBounds={
     minX:bb.min.x,maxX:bb.max.x,minY:bb.min.y,maxY:bb.max.y,
    }
    geometry.setAttribute('uv',new THREE.BufferAttribute(
     getProjectionUVs(vertices,xyBounds,DEFAULT_IMAGE_PROJECTION),2))
    const center=bb.getCenter(new THREE.Vector3())
    geometry.translate(-center.x,-center.y,-center.z)
    const texture=new THREE.CanvasTexture(texCanvas)
    texture.colorSpace=THREE.SRGBColorSpace
    texture.wrapS=texture.wrapT=THREE.ClampToEdgeWrapping
    texture.minFilter=THREE.LinearMipmapLinearFilter
    texture.magFilter=THREE.LinearFilter
    texture.anisotropy=Math.min(4,renderer.capabilities.getMaxAnisotropy())
    const material=new THREE.MeshStandardMaterial({
     map:texture,roughness:.9,metalness:0,side:THREE.DoubleSide,
     transparent:true,alphaTest:.05,
    })
    const newMesh=new THREE.Mesh(geometry,material)
    // MediaPipe neutral geometry is authored in CENTIMETERS, never an
    // exact measurement of the person's face in the uploaded photograph.
    newMesh.scale.setScalar(.01)
    if(cancelled){
     geometry.dispose();material.dispose();texture.dispose()
     return
    }
    mesh=newMesh;scene.add(newMesh)
    exportedMesh.current=newMesh
    positions.current=vertices
    bounds.current=xyBounds
    setLoading(false)
   }catch(e){
    if(!cancelled)setError(e instanceof Error?e.message:String(e))
    if(!cancelled)setLoading(false)
   }finally{imageBitmap?.close()}
  }
  void run()
  const render=()=>{
   if(cancelled)return
   animation=requestAnimationFrame(render)
   controls.update()
   renderer.render(scene,camera)
  }
  render()
  return()=>{
   cancelled=true;cancelAnimationFrame(animation);observer.disconnect()
   controls.dispose()
   exportedMesh.current=null;positions.current=null;bounds.current=null
   if(mesh){
    mesh.geometry.dispose()
    const material=mesh.material as THREE.MeshStandardMaterial
    material.map?.dispose();material.dispose()
   }
   renderer.dispose();renderer.domElement.remove()
  }
 },[file])
 useEffect(()=>{
  const model=exportedMesh.current
  if(!model||!positions.current||!bounds.current)return
  const uv=getProjectionUVs(positions.current,bounds.current,projection)
  model.geometry.setAttribute('uv',new THREE.BufferAttribute(uv,2))
 },[projection,loading])
 useEffect(()=>{
  const material=exportedMesh.current?.material as THREE.MeshStandardMaterial|undefined
  if(material)material.wireframe=wire
 },[wire,loading])
 const changeProjection=(patch:Partial<RealityImageProjection>)=>
  setProjection(old=>({...old,...patch}))
 const exportPreview=async()=>{
  const model=exportedMesh.current
  if(!model||exporting)return
  setExporting(true);setError(null)
  try{
   const {GLTFExporter}=await import('three/addons/exporters/GLTFExporter.js')
   const exporter=new GLTFExporter()
   const exported=await new Promise<ArrayBuffer>((resolve,reject)=>{
    exporter.parse(model,output=>{
     if(output instanceof ArrayBuffer)resolve(output)
     else reject(Error('A binary GLB export was expected.'))
    },reject,{binary:true,onlyVisible:true,maxTextureSize:1536})
   })
   const label=file.name.replace(/\.(?:png|jpe?g|webp)$/i,'')
    .replace(/[^\w-]+/g,'-').slice(0,60)||'face-reference'
   download(new Blob([exported],{type:'model/gltf-binary'}),label+'-canonical-preview.glb')
  }catch(e){
   setError('GLB export failed: '+String(e))
  }finally{setExporting(false)}
 }
 const slider=(title:string,key:'zoom'|'shiftX'|'shiftY',min:number,max:number,step:number)=>(
  <label className="block space-y-1 text-xs text-slate-300">
   <span className="flex justify-between"><span>{title}</span>
    <span className="font-mono text-cyan-200">{projection[key].toFixed(2)}</span></span>
   <input className="w-full accent-cyan-400" type="range"
    min={min} max={max} step={step} value={projection[key]}
    onChange={e=>changeProjection({[key]:Number(e.target.value)})}/>
  </label>
 )
 return(
  <div dir="rtl" className="space-y-3 p-3 sm:p-4">
   <p className="text-sm font-bold text-white">معاينة الصور والخامات — تحويل تقريبي إلى نموذج مرجعي 3D</p>
   <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
    <div className="space-y-1">
     <div className="flex min-h-[250px] items-center justify-center overflow-hidden rounded-xl border border-slate-700 bg-slate-900">
      {referenceUrl&&<img src={referenceUrl} alt="Original uploaded 2D reference" className="max-h-[370px] w-full object-contain"/>}
     </div>
     <p className="text-center text-xs text-slate-400">الصورة الأصلية (2D)</p>
    </div>
    <div className="space-y-1">
     <div ref={mount} className="h-[330px] overflow-hidden rounded-xl border border-slate-700 bg-slate-950 sm:h-[370px]" aria-label="Approximate canonical 3D face"/>
     <p className="text-center text-xs text-slate-400">نموذج MediaPipe ثلاثي الأبعاد بخامة أمامية تقريبية</p>
    </div>
   </div>
   <div className="grid gap-3 rounded-xl border border-slate-700 bg-slate-900/80 p-3 sm:grid-cols-3">
    {slider('تكبير الخامة','zoom',.5,2.5,.05)}
    {slider('الإزاحة الأفقية','shiftX',-.5,.5,.01)}
    {slider('الإزاحة الرأسية','shiftY',-.5,.5,.01)}
    <label className="flex items-center gap-2 text-xs text-white">
     <input type="checkbox" checked={projection.mirror}
      onChange={e=>changeProjection({mirror:e.target.checked})}/> عكس الخامة أفقيًا
    </label>
    <label className="flex items-center gap-2 text-xs text-white">
     <input type="checkbox" checked={wire}
      onChange={e=>setWire(e.target.checked)}/> عرض مثلثات المجسم
    </label>
    <button type="button" disabled={loading||exporting||!!error}
     className="rounded-lg bg-cyan-500 px-3 py-2 text-sm font-semibold text-slate-950 disabled:opacity-40"
     onClick={exportPreview}>
     {exporting?'يتم تصدير GLB...':'تصدير نموذج GLB تجريبي'}
    </button>
   </div>
   <p className="text-xs leading-6 text-slate-300">
    {loading?'تحميل نموذج الوجه وإعداد الخامة...':
     imageInfo?`ملف ${imageInfo.format.toUpperCase()} • ${imageInfo.width}×${imageInfo.height} بكسل`:'لا توجد معاينة بعد.'}
    {imageInfo?.extensionMismatch&&' • تم اكتشاف اختلاف نوع الصورة عن امتداد الملف وتصحيحه تلقائيًا.'}
   </p>
   {error&&<p role="alert" className="rounded-lg border border-red-600 p-2 text-sm text-red-300">{error}</p>}
   <p className="text-xs leading-6 text-amber-200">
    هذه صورة مسطحة أُسقطت على نموذج وجه قياسي؛ ملف GLB الناتج يحتوي على مجسم فعلي
    لكنه ليس مسحًا ثلاثي الأبعاد للوجه الظاهر بالصورة ولا يملك حركة الرموش أو الشعر.
    الصور ذات العلامات المائية تتطلب إذن استخدام قبل النشر التجاري. الملفات تبقى داخل متصفحك.
   </p>
  </div>
 )
}
