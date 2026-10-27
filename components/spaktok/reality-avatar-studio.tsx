'use client'

import {useCallback,useEffect,useRef,useState,type ChangeEvent} from 'react'
import Link from 'next/link'
import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {assertSelfContainedVideo3DGlb,VIDEO_3D_MAX_GLB_BYTES} from '@/lib/filter-engine/reality-video3d-project'
import {loadFaceLandmarker,configureFace3DExtras} from '@/lib/filter-engine/vision'
import {
 avatarExpressionFromMediaPipe,avatarPoseFromLandmarks,easeAvatarPose,
 getAvatarMorphBindings,NEUTRAL_AVATAR_EXPRESSION,NEUTRAL_AVATAR_HEAD,
 smoothAvatarExpression,hasExpressiveAvatarTargets,
 type AvatarExpression,type AvatarHeadPose,
} from '@/lib/filter-engine/reality-avatar-retarget'

type TrackedPoint={x:number;y:number;z:number}
type AvatarState={
 renderer:THREE.WebGLRenderer
 scene:THREE.Scene;camera:THREE.PerspectiveCamera
 root:THREE.Group;defaultModel:THREE.Group
 uploaded:THREE.Object3D|null
 controls:ReadonlyArray<{
  mesh:THREE.Mesh;bindings:ReturnType<typeof getAvatarMorphBindings>
 }>
 eyes:THREE.Object3D[]
 mouth:THREE.Object3D|null
 expression:AvatarExpression;pose:AvatarHeadPose
}
type CameraState='idle'|'loading'|'running'|'denied'|'unsupported'|'error'
const maxFps=13
const bound=(n:number,a:number,b:number)=>Math.max(a,Math.min(b,n))
function disposeModel(root:THREE.Object3D){
 const geometries=new Set<THREE.BufferGeometry>()
 const mats=new Set<THREE.Material>()
 const textures=new Set<THREE.Texture>()
 root.traverse(child=>{
  if(!(child instanceof THREE.Mesh))return
  geometries.add(child.geometry)
  const materials=Array.isArray(child.material)?child.material:[child.material]
  for(const mat of materials){
   mats.add(mat)
   for(const value of Object.values(mat))
    if(value instanceof THREE.Texture)textures.add(value)
  }
 })
 for(const g of geometries)g.dispose()
 for(const m of mats)m.dispose()
 for(const t of textures)t.dispose()
}
function buildDemoAvatar(){
 const root=new THREE.Group()
 const skin=new THREE.MeshStandardMaterial({color:0xd49b76,metalness:0,roughness:.66})
 const dark=new THREE.MeshStandardMaterial({color:0x131a2c,roughness:.4})
 const white=new THREE.MeshStandardMaterial({color:0xf7f3e9,roughness:.3})
 const iris=new THREE.MeshStandardMaterial({color:0x2879aa,roughness:.2})
 const pink=new THREE.MeshStandardMaterial({color:0x7b263b,roughness:.55})
 const add=(g:THREE.BufferGeometry,m:THREE.Material,x:number,y:number,z:number,
  sx=1,sy=1,sz=1)=>{
  const mesh=new THREE.Mesh(g,m);mesh.position.set(x,y,z)
  mesh.scale.set(sx,sy,sz);root.add(mesh);return mesh
 }
 const sphere=new THREE.SphereGeometry(1,32,24)
 add(sphere,skin,0,0,0,.85,1.05,.67)
 add(new THREE.SphereGeometry(1,24,16),dark,0,.87,-.05,.78,.34,.56)
 add(sphere,skin,0,-.08,.64,.15,.25,.15)
 const eyes:THREE.Object3D[]=[]
 for(const x of [-.33,.33]){
  // Eye, iris and pupil must blink together, not leave floating pupils.
  const eyeRig=new THREE.Group()
  eyeRig.position.set(x,.22,.59)
  root.add(eyeRig);eyes.push(eyeRig)
  const ball=(m:THREE.Material,z:number,sx:number,sy:number,sz:number)=>{
   const obj=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),m)
   obj.position.z=z;obj.scale.set(sx,sy,sz);eyeRig.add(obj)
  }
  ball(white,0,.18,.12,.085)
  ball(iris,.10,.07,.082,.025)
  ball(dark,.125,.028,.038,.015)
  const brow=add(new THREE.CapsuleGeometry(.035,.23,4,8),dark,x,.47,.57)
  brow.rotation.z=Math.PI/2
 }
 const mouth=add(new THREE.SphereGeometry(1,26,16),pink,0,-.5,.61,.28,.065,.035)
 return {root,eyes,mouth}
}
export default function RealityAvatarStudio(){
 const canvasRef=useRef<HTMLCanvasElement|null>(null)
 const videoRef=useRef<HTMLVideoElement|null>(null)
 const stateRef=useRef<AvatarState|null>(null)
 const mediaStreamRef=useRef<MediaStream|null>(null)
 const trackingActiveRef=useRef(false)
 const trackingAnimationRef=useRef(0)
 const renderAnimationRef=useRef(0)
 const lastDetectRef=useRef(0)
 const lastTrackingRef=useRef(0)
 const expressionsRef=useRef<AvatarExpression>(NEUTRAL_AVATAR_EXPRESSION)
 const poseRef=useRef<AvatarHeadPose>(NEUTRAL_AVATAR_HEAD)
 const [status,setStatus]=useState<CameraState>('idle')
 const [tracking,setTracking]=useState(false)
 const [message,setMessage]=useState('ابدأ بكاميرتك أو حمّل مجسم GLB مُجهّزًا بتعابير الوجه.')
 const [modelName,setModelName]=useState('شخصية تجريبية من SpakTok')
 const [targetNames,setTargetNames]=useState<string[]>([])
 const [morphCount,setMorphCount]=useState(0)
 const [mappedCount,setMappedCount]=useState(0)
 const [strength,setStrength]=useState(.85)
 const [mirror,setMirror]=useState(true)
 const mirrorRef=useRef(mirror)
 const strengthRef=useRef(strength)
 useEffect(()=>{mirrorRef.current=mirror;strengthRef.current=strength},
  [mirror,strength])

 const resetTracking=()=>{
  expressionsRef.current=NEUTRAL_AVATAR_EXPRESSION
  poseRef.current=NEUTRAL_AVATAR_HEAD
  lastTrackingRef.current=0
  setTracking(false)
 }
 const stopCamera=useCallback(()=>{
  trackingActiveRef.current=false
  if(trackingAnimationRef.current)cancelAnimationFrame(trackingAnimationRef.current)
  trackingAnimationRef.current=0
  mediaStreamRef.current?.getTracks().forEach(track=>track.stop())
  mediaStreamRef.current=null
  if(videoRef.current){videoRef.current.pause();videoRef.current.srcObject=null}
  resetTracking()
  setStatus('idle')
 },[])
 useEffect(()=>{
  const canvas=canvasRef.current
  if(!canvas)return
  const renderer=new THREE.WebGLRenderer({canvas,alpha:false,antialias:true,
   powerPreference:'high-performance'})
  renderer.outputColorSpace=THREE.SRGBColorSpace
  renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,1.5))
  renderer.setClearColor(0x0d1728,1)
  const scene=new THREE.Scene()
  scene.background=new THREE.Color(0x0d1728)
  const camera=new THREE.PerspectiveCamera(35,1,.1,50)
  camera.position.set(0,0,5.6)
  const root=new THREE.Group()
  scene.add(root)
  const demo=buildDemoAvatar()
  root.add(demo.root)
  scene.add(new THREE.HemisphereLight(0xdbefff,0x293248,2))
  const key=new THREE.DirectionalLight(0xffdfbc,2.2)
  key.position.set(-2.2,3,5);scene.add(key)
  const rim=new THREE.DirectionalLight(0x80baff,.9)
  rim.position.set(3,-1,-3);scene.add(rim)
  const state:AvatarState={
   renderer,scene,camera,root,defaultModel:demo.root,uploaded:null,
   controls:[],eyes:demo.eyes,mouth:demo.mouth,
   expression:NEUTRAL_AVATAR_EXPRESSION,pose:NEUTRAL_AVATAR_HEAD,
  }
  stateRef.current=state
  const resize=()=>{
   const width=Math.max(1,canvas.clientWidth),height=Math.max(1,canvas.clientHeight)
   renderer.setSize(width,height,false)
   camera.aspect=width/height;camera.updateProjectionMatrix()
  }
  const resizeObserver=new ResizeObserver(resize)
  resizeObserver.observe(canvas);resize()
  const animate=()=>{
   const current=stateRef.current
   if(current!==state)return
   const factor=strengthRef.current
   const active=performance.now()-lastTrackingRef.current<450
   state.expression=smoothAvatarExpression(state.expression,
    active?expressionsRef.current:NEUTRAL_AVATAR_EXPRESSION,.29)
   state.pose=easeAvatarPose(state.pose,active?poseRef.current:NEUTRAL_AVATAR_HEAD,.3)
   root.rotation.set(state.pose.pitch*factor,state.pose.yaw*factor,
    state.pose.roll*factor)
   if(state.uploaded){
    for(const {mesh,bindings} of state.controls){
     const influences=mesh.morphTargetInfluences
     if(!influences)continue
     for(const b of bindings)
      if(b.index<influences.length)
       influences[b.index]=bound(state.expression[b.key]*factor,0,1)
    }
   }else{
    const eyesAvg=[state.expression.eyeBlinkLeft,state.expression.eyeBlinkRight]
    for(let i=0;i<state.eyes.length;i++){
     state.eyes[i].scale.y=bound(1-eyesAvg[i]*.92,.08,1)
    }
    if(state.mouth){
     state.mouth.scale.y=.065+state.expression.jawOpen*factor*.21+
      (state.expression.mouthSmileLeft+state.expression.mouthSmileRight)*factor*.035
     state.mouth.scale.x=.28+
      (state.expression.mouthSmileLeft+state.expression.mouthSmileRight)*factor*.09
    }
   }
   renderer.render(scene,camera)
   renderAnimationRef.current=requestAnimationFrame(animate)
  }
  renderAnimationRef.current=requestAnimationFrame(animate)
  return()=>{
   trackingActiveRef.current=false
   if(trackingAnimationRef.current)cancelAnimationFrame(trackingAnimationRef.current)
   cancelAnimationFrame(renderAnimationRef.current)
   resizeObserver.disconnect()
   mediaStreamRef.current?.getTracks().forEach(track=>track.stop())
   mediaStreamRef.current=null
   if(state.uploaded)disposeModel(state.uploaded)
   disposeModel(state.defaultModel)
   renderer.dispose()
   stateRef.current=null
  }
 },[])

 const startCamera=async()=>{
  if(status==='loading'||status==='running')return
  if(!navigator.mediaDevices?.getUserMedia){setStatus('unsupported');return}
  setStatus('loading')
  try{
   const stream=await navigator.mediaDevices.getUserMedia({
    audio:false,video:{facingMode:'user',width:{ideal:640},height:{ideal:480},
     frameRate:{ideal:30,max:30}}})
   const video=videoRef.current
   if(!video){stream.getTracks().forEach(x=>x.stop());setStatus('error');return}
   mediaStreamRef.current=stream
   video.srcObject=stream;video.muted=true;video.playsInline=true
   await video.play()
   await configureFace3DExtras(true)
   let detector=await loadFaceLandmarker()
   trackingActiveRef.current=true
   setStatus('running')
   setMessage('التتبع محلي: يدير الرأس ويطبق تعابير الرمش والفم على المجسم المتوافق.')
   const track=async(now:number)=>{
    if(!trackingActiveRef.current)return
    if(!document.hidden&&video.readyState>=2&&
     now-lastDetectRef.current>=1000/maxFps){
     lastDetectRef.current=now
     try{
      const result=detector.detectForVideo(video,now)
      const points=result.faceLandmarks?.[0] as TrackedPoint[]|undefined
      const pose=points&&avatarPoseFromLandmarks(points,mirrorRef.current)
      if(pose){
       const coeffs:Record<string,number>={}
       for(const item of result.faceBlendshapes?.[0]?.categories??[]){
        coeffs[item.categoryName]=item.score
       }
       poseRef.current=pose
       expressionsRef.current=avatarExpressionFromMediaPipe(coeffs)
       lastTrackingRef.current=now
       setTracking(value=>value||true)
      }else if(now-lastTrackingRef.current>450)setTracking(false)
     }catch{
      // MediaPipe tracking may be temporarily unavailable on some phone GPUs.
      // The last expression naturally decays to neutral after 450ms.
      if(now-lastTrackingRef.current>450)setTracking(false)
     }
    }
    trackingAnimationRef.current=requestAnimationFrame(track)
   }
   trackingAnimationRef.current=requestAnimationFrame(track)
  }catch(error){
   mediaStreamRef.current?.getTracks().forEach(track=>track.stop())
   mediaStreamRef.current=null
   trackingActiveRef.current=false
   setStatus(error instanceof DOMException&&error.name==='NotAllowedError'?
    'denied':'error')
   setMessage('تعذّر تشغيل الكاميرا أو تحميل نموذج تتبع الوجه. جرّب Chrome واسمح للكاميرا.')
  }
 }
 const loadGlb=async(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0]
  event.target.value=''
  if(!file)return
  if(!/\.glb$/i.test(file.name)||file.size>VIDEO_3D_MAX_GLB_BYTES||file.size<28){
   setMessage('ملف GLB غير صالح أو أكبر من 15 MB.');return
  }
  const current=stateRef.current
  if(!current)return
  try{
   const data=await file.arrayBuffer()
   assertSelfContainedVideo3DGlb(data)
   const parsed=await new GLTFLoader().parseAsync(data,'')
   const scene=parsed.scene
   const box=new THREE.Box3().setFromObject(scene)
   const size=new THREE.Vector3();box.getSize(size)
   if(box.isEmpty()||!Number.isFinite(size.length())||size.length()<.0001)
    throw Error('empty_or_invalid_geometry')
   const scale=2/Math.max(size.x,size.y,size.z)
   if(!Number.isFinite(scale)||scale>1e6)throw Error('invalid_scale')
   const center=new THREE.Vector3();box.getCenter(center)
   scene.position.set(-center.x,-center.y,-center.z)
   const adjusted=new THREE.Group()
   adjusted.add(scene);adjusted.scale.setScalar(scale)
   const controls:AvatarState['controls'][number][]=[]
   const targetSet=new Set<string>()
   let morphs=0
   scene.traverse(node=>{
    if(!(node instanceof THREE.Mesh))return
    const dict=node.morphTargetDictionary
    if(dict)for(const key of Object.keys(dict))targetSet.add(key)
    morphs+=Object.keys(dict??{}).length
    controls.push({mesh:node,bindings:getAvatarMorphBindings(dict)})
   })
   const previous=current.uploaded
   if(previous){current.root.remove(previous);disposeModel(previous)}
   current.uploaded=adjusted
   current.controls=controls
   current.defaultModel.visible=false
   current.root.add(adjusted)
   setModelName(file.name)
   setMorphCount(morphs)
   setMappedCount(controls.reduce((s,x)=>s+x.bindings.length,0))
   setTargetNames([...targetSet].slice(0,16))
   setMessage(hasExpressiveAvatarTargets(controls.map(x=>x.mesh.morphTargetDictionary))
    ?'تم ربط Morph Targets بالتعابير المتوافقة؛ جرّب الرمش والابتسام أمام الكاميرا.'
    :'تم تحميل المجسم وتحريك الرأس. لا يوجد ما يكفي من Morph Targets المتوافقة لتحريك الوجه.')
  }catch(error){
   setMessage('تعذّر قراءة هذا GLB بصورة آمنة: '+(error instanceof Error?error.message:'ملف غير متوافق'))
  }
 }
 const useDemo=()=>{
  const state=stateRef.current
  if(!state)return
  if(state.uploaded){state.root.remove(state.uploaded);disposeModel(state.uploaded)}
  state.uploaded=null;state.controls=[];state.defaultModel.visible=true
  setModelName('شخصية تجريبية من SpakTok')
  setMorphCount(0);setMappedCount(0);setTargetNames([])
  setMessage('الشخصية التجريبية تستجيب للرأس والرمش والفم؛ GLB الحقيقي يحتاج Morph Targets مُجهّزة.')
 }
 return <main dir="rtl" className="min-h-screen bg-[#080e18] px-4 py-6 text-white">
  <section className="mx-auto max-w-6xl space-y-4">
   <header className="flex flex-wrap items-center justify-between gap-3">
    <div>
     <p className="text-xs font-semibold tracking-wider text-cyan-300">SpakTok Avatar Studio — Live Face Rig Beta</p>
     <h1 className="mt-2 text-2xl font-bold sm:text-3xl">شخصية 3D تتحرك مع تعابير وجهك</h1>
    </div>
    <Link href="/reality-studio" className="rounded-xl border border-white/20 px-4 py-2 text-sm text-cyan-200">العودة إلى Reality Studio</Link>
   </header>
   <p className="text-sm leading-7 text-slate-300">معاينة خاصة محلية: استورد GLB مُجهّزًا بتعابير الوجه أو جرّب الشخصية البسيطة. لا يوجد بث للمشاهدين أو رفع للصورة أو تسجيل صوت.</p>
   <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
    <section className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#0d1728]">
     <canvas ref={canvasRef} className="h-[54dvh] min-h-[340px] w-full sm:h-[650px]"
      aria-label="معاينة شخصية ثلاثية الأبعاد متحركة"/>
     <div className="flex flex-wrap items-center justify-between gap-3 border-t border-white/10 p-3">
      <p className="text-xs text-slate-300">{modelName}</p>
      <span className={tracking?'text-emerald-300':'text-amber-300'}>{tracking?'● التتبع نشط':'○ لم يُكتشف وجه بعد'}</span>
     </div>
    </section>
    <aside className="space-y-4">
     <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <h2 className="font-semibold">1. تفعيل كاميرا التتبع</h2>
      <video ref={videoRef} muted playsInline autoPlay
       className="mt-3 h-24 w-32 rounded-xl bg-black object-cover"
       style={{transform:mirror?'scaleX(-1)':'none'}} aria-label="معاينة الكاميرا الخام"/>
      <div className="mt-3 flex gap-2">
       {status==='running'?
        <button onClick={stopCamera} className="rounded-lg bg-rose-600 px-4 py-2 text-sm font-semibold">إيقاف الكاميرا</button>:
        <button onClick={startCamera} disabled={status==='loading'}
         className="rounded-lg bg-cyan-600 px-4 py-2 text-sm font-semibold disabled:opacity-50">
         {status==='loading'?'جارٍ بدء التتبع…':'تشغيل الكاميرا'}</button>}
      </div>
      <label className="mt-3 flex items-center gap-2 text-sm text-slate-200">
       <input type="checkbox" checked={mirror} onChange={event=>setMirror(event.target.checked)}/>
       مطابقة حركة الرأس في المرآة
      </label>
      {status==='denied'&&<p className="mt-2 text-xs text-amber-200">إذن الكاميرا مرفوض. افتح الرابط في Chrome واسمح للكاميرا.</p>}
     </div>
     <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <h2 className="font-semibold">2. اختيار الشخصية</h2>
      <label className="mt-3 block space-y-1 text-sm">
       <span>استيراد GLB مُجهّز لتحريك الوجه (حد 15MB)</span>
       <input type="file" accept=".glb,model/gltf-binary" onChange={loadGlb}
        className="block w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-xs"/>
      </label>
      <button type="button" onClick={useDemo}
       className="mt-3 rounded-lg border border-white/20 px-3 py-2 text-xs text-cyan-300">
       الرجوع إلى الشخصية التجريبية
      </button>
      <p className="mt-2 text-xs text-slate-400">Morph Targets: {morphCount} · حركات معروفة: {mappedCount}</p>
      {!!targetNames.length&&<p className="mt-1 break-words text-xs text-slate-500">المفاتيح: {targetNames.join(' · ')}</p>}
     </div>
     <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <h2 className="font-semibold">3. درجة الاستجابة</h2>
      <input type="range" min="0" max="1" step=".05" value={strength}
       onChange={event=>setStrength(Number(event.target.value))}
       className="mt-3 w-full accent-cyan-400" aria-label="شدة حركة الوجه"/>
      <p className="text-xs text-slate-300">شدة التحريك: {Math.round(strength*100)}%</p>
     </div>
     <p role="status" className="rounded-xl border border-white/10 bg-slate-950 p-3 text-xs leading-6 text-slate-300">{message}</p>
     <p className="text-xs leading-6 text-slate-400">هذا أول مسار لربط الشخصية بالتعابير، وليس مولّدًا آليًا من صورة. يلزم تجهيز Morph Targets متوافقة، وتحسين الرأس والجسم، واختبار الهواتف، ثم ربط خرج الفيديو ببث Agora قبل الإطلاق.</p>
    </aside>
   </div>
  </section>
 </main>
}
