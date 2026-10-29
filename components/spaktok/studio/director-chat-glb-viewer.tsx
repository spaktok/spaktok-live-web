'use client'
import {useEffect,useRef,useState} from 'react'
import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {OrbitControls} from 'three/addons/controls/OrbitControls.js'

function disposeModel(root:THREE.Object3D){
 const meshes=new Set<THREE.BufferGeometry>()
 const materials=new Set<THREE.Material>()
 const textures=new Set<THREE.Texture>()
 root.traverse(node=>{
  if(!(node instanceof THREE.Mesh))return
  meshes.add(node.geometry)
  for(const mat of Array.isArray(node.material)?node.material:[node.material]){
   materials.add(mat)
   for(const val of Object.values(mat))
    if(val instanceof THREE.Texture)textures.add(val)
  }
 })
 meshes.forEach(x=>x.dispose())
 materials.forEach(x=>x.dispose())
 textures.forEach(x=>x.dispose())
}
/** GPU-independent interactive 3D attachment embedded in a Director chat
 * message. All GLB data stays in the current browser; no public upload.
 */
export default function DirectorChatGlbViewer({
 file,
}:Readonly<{file:File}>){
 const canvasRef=useRef<HTMLCanvasElement|null>(null)
 const [status,setStatus]=useState('تحميل المجسم ثلاثي الأبعاد…')
 useEffect(()=>{
  const canvas=canvasRef.current
  if(!canvas)return
  let renderer:THREE.WebGLRenderer
  try{
   renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'low-power'})
  }catch{setStatus('WebGL غير متوفر؛ لا يزال ملف GLB قابلًا للتنزيل.');return}
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5))
  renderer.outputColorSpace=THREE.SRGBColorSpace
  const scene=new THREE.Scene()
  scene.background=new THREE.Color(0x0c1628)
  const camera=new THREE.PerspectiveCamera(42,1,0.02,200)
  camera.position.set(1.5,1,3)
  const controls=new OrbitControls(camera,canvas)
  controls.enableDamping=true
  controls.autoRotate=true
  controls.autoRotateSpeed=0.8
  scene.add(new THREE.HemisphereLight(0xf2f6ff,0x46577c,2))
  const sun=new THREE.DirectionalLight(0xffffff,2.3)
  sun.position.set(3,5,4);scene.add(sun)
  const resize=()=>{
   const width=Math.max(1,canvas.clientWidth)
   const height=Math.max(1,canvas.clientHeight)
   renderer.setSize(width,height,false)
   camera.aspect=width/height
   camera.updateProjectionMatrix()
  }
  const observer=new ResizeObserver(resize)
  observer.observe(canvas);resize()
  let model:THREE.Object3D|null=null
  let canceled=false,frame=0,last=0
  const draw=(time:number)=>{
   if(canceled)return
   if(!document.hidden&&time-last>1000/30){
    controls.update()
    renderer.render(scene,camera)
    last=time
   }
   frame=requestAnimationFrame(draw)
  }
  frame=requestAnimationFrame(draw)
  void (async()=>{
   try{
    if(file.size>15*1024*1024||file.size<28)
     throw Error('الملف خارج حدود معاينة الهاتف')
    const bytes=await file.arrayBuffer()
    if(canceled)return
    const gltf=await new GLTFLoader().parseAsync(bytes,'')
    if(canceled){disposeModel(gltf.scene);return}
    const bounds=new THREE.Box3().setFromObject(gltf.scene)
    const size=new THREE.Vector3()
    const center=new THREE.Vector3()
    bounds.getSize(size);bounds.getCenter(center)
    const max=Math.max(size.x,size.y,size.z)
    if(bounds.isEmpty()||!Number.isFinite(max)||max<.000001){
     disposeModel(gltf.scene);throw Error('هندسة غير صالحة للعرض')
    }
    gltf.scene.position.sub(center)
    gltf.scene.scale.setScalar(1.65/max)
    scene.add(gltf.scene);model=gltf.scene
    camera.position.set(2.2,1.3,2.8)
    camera.lookAt(0,0,0)
    controls.target.set(0,0,0)
    controls.update()
    setStatus('معاينة خاصة · اسحب لتدوير المجسم أو كبّر بإصبعين')
   }catch(error){
    if(!canceled)setStatus('تعذّرت المعاينة: '+String(error))
   }
  })()
  return()=>{
   canceled=true;cancelAnimationFrame(frame);observer.disconnect()
   controls.dispose()
   if(model){scene.remove(model);disposeModel(model)}
   renderer.dispose()
  }
 },[file])
 return <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#0c1628]">
  <canvas ref={canvasRef} aria-label="معاينة مجسم Spaktok ثلاثي الأبعاد قابلة للدوران"
   className="h-64 w-full touch-pan-y sm:h-80"/>
  <p className="border-t border-white/10 px-3 py-2 text-[11px] text-slate-300">{status}</p>
 </div>
}
