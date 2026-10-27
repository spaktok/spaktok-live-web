'use client'

import {useEffect,useMemo,useRef,useState,type ChangeEvent} from 'react'
import * as THREE from 'three'
import type {FaceLandmarker} from '@mediapipe/tasks-vision'
import {loadFaceLandmarker} from '@/lib/filter-engine/vision'
import {resolveRealityAnchor} from '@/lib/filter-engine/reality-effect-anchors'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js'
import {REALITY_SHARED_GRADE_OPTIONS} from '@/lib/filter-engine/reality-unified-profile'
import {createRealityVideoGrade,setRealityVideoGrade} from '@/lib/filter-engine/reality-video-grade'
import {
 assertSelfContainedVideo3DGlb,createVideo3DLayer,createVideo3DProject,
 sampleVideo3DLayer,upsertVideo3DFrame,validateVideo3DProject,
 video3DOutputSize,VIDEO_3D_MAX_VIDEO_BYTES,VIDEO_3D_MAX_GLB_BYTES,
 VIDEO_3D_MAX_DURATION_MS,VIDEO_3D_MAX_LAYERS,DEFAULT_VIDEO_3D_FRAME,
 type Video3DProject,type Video3DLayer,type Video3DKind,
 type Video3DFrame,type Video3DFrameProperty,type Video3DAttachment,
} from '@/lib/filter-engine/reality-video3d-project'

const kinds:{kind:Exclude<Video3DKind,'glb'>;title:string}[]=[
 {kind:'box',title:'مكعب 3D'},{kind:'sphere',title:'كرة 3D'},
 {kind:'torus',title:'حلقة 3D'},{kind:'cone',title:'مخروط 3D'},
 {kind:'octahedron',title:'بلورة 3D'},
]
const tools:{key:Video3DFrameProperty;label:string;min:number;max:number;step:number}[]=[
 {key:'x',label:'أفقي X',min:-.5,max:.5,step:.005},
 {key:'y',label:'عمودي Y',min:-.5,max:.5,step:.005},
 {key:'scale',label:'الحجم',min:.02,max:1.5,step:.01},
 {key:'rotationX',label:'دوران X',min:-360,max:360,step:1},
 {key:'rotationY',label:'دوران Y',min:-360,max:360,step:1},
 {key:'rotationZ',label:'دوران Z',min:-360,max:360,step:1},
 {key:'opacity',label:'الشفافية',min:0,max:1,step:.01},
]

type Stage={
 renderer:THREE.WebGLRenderer;scene:THREE.Scene;camera:THREE.OrthographicCamera
 background:THREE.Mesh;texture:THREE.VideoTexture
 holders:Map<string,THREE.Group>;primitiveIds:Set<string>
 aspect:number
}
const fileDownload=(blob:Blob,name:string)=>{
 const url=URL.createObjectURL(blob)
 const a=document.createElement('a')
 a.href=url;a.download=name
 document.body.append(a);a.click();a.remove()
 window.setTimeout(()=>URL.revokeObjectURL(url),15_000)
}
function disposeObject(object:THREE.Object3D){
 object.traverse(node=>{
  if(!(node instanceof THREE.Mesh))return
  node.geometry.dispose()
  const materials=Array.isArray(node.material)?node.material:[node.material]
  for(const material of materials){
   for(const value of Object.values(material)){
    if(value instanceof THREE.Texture)value.dispose()
   }
   material.dispose()
  }
 })
}
function primitiveGeometry(kind:Exclude<Video3DKind,'glb'>):THREE.BufferGeometry{
 switch(kind){
  case 'box':return new THREE.BoxGeometry(1,1,1)
  case 'sphere':return new THREE.SphereGeometry(.55,32,24)
  case 'torus':return new THREE.TorusGeometry(.40,.14,18,48)
  case 'cone':return new THREE.ConeGeometry(.52,1,32)
  case 'octahedron':return new THREE.OctahedronGeometry(.65,0)
 }
}
function createHolder(layer:Video3DLayer,asset:THREE.Group|undefined){
 const holder=new THREE.Group()
 if(layer.kind==='glb'){
  if(asset)holder.add(asset)
 }else{
  const material=new THREE.MeshStandardMaterial({
   color:layer.color,metalness:.45,roughness:.25,
   side:THREE.DoubleSide,transparent:true,
  })
  holder.add(new THREE.Mesh(primitiveGeometry(layer.kind),material))
 }
 return holder
}
const videoDuration=(ms:number)=> (ms/1000).toFixed(2)+'s'
const safeName=(name:string)=>name.replace(/[^a-z0-9_-]/gi,'-').slice(0,50)||'spaktok'
const clamp=(n:number,a:number,b:number)=>Math.min(b,Math.max(a,n))

export default function RealityVideo3DStudio(){
 const stageRef=useRef<HTMLDivElement|null>(null)
 const videoRef=useRef<HTMLVideoElement|null>(null)
 const stageEngine=useRef<Stage|null>(null)
 const videoFaceTracker=useRef<FaceLandmarker|null>(null)
 const trackedFace=useRef<{landmarks:{x:number;y:number;z:number}[];at:number}|null>(null)
 const trackingWanted=useRef(false)
 const lastVideoInference=useRef(0)
 const [videoTrackingStatus,setVideoTrackingStatus]=useState<'off'|'loading'|'ready'|'error'>('off')
 const uploadedAssets=useRef(new Map<string,THREE.Group>())
 const videoURL=useRef<string|null>(null)
 const recorderRef=useRef<MediaRecorder|null>(null)
 const recordingStream=useRef<MediaStream|null>(null)
 const projectRef=useRef<Video3DProject>(createVideo3DProject())
 const currentMsRef=useRef(0)
 const [project,setProject]=useState<Video3DProject>(createVideo3DProject)
 const [selected,setSelected]=useState<string|null>(null)
 const [currentMs,setCurrentMs]=useState(0)
 const [playing,setPlaying]=useState(false)
 const [recording,setRecording]=useState(false)
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('أنشئ مجسمًا أو حمّل فيديو لتجربة وضعه فوق المشهد.')
 const [assetErrors,setAssetErrors]=useState<string|null>(null)
 const currentLayer=project.layers.find(x=>x.id===selected)??null
 const duration=project.source?.durationMs??10_000
 const currentFrame=useMemo(()=>
  currentLayer?sampleVideo3DLayer(currentLayer,currentMs):DEFAULT_VIDEO_3D_FRAME,
 [currentLayer,currentMs])
 const layerSignature=project.layers.map(layer=>layer.id+':'+layer.kind+':'+(layer.assetName??'')).join('|')
 const needsTrackedFace=project.layers.some(layer=>layer.anchor!=='screen')
 useEffect(()=>{trackingWanted.current=needsTrackedFace},[needsTrackedFace])
 useEffect(()=>{
  if(!needsTrackedFace){trackedFace.current=null;setVideoTrackingStatus('off');return}
  let cancelled=false
  setVideoTrackingStatus('loading')
  loadFaceLandmarker().then(model=>{
   if(cancelled)return
   videoFaceTracker.current=model
   setVideoTrackingStatus('ready')
  }).catch(()=>{
   if(cancelled)return
   videoFaceTracker.current=null
   setVideoTrackingStatus('error')
  })
  return()=>{cancelled=true}
 },[needsTrackedFace])
 useEffect(()=>{
  const material=stageEngine.current?.background.material
  if(material instanceof THREE.ShaderMaterial)
   setRealityVideoGrade(material,project.colorPresetId)
 },[project.colorPresetId])
 useEffect(()=>{projectRef.current=project},[project])

 useEffect(()=>{
  const host=stageRef.current,video=videoRef.current
  if(!host||!video)return
  let disposed=false,raf=0,lastUi=-999
  const scene=new THREE.Scene()
  scene.background=new THREE.Color(0x101827)
  const aspect=9/16
  const camera=new THREE.OrthographicCamera(-aspect/2,aspect/2,.5,-.5,.01,40)
  camera.position.z=5
  const renderer=new THREE.WebGLRenderer({alpha:false,antialias:true,preserveDrawingBuffer:false})
  renderer.setPixelRatio(1)
  renderer.setSize(540,960,false)
  renderer.outputColorSpace=THREE.SRGBColorSpace
  renderer.toneMapping=THREE.NoToneMapping
  renderer.domElement.style.width='100%'
  renderer.domElement.style.height='100%'
  renderer.domElement.style.objectFit='contain'
  host.appendChild(renderer.domElement)
  const texture=new THREE.VideoTexture(video)
  texture.colorSpace=THREE.SRGBColorSpace
  texture.minFilter=THREE.LinearFilter
  texture.magFilter=THREE.LinearFilter
  const bg=new THREE.Mesh(new THREE.PlaneGeometry(aspect,1),
   createRealityVideoGrade(texture))
  bg.position.z=-.2
  bg.visible=false
  scene.add(bg)
  scene.add(new THREE.HemisphereLight(0xffffff,0x415178,2.2))
  const light=new THREE.DirectionalLight(0xffffff,2.6)
  light.position.set(-2,3,5);scene.add(light)
  setRealityVideoGrade(bg.material as THREE.ShaderMaterial,projectRef.current.colorPresetId)
  const stage:Stage={renderer,scene,camera,background:bg,texture,
   holders:new Map(),primitiveIds:new Set(),aspect}
  stageEngine.current=stage
  const render=(time:number)=>{
   if(disposed)return
   const current=video.currentTime*1000||0
   currentMsRef.current=current
   if(time-lastUi>75){
    lastUi=time;setCurrentMs(current)
   }
   const state=projectRef.current
   if(trackingWanted.current&&videoFaceTracker.current&&video.readyState>=2&&
    video.videoWidth>0&&time-lastVideoInference.current>100){
    lastVideoInference.current=time
    try{
     const found=videoFaceTracker.current.detectForVideo(video,time)
     const landmarks=found.faceLandmarks[0]
     trackedFace.current=landmarks?.length===478
      ?{landmarks:landmarks.map(p=>({x:p.x,y:p.y,z:p.z})),at:time}:null
    }catch{trackedFace.current=null}
   }
   for(const layer of state.layers){
    const root=stage.holders.get(layer.id)
    if(!root)continue
    const f=sampleVideo3DLayer(layer,current)
    let x=f.x*stage.aspect,y=-f.y
    if(layer.anchor!=='screen'){
     const face=trackedFace.current
     // Lost tracking: hide model, never leave a frozen prop on someone else's face.
     if(!face||time-face.at>375||!video.videoWidth||!video.videoHeight){
      root.visible=false;continue
     }
     const anchor=resolveRealityAnchor(layer.anchor,face.landmarks,
      video.videoWidth,video.videoHeight,
      renderer.domElement.width,renderer.domElement.height,false)
     if(!anchor){root.visible=false;continue}
     x+=(anchor.x/renderer.domElement.width-.5)*stage.aspect
     y+=.5-anchor.y/renderer.domElement.height
    }
    root.position.set(x,y,.5)
    root.rotation.set(
     THREE.MathUtils.degToRad(f.rotationX),
     THREE.MathUtils.degToRad(f.rotationY),
     THREE.MathUtils.degToRad(f.rotationZ),
    )
    root.scale.setScalar(f.scale)
    root.visible=f.opacity>0
    root.traverse(node=>{
     if(!(node instanceof THREE.Mesh))return
     const materials=Array.isArray(node.material)?node.material:[node.material]
     for(const material of materials){
      if(!(material instanceof THREE.MeshStandardMaterial)&&
       !(material instanceof THREE.MeshPhysicalMaterial))continue
      if(stage.primitiveIds.has(layer.id))material.color.set(layer.color)
      if(material.userData.originalOpacity===undefined)
       material.userData.originalOpacity=material.opacity
      material.opacity=(material.userData.originalOpacity as number)*f.opacity
      material.transparent=true
     }
    })
   }
   renderer.render(scene,camera)
   raf=requestAnimationFrame(render)
  }
  raf=requestAnimationFrame(render)
  return ()=>{
   disposed=true;cancelAnimationFrame(raf)
   for(const [id,node] of stage.holders){
    scene.remove(node)
    if(stage.primitiveIds.has(id))disposeObject(node)
   }
   stage.holders.clear()
   bg.geometry.dispose()
   ;(bg.material as THREE.Material).dispose()
   texture.dispose()
   renderer.dispose()
   renderer.domElement.remove()
   stageEngine.current=null
  }
 },[])

 useEffect(()=>{
  const s=stageEngine.current
  if(!s)return
  const known=new Set(project.layers.map(l=>l.id))
  for(const [id,object] of s.holders){
   if(known.has(id))continue
   s.scene.remove(object)
   if(s.primitiveIds.has(id))disposeObject(object)
   s.primitiveIds.delete(id);s.holders.delete(id)
  }
  for(const layer of project.layers){
   if(s.holders.has(layer.id))continue
   const holder=createHolder(layer,uploadedAssets.current.get(layer.id))
   s.holders.set(layer.id,holder)
   if(layer.kind!=='glb')s.primitiveIds.add(layer.id)
   s.scene.add(holder)
  }
 },[layerSignature,project.layers.length])

 useEffect(()=>()=>{
  recorderRef.current?.state==='recording'&&recorderRef.current.stop()
  recordingStream.current?.getTracks().forEach(track=>track.stop())
  if(videoURL.current)URL.revokeObjectURL(videoURL.current)
  for(const asset of uploadedAssets.current.values())disposeObject(asset)
  uploadedAssets.current.clear()
 },[])

 const syncStageSize=(width:number,height:number)=>{
  const s=stageEngine.current
  if(!s)return
  const dims=video3DOutputSize(width,height)
  s.aspect=dims.width/dims.height
  s.camera.left=-s.aspect/2;s.camera.right=s.aspect/2
  s.camera.top=.5;s.camera.bottom=-.5
  s.camera.updateProjectionMatrix()
  s.background.geometry.dispose()
  s.background.geometry=new THREE.PlaneGeometry(s.aspect,1)
  s.background.visible=true
  s.renderer.setSize(dims.width,dims.height,false)
 }
 const importVideo=async(e:ChangeEvent<HTMLInputElement>)=>{
  const file=e.target.files?.[0]
  e.target.value=''
  const video=videoRef.current
  if(!file||!video)return
  if(file.size>VIDEO_3D_MAX_VIDEO_BYTES||file.size<100||
   !(/video\//.test(file.type)||/\.(mp4|mov|m4v|webm)$/i.test(file.name))){
   setMessage('الفيديو غير مدعوم أو أكبر من 250 MB. جرّب MP4 أو WebM.')
   return
  }
  const url=URL.createObjectURL(file),old=videoURL.current
  video.pause()
  video.removeAttribute('src')
  video.src=url
  video.load()
  setBusy(true)
  try{
   await new Promise<void>((resolve,reject)=>{
    video.onloadedmetadata=()=>resolve()
    video.onerror=()=>reject(Error('browser_cannot_decode_video'))
   })
   const durationMs=Math.round(video.duration*1000)
   if(!Number.isFinite(durationMs)||durationMs<1||
    durationMs>VIDEO_3D_MAX_DURATION_MS||
    !video.videoWidth||!video.videoHeight||
    video.videoWidth>8192||video.videoHeight>8192)
    throw Error('video_exceeds_120s_or_invalid_dimensions')
   videoURL.current=url
   trackedFace.current=null
   if(old)URL.revokeObjectURL(old)
   setProject(prev=>({...prev,source:{
    name:file.name,width:video.videoWidth,height:video.videoHeight,durationMs,
   },layers:prev.layers.map(l=>({
    ...l,keyframes:l.keyframes.filter(k=>k.timeMs<=durationMs),
   }))}))
   syncStageSize(video.videoWidth,video.videoHeight)
   video.currentTime=0
   setMessage('الفيديو في المتصفح فقط. أضف مجسمات وغيّر خصائصها عند لحظات مختلفة.')
  }catch(error){
   URL.revokeObjectURL(url)
   video.removeAttribute('src')
   video.load()
   if(old){video.src=old;video.load()}
   setMessage('تعذر فتح الفيديو: '+String(error))
  }finally{setBusy(false);video.onloadedmetadata=null;video.onerror=null}
 }

 const addShape=(kind:Exclude<Video3DKind,'glb'>)=>{
  if(project.layers.length>=VIDEO_3D_MAX_LAYERS){setMessage('حد المجسمات 12 في المسودة.');return}
  const id='model-'+Date.now().toString(36)
  const layer=createVideo3DLayer(id,kind,kinds.find(k=>k.kind===kind)?.title)
  setProject(prev=>({...prev,layers:[...prev.layers,layer]}))
  setSelected(id)
 }
 const importGlb=async(e:ChangeEvent<HTMLInputElement>)=>{
  const file=e.target.files?.[0];e.target.value=''
  if(!file)return
  if(!/\.glb$/i.test(file.name)||file.size>VIDEO_3D_MAX_GLB_BYTES||
   project.layers.length>=VIDEO_3D_MAX_LAYERS){
   setAssetErrors('يُسمح بملفات GLB ذاتية الاكتفاء حتى 15 MB وبحد أقصى 12 مجسمًا.')
   return
  }
  setBusy(true);setAssetErrors(null)
  try{
   const bytes=await file.arrayBuffer()
   assertSelfContainedVideo3DGlb(bytes)
   const scene=await new Promise<THREE.Group>((resolve,reject)=>
    new GLTFLoader().parse(bytes,'',gltf=>resolve(gltf.scene),reject))
   let triangles=0
   scene.traverse(child=>{
    if(child instanceof THREE.Mesh){
     const g=child.geometry
     triangles+=(g.index?g.index.count:g.getAttribute('position')?.count??0)/3
    }
   })
   const bounds=new THREE.Box3().setFromObject(scene)
   const size=bounds.getSize(new THREE.Vector3())
   const diameter=Math.max(size.x,size.y,size.z)
   if(!Number.isFinite(diameter)||diameter<.001||triangles>150_000||triangles<1)
    throw Error('GLB_geometry_invalid_or_over_150k_triangles')
   const center=bounds.getCenter(new THREE.Vector3())
   const normalized=new THREE.Group()
   scene.position.sub(center)
   normalized.scale.setScalar(1/diameter)
   normalized.add(scene)
   const id='model-'+Date.now().toString(36)
   uploadedAssets.current.set(id,normalized)
   setProject(prev=>({...prev,layers:[...prev.layers,
    createVideo3DLayer(id,'glb',file.name.slice(0,72),file.name)]}))
   setSelected(id)
   setMessage('تم استيراد المجسم محليًا وتوحيد حجمه؛ لن يُرفع إلى الخادم.')
  }catch(error){
   setAssetErrors('فشل تحميل GLB: '+String(error))
  }finally{setBusy(false)}
 }
 const deleteLayer=()=>{
  if(!currentLayer)return
  const id=currentLayer.id
  setProject(prev=>({...prev,layers:prev.layers.filter(l=>l.id!==id)}))
  setSelected(null)
  const asset=uploadedAssets.current.get(id)
  if(asset){
   const stage=stageEngine.current,holder=stage?.holders.get(id)
   if(holder){stage?.scene.remove(holder);stage?.holders.delete(id)}
   disposeObject(asset);uploadedAssets.current.delete(id)
  }
 }
 const seek=(ms:number)=>{
  const video=videoRef.current
  const t=clamp(ms,0,duration)
  if(video&&project.source){
   video.currentTime=t/1000
  }
  currentMsRef.current=t;setCurrentMs(t)
 }
 const playPause=async()=>{
  const video=videoRef.current
  if(!video||!project.source||recording)return
  if(video.paused){
   try{await video.play();setPlaying(true)}
   catch{setMessage('تعذر تشغيل الفيديو في هذا المتصفح.')}
  }else{video.pause();setPlaying(false)}
 }
 const putFrame=(patch:Partial<Video3DFrame>)=>{
  if(!currentLayer)return
  const timeMs=Math.round(currentMsRef.current)
  const updated={...sampleVideo3DLayer(currentLayer,timeMs),...patch,timeMs}
  try{
   setProject(prev=>({...prev,layers:prev.layers.map(l=>l.id===currentLayer.id
    ?upsertVideo3DFrame(l,updated,duration):l)}))
  }catch(error){setMessage('تعذر إضافة نقطة التحريك: '+String(error))}
 }
 const updateAttachment=(anchor:Video3DAttachment)=>{
  trackedFace.current=null
  setProject(prev=>({...prev,layers:prev.layers.map(layer=>
   layer.id===selected?{...layer,anchor}:layer)}))
 }
 const updateColor=(color:string)=>{
  setProject(prev=>({...prev,layers:prev.layers.map(layer=>
   layer.id===selected?{...layer,color}:layer)}))
 }
 const exportProject=()=>{
  try{
   validateVideo3DProject(project)
   const data=JSON.stringify({...project,
    notice:'Local media and GLB bytes are not included; reimport them to continue editing.',
   },null,2)
   fileDownload(new Blob([data],{type:'application/json'}),
    safeName(project.name)+'-video-3d.draft.json')
   setMessage('تم تصدير مشروع JSON؛ أعد اختيار ملفات الفيديو وGLB عند فتحه لاحقًا.')
  }catch(e){setMessage('تعذر تصدير المشروع: '+String(e))}
 }
 const exportSelectedGlb=()=>{
  if(!currentLayer||currentLayer.kind==='glb'){
   setMessage('تصدير GLB متاح للأشكال المنشأة في الاستوديو. ملف GLB المستورد احتفظ به محليًا.');return
  }
  const root=createHolder(currentLayer,undefined)
  new GLTFExporter().parse(root,result=>{
   if(result instanceof ArrayBuffer){
    fileDownload(new Blob([result],{type:'model/gltf-binary'}),
     safeName(currentLayer.name)+'.glb')
    setMessage('تم إنشاء ملف GLB مستقل للمجسم من الاستوديو.')
   }
   disposeObject(root)
  },error=>{disposeObject(root);setMessage('فشل التصدير: '+String(error))},{binary:true,onlyVisible:true})
 }
 const stopRecording=()=>{
  const recorder=recorderRef.current
  if(recorder?.state==='recording')recorder.stop()
  videoRef.current?.pause()
  setPlaying(false)
 }
 const exportWebm=async()=>{
  const video=videoRef.current,stage=stageEngine.current
  if(!video||!stage||!project.source||recording)return
  if(typeof MediaRecorder==='undefined'||typeof stage.renderer.domElement.captureStream!=='function'){
   setMessage('المتصفح لا يدعم تسجيل Canvas. جرّب Chrome على الحاسوب.');return
  }
  const mime=['video/webm;codecs=vp9','video/webm;codecs=vp8','video/webm']
   .find(type=>MediaRecorder.isTypeSupported(type))
  if(!mime){setMessage('تصدير WebM غير مدعوم على هذا الجهاز.');return}
  try{
   validateVideo3DProject(project)
   video.pause()
   video.currentTime=0
   await new Promise<void>((resolve,reject)=>{
    if(video.readyState>=2&&video.currentTime===0){resolve();return}
    video.addEventListener('seeked',()=>resolve(),{once:true})
    video.addEventListener('error',()=>reject(Error('seek_failed')),{once:true})
   })
   const stream=stage.renderer.domElement.captureStream(30)
   const recorder=new MediaRecorder(stream,{mimeType:mime,
    videoBitsPerSecond:4_000_000})
   recorderRef.current=recorder;recordingStream.current=stream
   const chunks:BlobPart[]=[]
   recorder.ondataavailable=event=>{if(event.data.size)chunks.push(event.data)}
   const done=()=>{
    if(recorder.state==='recording')recorder.stop()
   }
   video.addEventListener('ended',done,{once:true})
   recorder.onstop=()=>{
    video.removeEventListener('ended',done)
    stream.getTracks().forEach(track=>track.stop())
    recordingStream.current=null;recorderRef.current=null
    setRecording(false);setPlaying(false)
    if(chunks.length)fileDownload(new Blob(chunks,{type:mime}),
      safeName(project.name)+'-3d-video.webm')
    setMessage(chunks.length?
     'تم تصدير WebM صامت مع المجسمات. الصوت الأصلي والتتبع الآلي ليسا جزءًا من هذه النسخة.':
     'لم ينتج المتصفح مقطعًا صالحًا.')
   }
   recorder.onerror=()=>{setMessage('فشل مسجّل الفيديو.');done()}
   recorder.start(250)
   setRecording(true)
   await video.play()
   setPlaying(true)
   setMessage('جاري تسجيل طبقة الفيديو والمجسمات في WebM؛ دون صوت.')
  }catch(error){
   stopRecording();setRecording(false)
   recordingStream.current?.getTracks().forEach(track=>track.stop())
   setMessage('تعذر تصدير الفيديو: '+String(error))
  }
 }
 return (
 <main dir="rtl" className="min-h-screen bg-[#080d18] px-4 py-8 text-white sm:px-6">
  <div className="mx-auto max-w-7xl">
   <div className="mb-5 space-y-2">
    <span className="text-xs font-bold uppercase tracking-widest text-cyan-300">SpakTok Video Reality · Beta</span>
    <h1 className="text-3xl font-bold">استوديو إنشاء مجسمات 3D للفيديو</h1>
    <p className="max-w-4xl text-sm leading-7 text-slate-300">
     أنشئ أشكالًا ثلاثية الأبعاد أو استورد GLB، حرّكها عبر نقاط زمنية فوق فيديو مسجّل، وصدّر المجسم أو مشروعك أو فيديو WebM صامتًا. المعاينة يدويّة؛ لا يوجد تتبع آلي للأشخاص أو الأشياء في هذه المرحلة. جميع الملفات محليّة.
    </p>
    <a href="/reality-studio" className="inline-block text-sm text-cyan-300 underline">
     العودة إلى Reality Studio والمؤثرات المباشرة
    </a>
   </div>
   <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_370px]">
    <section className="min-w-0 rounded-2xl border border-slate-700 bg-slate-950 p-3">
     <div ref={stageRef} className="mx-auto aspect-[9/16] max-h-[620px] min-h-[280px] w-full max-w-[480px] overflow-hidden rounded-lg bg-slate-900"
      aria-label="معاينة فيديو مع مجسمات ثلاثية الأبعاد"/>
     <video ref={videoRef} className="hidden" preload="auto" playsInline muted
      onPlay={()=>setPlaying(true)} onPause={()=>setPlaying(false)}
      onEnded={()=>{setPlaying(false);if(recording)stopRecording()}}/>
     <div className="mt-4 flex flex-wrap items-center gap-2">
      <button type="button" onClick={playPause} disabled={!project.source||recording}
       className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950 disabled:opacity-40">
       {playing?'إيقاف مؤقت':'تشغيل'}
      </button>
      <button type="button" onClick={()=>seek(0)} disabled={!project.source||recording}
       className="rounded-lg bg-slate-800 px-3 py-2 text-sm disabled:opacity-40">من البداية</button>
      <span className="ms-auto text-xs tabular-nums text-slate-300">{videoDuration(currentMs)} / {videoDuration(duration)}</span>
     </div>
     <label className="mt-3 block text-xs text-slate-300">
      الخط الزمني
      <input type="range" min={0} max={duration} step={20} value={clamp(currentMs,0,duration)}
       disabled={!project.source||recording} onChange={e=>seek(Number(e.target.value))}
       className="mt-3 w-full accent-cyan-400 disabled:opacity-40"/>
     </label>
     <div className="mt-3 flex flex-wrap gap-2">
      <button type="button" onClick={exportWebm} disabled={!project.source||recording||busy}
       className="rounded-lg bg-indigo-500 px-4 py-2 text-xs font-bold disabled:opacity-40">
       تصدير الفيديو WebM (صامت)
      </button>
      {recording&&<button type="button" onClick={stopRecording}
       className="rounded-lg bg-rose-500 px-4 py-2 text-xs font-bold">إنهاء التسجيل</button>}
      <button type="button" onClick={exportProject} className="rounded-lg border border-slate-600 px-4 py-2 text-xs">
       حفظ مشروع JSON
      </button>
     </div>
     <p aria-live="polite" className="mt-3 text-xs leading-6 text-cyan-200">{message}</p>
    </section>
    <aside className="space-y-5">
     <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <h2 className="font-bold">1. الفيديو والمجسمات</h2>
      <label className="block text-xs text-slate-300">فيديو من جهازك (MP4 / WebM، حتى 120 ثانية و250 MB)
       <input type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov,.m4v"
        onChange={importVideo} disabled={busy||recording}
        className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2"/>
      </label>
      <p className="break-all text-xs text-slate-400">{project.source?.name??'لم يتم اختيار فيديو'}</p>
      <div className="grid grid-cols-2 gap-2">
       {kinds.map(k=><button type="button" key={k.kind} onClick={()=>addShape(k.kind)}
        disabled={busy||recording||project.layers.length>=VIDEO_3D_MAX_LAYERS}
        className="rounded-lg border border-cyan-800 bg-cyan-950/40 p-2 text-xs font-semibold disabled:opacity-40">
        + {k.title}
       </button>)}
      </div>
      <label className="block text-xs text-slate-300">استيراد مجسم GLB محلي (حتى 15 MB)
       <input type="file" accept=".glb,model/gltf-binary"
        onChange={importGlb} disabled={busy||recording}
        className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-950 p-2"/>
      </label>
      {assetErrors&&<p className="text-xs text-rose-300">{assetErrors}</p>}
     </section>
     <section className="space-y-3 rounded-xl border border-cyan-700/40 bg-slate-900 p-4">
      <h2 className="font-bold">2. فلاتر الألوان الموحدة للفيديو</h2>
      <label className="block text-xs text-slate-300">
       اختر أحد فلاتر الكاميرا نفسها؛ ستظهر المعاينة والتصدير داخل Canvas ثلاثي الأبعاد.
       <select value={project.colorPresetId} disabled={recording}
        onChange={event=>setProject(prev=>({...prev,colorPresetId:event.target.value}))}
        className="mt-2 block w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm text-white">
        {REALITY_SHARED_GRADE_OPTIONS.map(option=>
         <option key={option.id} value={option.id}>{option.name}</option>)}
       </select>
      </label>
      <p className="text-[11px] text-slate-400">هذه طبقة ألوان GPU خفيفة تتشارك تعريفات الفلاتر. المطابقة الدقيقة مع Shader الكاميرا، وتتبّع أقنعة الوجه داخل الفيديو، ما زالا قيد التطوير.</p>
     </section>
     <section className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <h2 className="font-bold">3. طبقات المجسمات ({project.layers.length}/{VIDEO_3D_MAX_LAYERS})</h2>
      <div className="max-h-[190px] space-y-2 overflow-y-auto">
       {project.layers.length===0&&<p className="text-xs text-slate-400">أضف أول مجسم لإظهار أدوات الضبط.</p>}
       {project.layers.map(layer=><button type="button" key={layer.id} onClick={()=>setSelected(layer.id)}
        aria-pressed={selected===layer.id}
        className={`block w-full rounded-lg border p-2 text-right text-xs ${selected===layer.id?'border-cyan-400 bg-cyan-950':'border-slate-700 bg-slate-950'}`}>
        <span className="font-semibold">{layer.name}</span>
        <span className="ms-2 text-slate-400" dir="ltr">{layer.kind} · {layer.keyframes.length} keyframes</span>
       </button>)}
      </div>
     </section>
     {currentLayer&&<section className="space-y-3 rounded-xl border border-slate-700 bg-slate-900 p-4">
      <h2 className="font-bold">4. ضبط وتحريك {currentLayer.name}</h2>
      <label className="block text-xs leading-6 text-slate-300">
       ربط المجسم بالوجه في الفيديو
       <select value={currentLayer.anchor} onChange={event=>updateAttachment(event.target.value as Video3DAttachment)}
        disabled={recording}
        className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-sm text-white">
        <option value="screen">ثابت بالنسبة لإطار الفيديو</option>
        <option value="forehead_center">منتصف الجبهة (تاج)</option>
        <option value="eyes_center">منتصف العينين (نظارات)</option>
        <option value="nose_bridge">جسر الأنف</option>
        <option value="nose_tip">طرف الأنف</option>
        <option value="upper_lip">الشفة العليا</option>
        <option value="chin">الذقن</option>
       </select>
      </label>
      {currentLayer.anchor!=='screen'&&<p className="text-[11px] leading-5 text-cyan-200">
       تتبع وجه الفيديو: {videoTrackingStatus==='ready'?'مفعّل محليًا عند ظهور وجه':
        videoTrackingStatus==='loading'?'جارٍ تحميل MediaPipe':
        videoTrackingStatus==='error'?'فشل تحميل نموذج الوجه':'في انتظار تفعيل التتبع'}
       . هذا تتبع موضع ثنائي الأبعاد، وليس نموذج رأس 6DoF أو إخفاءً واقعيًا خلف الشعر.
      </p>}
      <p className="text-xs leading-6 text-slate-400">حرّك مؤشر الزمن، ثم غيّر أي قيمة لإنشاء نقطة Keyframe تلقائيًا. الحركة بين النقاط ناعمة وقابلة للتعديل.</p>
      <label className="flex items-center gap-3 text-xs">لون المجسم
       <input type="color" value={currentLayer.color} onChange={e=>updateColor(e.target.value)}
        disabled={recording||currentLayer.kind==='glb'} className="h-8 w-12 rounded border-0 bg-transparent"/>
      </label>
      {tools.map(item=><label key={item.key} className="block text-xs">
       <span className="flex justify-between text-slate-200"><span>{item.label}</span>
        <span className="tabular-nums">{currentFrame[item.key].toFixed(item.step<1?2:0)}</span></span>
       <input type="range" min={item.min} max={item.max} step={item.step} disabled={recording}
        value={clamp(currentFrame[item.key],item.min,item.max)}
        onChange={e=>putFrame({[item.key]:Number(e.target.value)})}
        className="mt-2 block w-full accent-cyan-400 disabled:opacity-40"/>
      </label>)}
      <div className="flex flex-wrap gap-2">
       <button type="button" onClick={()=>putFrame({})} disabled={recording}
        className="rounded-lg bg-cyan-500 px-3 py-2 text-xs font-bold text-slate-950">تثبيت Keyframe هنا</button>
       <button type="button" onClick={exportSelectedGlb} disabled={recording||currentLayer.kind==='glb'}
        className="rounded-lg border border-slate-600 px-3 py-2 text-xs disabled:opacity-40">تصدير المجسم GLB</button>
       <button type="button" onClick={deleteLayer} disabled={recording}
        className="rounded-lg border border-rose-600 px-3 py-2 text-xs text-rose-200">حذف الطبقة</button>
      </div>
      <p className="text-xs text-slate-400">أزمنة الحركة: {currentLayer.keyframes.map(k=>videoDuration(k.timeMs)).join('، ')}</p>
     </section>}
    </aside>
   </div>
   <p className="mt-5 text-xs leading-6 text-slate-400">نسخة تجريبية للعمل المحلي؛ لا تحفظ ملفات الفيديو أو GLB داخل JSON، ولا تتضمن مزامنة سحابية أو تتبع حركة AI في الفيديو، ولا تصدير MP4 مع صوت. لا تفترض تطابق تسجيل WebM على جميع الأجهزة قبل اختباره.</p>
  </div>
 </main>
 )
}
