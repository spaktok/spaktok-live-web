'use client'

import {useCallback,useEffect,useRef,useState,type ChangeEvent} from 'react'
import Link from 'next/link'
import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {createLuxeAvatar,LUXE_AVATAR_PRESETS,type LuxeAvatarStyle} from '@/lib/filter-engine/reality-avatar-luxe'
import {loadLocalStudioGlb,loadStudioFanoutManifest,loadVerifiedDirectorHandoff} from '@/lib/filter-engine/reality-local-asset-handoff'
import {assertSelfContainedVideo3DGlb,VIDEO_3D_MAX_GLB_BYTES} from '@/lib/filter-engine/reality-video3d-project'
import {loadFaceLandmarker,configureFace3DExtras,recoverFaceLandmarkerOnCpu} from '@/lib/filter-engine/vision'
import {avatarLandmarkExpression,avatarLuminance,chooseAvatarTrackerIssue,
 avatarTrackingIssueArabic,type AvatarTrackingIssue} from '@/lib/filter-engine/reality-avatar-detection'
import {
 avatarExpressionFromMediaPipe,avatarPoseFromLandmarks,easeAvatarPose,
 NEUTRAL_AVATAR_EXPRESSION,NEUTRAL_AVATAR_HEAD,
 smoothAvatarExpression,
 type AvatarExpression,type AvatarHeadPose,
} from '@/lib/filter-engine/reality-avatar-retarget'
import {
 neutralFaceChannelFrame,faceChannelFrameFromMediaPipe,
 faceChannelFrameFromStarter,smoothFaceChannelFrame,
 getFullFaceMorphBindings,inspectFullFaceRig,MEDIAPIPE_FACE_BLENDSHAPES,
 type FaceChannelFrame,type ActiveFaceBlendshape,
} from '@/lib/filter-engine/reality-avatar-full-retarget'

type TrackedPoint={x:number;y:number;z:number}
type AvatarState={
 renderer:THREE.WebGLRenderer
 scene:THREE.Scene;camera:THREE.PerspectiveCamera
 root:THREE.Group;defaultModel:THREE.Group
 uploaded:THREE.Object3D|null
 controls:ReadonlyArray<{
  mesh:THREE.Mesh;bindings:ReturnType<typeof getFullFaceMorphBindings>
 }>
 eyes:THREE.Object3D[]
 brows:THREE.Object3D[]
 mouth:THREE.Object3D|null
 expression:AvatarExpression;pose:AvatarHeadPose
 fullFace:FaceChannelFrame
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
 const fullFaceRef=useRef<FaceChannelFrame>(neutralFaceChannelFrame())
 const poseRef=useRef<AvatarHeadPose>(NEUTRAL_AVATAR_HEAD)
 const trackerIssueRef=useRef<AvatarTrackingIssue>('no-video')
 const diagnosticsRef=useRef({frames:0,faces:0,expressions:0,errors:0,
  brightness:null as number|null,cpu:false})
 const lightCanvasRef=useRef<HTMLCanvasElement|null>(null)
 const enhancedCanvasRef=useRef<HTMLCanvasElement|null>(null)
 const lastLightSample=useRef(0)
 const lowLightSince=useRef(0)
 const lastDiagnosticsUpdate=useRef(0)
 const cpuRecoveryAttempted=useRef(false)
 const consecutiveErrors=useRef(0)
 const [status,setStatus]=useState<CameraState>('idle')
 const [trackerIssue,setTrackerIssue]=useState<AvatarTrackingIssue>('no-video')
 const [diagnostics,setDiagnostics]=useState(diagnosticsRef.current)
 const [tracking,setTracking]=useState(false)
 const [message,setMessage]=useState('ابدأ بكاميرتك أو حمّل مجسم GLB مُجهّزًا بتعابير الوجه.')
 const [modelName,setModelName]=useState('LUXA • ذكوري')
 const [avatarStyle,setAvatarStyle]=useState<LuxeAvatarStyle>('masculine')
 const [targetNames,setTargetNames]=useState<string[]>([])
 const [morphCount,setMorphCount]=useState(0)
 const [handoffBusy,setHandoffBusy]=useState(false)
 const [mappedCount,setMappedCount]=useState(0)
 const [faceChannelCoverage,setFaceChannelCoverage]=useState(0)
 const [availableAdvancedChannels,setAvailableAdvancedChannels]=useState<ActiveFaceBlendshape[]>([])
 const [strength,setStrength]=useState(.85)
 const [mirror,setMirror]=useState(true)
 const mirrorRef=useRef(mirror)
 const strengthRef=useRef(strength)
 const manualPreviewRef=useRef(false)
 const manualValuesRef=useRef<AvatarExpression>(NEUTRAL_AVATAR_EXPRESSION)
 const advancedPreviewRef=useRef<{
  channel:ActiveFaceBlendshape|'none';value:number
 }>({channel:'none',value:.75})
 const [manualPreview,setManualPreview]=useState(false)
 const [manualValues,setManualValues]=useState<AvatarExpression>(NEUTRAL_AVATAR_EXPRESSION)
 const [advancedChannel,setAdvancedChannel]=useState<ActiveFaceBlendshape|'none'>('none')
 const [advancedWeight,setAdvancedWeight]=useState(.75)
 const rigControls=[
  {id:'eyeBlinkLeft' as const,label:'رمش العين اليسرى'},
  {id:'eyeBlinkRight' as const,label:'رمش العين اليمنى'},
  {id:'jawOpen' as const,label:'فتح الفم والفك'},
  {id:'mouthSmileLeft' as const,label:'ابتسامة اليسار'},
  {id:'mouthSmileRight' as const,label:'ابتسامة اليمين'},
  {id:'browInnerUp' as const,label:'رفع الحاجبين'},
  {id:'mouthPucker' as const,label:'ضم الشفتين'},
 ]
 useEffect(()=>{mirrorRef.current=mirror;strengthRef.current=strength},[mirror,strength])
 useEffect(()=>{manualPreviewRef.current=manualPreview},[manualPreview])
 useEffect(()=>{manualValuesRef.current=manualValues},[manualValues])
 useEffect(()=>{advancedPreviewRef.current={
  channel:advancedChannel,value:advancedWeight,
 }},[advancedChannel,advancedWeight])

 const resetTracking=()=>{
  expressionsRef.current=NEUTRAL_AVATAR_EXPRESSION
  fullFaceRef.current=neutralFaceChannelFrame()
  poseRef.current=NEUTRAL_AVATAR_HEAD
  lastTrackingRef.current=0
  setTracking(false)
  trackerIssueRef.current='no-video'
  setTrackerIssue('no-video')
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
  renderer.setClearColor(0xf5f6fa,1)
  const scene=new THREE.Scene()
  scene.background=new THREE.Color(0xf5f6fa)
  const camera=new THREE.PerspectiveCamera(35,1,.1,50)
  camera.position.set(0,0,5.6)
  const root=new THREE.Group()
  scene.add(root)
  const demo=createLuxeAvatar('masculine')
  root.add(demo.root)
  scene.add(new THREE.HemisphereLight(0xdbefff,0x293248,2))
  const key=new THREE.DirectionalLight(0xffdfbc,2.2)
  key.position.set(-2.2,3,5);scene.add(key)
  const rim=new THREE.DirectionalLight(0x80baff,.9)
  rim.position.set(3,-1,-3);scene.add(rim)
  const state:AvatarState={
   renderer,scene,camera,root,defaultModel:demo.root,uploaded:null,
   controls:[],eyes:[...demo.eyes],brows:[...demo.brows],mouth:demo.mouth,
   expression:NEUTRAL_AVATAR_EXPRESSION,pose:NEUTRAL_AVATAR_HEAD,
   fullFace:neutralFaceChannelFrame(),
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
    manualPreviewRef.current?manualValuesRef.current:
    active?expressionsRef.current:NEUTRAL_AVATAR_EXPRESSION,.29)
   const manualFrame=faceChannelFrameFromStarter(manualValuesRef.current)
   const advanced=advancedPreviewRef.current
   const manualAll=advanced.channel==='none'?manualFrame:
    {...manualFrame,[advanced.channel]:advanced.value}
   state.fullFace=smoothFaceChannelFrame(state.fullFace,
    manualPreviewRef.current?manualAll:
    active?fullFaceRef.current:neutralFaceChannelFrame(),.29)
   state.pose=easeAvatarPose(state.pose,active?poseRef.current:NEUTRAL_AVATAR_HEAD,.3)
   root.rotation.set(state.pose.pitch*factor,state.pose.yaw*factor,
    state.pose.roll*factor)
   if(state.uploaded){
    for(const {mesh,bindings} of state.controls){
     const influences=mesh.morphTargetInfluences
     if(!influences)continue
     for(const b of bindings)
      if(b.index<influences.length)
       influences[b.index]=bound(state.fullFace[b.key]*factor,0,1)
    }
   }else{
    const eyesAvg=[state.expression.eyeBlinkLeft,state.expression.eyeBlinkRight]
    for(let i=0;i<state.eyes.length;i++){
     state.eyes[i].scale.y=bound(1-eyesAvg[i]*.92,.08,1)
    }
    if(state.mouth){
     const smile=state.expression.mouthSmileLeft+state.expression.mouthSmileRight
     state.mouth.scale.y=1+state.expression.jawOpen*factor*2.4+
      smile*factor*.16
     state.mouth.scale.x=1+smile*factor*.13+
      state.expression.mouthPucker*factor*(-.24)
    }
    for(const brow of state.brows){
     const restY=brow.userData.restY
     if(typeof restY==='number')
      brow.position.y=restY+state.expression.browInnerUp*factor*.1
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
  diagnosticsRef.current={frames:0,faces:0,expressions:0,errors:0,
   brightness:null,cpu:false}
  setDiagnostics({...diagnosticsRef.current})
  lastDiagnosticsUpdate.current=0
  lastLightSample.current=0;lowLightSince.current=0
  consecutiveErrors.current=0;cpuRecoveryAttempted.current=false
  setTrackerIssue('no-video')
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
   setMessage('التتبع محلي، وسيعرض الاستوديو حالة النموذج والإضاءة وعدد الوجوه المكتشفة.')
   const sampleLighting=(now:number)=>{
    if(now-lastLightSample.current<1100)return
    lastLightSample.current=now
    try{
     if(!lightCanvasRef.current){
      lightCanvasRef.current=document.createElement('canvas')
      lightCanvasRef.current.width=48;lightCanvasRef.current.height=36
     }
     const ctx=lightCanvasRef.current.getContext('2d',{willReadFrequently:true})
     if(ctx){
      ctx.drawImage(video,0,0,48,36)
      diagnosticsRef.current.brightness=avatarLuminance(
       ctx.getImageData(0,0,48,36).data)
     }
    }catch{diagnosticsRef.current.brightness=null}
   }
   const showDiagnostics=(now:number,issue:AvatarTrackingIssue)=>{
    if(now-lastDiagnosticsUpdate.current>=650||trackerIssueRef.current!==issue){
     trackerIssueRef.current=issue
     setTrackerIssue(issue)
     lastDiagnosticsUpdate.current=now
     setDiagnostics({...diagnosticsRef.current})
    }
   }
   const track=async(now:number)=>{
    if(!trackingActiveRef.current)return
    if(!document.hidden&&video.readyState>=2&&
     now-lastDetectRef.current>=1000/maxFps){
     lastDetectRef.current=now
     sampleLighting(now)
     diagnosticsRef.current.frames++
     try{
      let result=detector.detectForVideo(video,now)
      let points=result.faceLandmarks?.[0] as TrackedPoint[]|undefined
      consecutiveErrors.current=0
      const lowLight=diagnosticsRef.current.brightness!==null&&
       diagnosticsRef.current.brightness<72
      if(!points&&lowLight){
       if(!lowLightSince.current)lowLightSince.current=now
       if(now-lowLightSince.current>1100){
        // Contrast enhancement is private and used only for low-light
        // INFERENCE. The original pixels are never replaced or uploaded.
        try{
         if(!enhancedCanvasRef.current)
          enhancedCanvasRef.current=document.createElement('canvas')
         const canvas=enhancedCanvasRef.current
         if(canvas.width!==video.videoWidth)canvas.width=video.videoWidth
         if(canvas.height!==video.videoHeight)canvas.height=video.videoHeight
         const context=canvas.getContext('2d')
         if(context){
          context.filter='brightness(1.65) contrast(1.12)'
          context.drawImage(video,0,0)
          context.filter='none'
          const improved=detector.detectForVideo(canvas,now+.05)
          if(improved.faceLandmarks?.[0]){
           result=improved
           points=improved.faceLandmarks[0] as TrackedPoint[]
          }
         }
        }catch{/* Some mobile models accept video but not canvas input. */}
       }
      }else lowLightSince.current=0
      if(points)diagnosticsRef.current.faces++
      const pose=points&&avatarPoseFromLandmarks(points,mirrorRef.current)
      const categories=result.faceBlendshapes?.[0]?.categories??[]
      if(categories.length)diagnosticsRef.current.expressions++
      if(pose){
       const coeffs:Record<string,number>={}
       for(const item of categories)coeffs[item.categoryName]=item.score
       const base=avatarExpressionFromMediaPipe(coeffs)
       const fallback=avatarLandmarkExpression(points!,video.videoWidth/video.videoHeight)
       poseRef.current=pose
       expressionsRef.current=categories.length?base:{
        ...base,jawOpen:fallback?.jawOpen??0,
        eyeBlinkLeft:fallback?.eyeBlinkLeft??0,
        eyeBlinkRight:fallback?.eyeBlinkRight??0,
       }
       fullFaceRef.current=categories.length?
        faceChannelFrameFromMediaPipe(coeffs):
        faceChannelFrameFromStarter(expressionsRef.current)
       lastTrackingRef.current=now
       setTracking(value=>value||true)
      }else if(now-lastTrackingRef.current>450)setTracking(false)
      showDiagnostics(now,chooseAvatarTrackerIssue({
       videoReady:true,hasFace:!!points,poseValid:!!pose,
       brightness:diagnosticsRef.current.brightness,inferenceFailed:false,
      }))
     }catch{
      diagnosticsRef.current.errors++
      consecutiveErrors.current++
      showDiagnostics(now,'model-error')
      if(now-lastTrackingRef.current>450)setTracking(false)
      if(consecutiveErrors.current>=2&&!cpuRecoveryAttempted.current){
       cpuRecoveryAttempted.current=true
       try{
        const cpu=await recoverFaceLandmarkerOnCpu()
        if(cpu&&trackingActiveRef.current){
         detector=cpu;consecutiveErrors.current=0
         diagnosticsRef.current.cpu=true
         setMessage('تم تحويل MediaPipe إلى CPU بعد فشل GPU. افتح وجهك نحو الكاميرا.')
        }
       }catch{
        setMessage('فشل تتبّع الوجه على GPU وCPU. جرّب إعادة تشغيل الكاميرا في Chrome.')
       }
      }
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
 const loadGlbFile=async(file:File):Promise<boolean>=>{
  if(!/\.glb$/i.test(file.name)||file.size>VIDEO_3D_MAX_GLB_BYTES||file.size<28){
   setMessage('ملف GLB غير صالح أو أكبر من 15 MB.');return false
  }
  const current=stateRef.current
  if(!current){setMessage('عارض الأفاتار لم يصبح جاهزًا بعد؛ حاول مجددًا.');return false}
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
    controls.push({mesh:node,bindings:getFullFaceMorphBindings(dict)})
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
   const coverage=inspectFullFaceRig(
    controls.map(x=>x.mesh.morphTargetDictionary))
   setFaceChannelCoverage(coverage.supported)
   const available=new Set(controls.flatMap(({bindings})=>bindings.map(b=>b.key)))
   setAvailableAdvancedChannels(MEDIAPIPE_FACE_BLENDSHAPES.slice(1).filter(
    (name):name is ActiveFaceBlendshape=>
     available.has(name as ActiveFaceBlendshape)&&
     !rigControls.some(control=>control.id===name)))
   setAdvancedChannel('none')
   setTargetNames([...targetSet].slice(0,16))
   setMessage(coverage.supported>=3?
    'تم ربط '+coverage.supported+' من 51 تعبيرًا قابلاً للتحريك. '+
    (coverage.level==='complete'?
     'ملف GLB يتضمن جميع القنوات بالاسم؛ يلزم اختبار جودة تشوهاتها بصريًا.':
     'بقية القنوات غير موجودة في المجسم، ولن يخترعها نظام التتبع.') :
    'تم تحميل المجسم وتحريك الرأس. لا تتوفر قنوات وجه كافية للتحريك.')
   return true
  }catch(error){
   setMessage('تعذّر قراءة هذا GLB بصورة آمنة: '+(error instanceof Error?error.message:'ملف غير متوافق'))
   return false
  }
 }
 const loadGlb=(event:ChangeEvent<HTMLInputElement>)=>{
  const file=event.target.files?.[0]
  event.target.value=''
  if(file)void loadGlbFile(file)
 }
 const importFromProduction=async()=>{
  if(handoffBusy)return
  setHandoffBusy(true)
  try{
   const plan=await loadStudioFanoutManifest()
   const target=plan?.project.outputTargets.includes('avatar')?'avatar':'live'
   const verified=plan?await loadVerifiedDirectorHandoff(target):null
   const file=verified?.file??(plan?null:await loadLocalStudioGlb())
   if(!file){
    setMessage('لا يوجد GLB مطابق لمسودة AI Director، أو لم يُوجّه لهذا القسم.')
    return
   }
   // Check target and SHA256 before WebGL parsing or telling the creator
   // that the avatar/live draft was successfully dispatched.
   const loaded=await loadGlbFile(file)
   if(!loaded)throw Error('studio_avatar_import_failed')
   if(verified){
    const blockers=verified.manifest.outputs.find(x=>x.target===target)?.blockers??[]
    setMessage('تم استيراد GLB من AI Director بعد مطابقة البصمة. '+
     'Rig والتتبّع يحتاجان فحصًا حقيقيًا: '+blockers.join(' · '))
   }
  }catch(error){setMessage('تعذر جلب المجسم المحلي: '+String(error))}
  finally{setHandoffBusy(false)}
 }
 const autoImportFromDirectorRef=useRef(false)
 useEffect(()=>{
  if(!autoImportFromDirectorRef.current&&
   new URLSearchParams(window.location.search).get('from')==='ai-director'){
   autoImportFromDirectorRef.current=true
   void importFromProduction()
  }
 // Navigate once from user-approved private AI Director preview handoff.
 // eslint-disable-next-line react-hooks/exhaustive-deps
 },[])
 const selectLuxeAvatar=(style:LuxeAvatarStyle)=>{
  const state=stateRef.current
  if(!state)return
  const rig=createLuxeAvatar(style)
  if(state.uploaded){
   state.root.remove(state.uploaded)
   disposeModel(state.uploaded)
   state.uploaded=null
  }
  const old=state.defaultModel
  state.root.remove(old);disposeModel(old)
  state.defaultModel=rig.root
  state.eyes=[...rig.eyes]
  state.brows=[...rig.brows]
  state.mouth=rig.mouth
  state.controls=[]
  state.root.add(rig.root)
  state.expression=NEUTRAL_AVATAR_EXPRESSION
  setAvatarStyle(style)
  const preset=LUXE_AVATAR_PRESETS.find(x=>x.id===style)!
  setModelName(preset.label)
  setMorphCount(0);setMappedCount(0);setFaceChannelCoverage(0)
  setAvailableAdvancedChannels([]);setAdvancedChannel('none');setTargetNames([])
  setMessage('نموذج LUXA تجريبي منحوت داخل التطبيق، مستوحى من المراجع. يتتبع حركة الرأس والرمش والفم، لكنه لا يطابق جودة الصور التفصيلية بعد.')
 }
 const useDemo=()=>selectLuxeAvatar(avatarStyle)
 return <main dir="rtl" className="min-h-screen bg-[#080e18] px-4 py-6 text-white">
  <section className="mx-auto max-w-6xl space-y-4">
   <header className="flex flex-wrap items-center justify-between gap-3">
    <div>
     <p className="text-xs font-semibold tracking-wider text-cyan-300">SpakTok Avatar Studio — Live Face Rig Beta</p>
     <h1 className="mt-2 text-2xl font-bold sm:text-3xl">شخصية 3D تتحرك مع تعابير وجهك</h1>
    </div>
    <Link href="/reality-studio" className="rounded-xl border border-white/20 px-4 py-2 text-sm text-cyan-200">العودة إلى Reality Studio</Link>
   </header>
   <p className="text-sm leading-7 text-slate-300">معاينة خاصة محلية: اختر نموذج LUXA الذكوري أو الأنثوي، أو استورد GLB مجهزًا بتعابير الوجه. لا يوجد بث للمشاهدين أو رفع للصورة أو تسجيل صوت.</p>
   <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_330px]">
    <section className="overflow-hidden rounded-2xl border border-cyan-500/20 bg-[#f5f6fa]">
     <canvas ref={canvasRef} className="h-[54dvh] min-h-[340px] w-full sm:h-[650px]"
      aria-label="معاينة شخصية ثلاثية الأبعاد متحركة"/>
     <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-[#111b2d] p-3">
      <p className="text-xs text-slate-300">{modelName}</p>
      <span role="status" className={tracking?'text-emerald-300':'text-amber-300'}>
       {tracking?'● التتبع نشط':'○ '+avatarTrackingIssueArabic[trackerIssue]}
      </span>
     </div>
    </section>
    <aside className="space-y-4">
     <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <h2 className="font-semibold">1. تفعيل كاميرا التتبع</h2>
      <video ref={videoRef} muted playsInline autoPlay
       className="mt-3 h-40 w-44 rounded-xl bg-black object-cover"
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
      {status==='running'&&<div className="mt-3 space-y-2 rounded-lg border border-white/10 bg-slate-950 p-3 text-xs leading-6 text-slate-300">
       <p className={tracking?'text-emerald-300':'text-amber-200'}>{avatarTrackingIssueArabic[trackerIssue]}</p>
       <p>فحوص الكاميرا: {diagnostics.frames} · اكتشاف الوجه: {diagnostics.faces} ·
        معاملات التعابير: {diagnostics.expressions} · أخطاء النموذج: {diagnostics.errors}</p>
       <p>سطوع تقريبي: {diagnostics.brightness===null?'—':Math.round(diagnostics.brightness)+'/255'} ·
        المحرك: {diagnostics.cpu?'CPU بعد الاسترداد':'GPU / CPU تلقائي'}</p>
       {!tracking&&<p>اجعل مصدر الضوء أمام وجهك ووجّه الكاميرا مباشرة إليه. إذا لم يتحسّن التتبع، أوقف الكاميرا وأعد تشغيلها.</p>}
      </div>}
     </div>
     <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <h2 className="font-semibold">2. اختيار تصميم LUXA</h2>
      <div className="mt-3 grid grid-cols-2 gap-2" role="group" aria-label="اختيار مظهر الأفاتار">
       {LUXE_AVATAR_PRESETS.map(preset=><button type="button" key={preset.id}
        onClick={()=>selectLuxeAvatar(preset.id)}
        aria-pressed={!stateRef.current?.uploaded&&avatarStyle===preset.id}
        className={`rounded-xl border px-3 py-3 text-xs font-bold transition-colors ${!stateRef.current?.uploaded&&avatarStyle===preset.id?'border-cyan-300 bg-cyan-950/50 text-cyan-100':'border-slate-600 bg-slate-950 text-slate-300'}`}>
        {preset.id==='masculine'?'مظهر ذكوري':'مظهر أنثوي'}
       </button>)}
      </div>
      <p className="mt-2 text-xs leading-6 text-slate-300">
       {LUXE_AVATAR_PRESETS.find(preset=>preset.id===avatarStyle)?.description}
      </p>
      <p className="mt-1 text-[11px] leading-5 text-amber-200">
       هذه نسخة ثلاثية الأبعاد مولّدة هندسيًا داخل التطبيق لإثبات الأسلوب والحركة، وليست استخراجًا آليًا مطابقًا للصور المرجعية.
      </p>
      <h3 className="mt-4 font-semibold text-white">استيراد شخصية GLB احترافية</h3>
      <button type="button" disabled={handoffBusy} onClick={()=>void importFromProduction()}
       className="mt-3 w-full rounded-lg bg-cyan-500/15 px-3 py-3 text-sm font-semibold text-cyan-200 disabled:opacity-40">
       {handoffBusy?'جارٍ جلب المجسم…':'استيراد GLB من خط إنتاج Reality Studio (محليًا)'}
      </button>
      <p className="mt-1 text-[11px] leading-5 text-slate-400">
       يمكن استيراد وجه قياسي مولّد من صورة، وسيُحرّك الرأس فقط إذا كان GLB بلا Morph Targets.
       لإظهار الرمش والابتسامة يجب تجهيز Rig حقيقي.
      </p>
      <label className="mt-3 block space-y-1 text-sm">
       <span>استيراد GLB مُجهّز لتحريك الوجه (حد 15MB)</span>
       <input type="file" accept=".glb,model/gltf-binary" onChange={loadGlb}
        className="block w-full rounded-lg border border-slate-600 bg-slate-950 p-2 text-xs"/>
      </label>
      <button type="button" onClick={useDemo}
       className="mt-3 rounded-lg border border-white/20 px-3 py-2 text-xs text-cyan-300">
       الرجوع إلى نموذج LUXA المختار
      </button>
      <p className="mt-2 text-xs text-slate-400">Morph Targets: {morphCount} · روابط تعابير: {mappedCount} · القنوات المتوافقة: {faceChannelCoverage}/51</p>
      {!!morphCount&&<p className="mt-2 text-[11px] leading-5 text-cyan-200">
       يمكنك اختبار الحركات واحدة تلو الأخرى من اللوحة التالية، أو إيقاف الاختبار لتتحرك الشخصية مع تتبّع كاميرتك.
      </p>}
      {!!targetNames.length&&<p className="mt-1 break-words text-xs text-slate-500">المفاتيح: {targetNames.join(' · ')}</p>}
     </div>
     <div className="rounded-2xl border border-cyan-400/25 bg-slate-900 p-4">
      <h2 className="font-semibold">3. اختبار القناع الهندسي قبل الكاميرا</h2>
      <p className="mt-2 text-xs leading-6 text-slate-300">
       ارفع أحد ملفَّي LUXA GLB، وفعّل الاختبار اليدوي للتأكد من أن الشبكة تتغير هندسيًا. ستُحرّك القيم الفم والعينين والحاجبين حتى إن تعذّر اكتشاف الوجه بالكاميرا.
      </p>
      <label className="mt-3 flex items-center gap-2 text-sm font-medium text-cyan-100">
       <input type="checkbox" checked={manualPreview} onChange={e=>setManualPreview(e.target.checked)}/>
       تشغيل تحريك القناع اليدوي
      </label>
      {manualPreview&&<div className="mt-3 max-h-56 space-y-3 overflow-y-auto">
       {rigControls.map(control=><label key={control.id} className="block text-xs">
        <span className="flex items-center justify-between gap-2">
         <span>{control.label}</span><span>{Math.round(manualValues[control.id]*100)}%</span>
        </span>
        <input type="range" min="0" max="1" step=".05"
         value={manualValues[control.id]}
         onChange={e=>setManualValues(prev=>({...prev,[control.id]:Number(e.target.value)}))}
         className="mt-1 w-full accent-cyan-300" aria-label={control.label}/>
       </label>)}
       {availableAdvancedChannels.length>0&&<>
        <label className="block text-xs">
         اختبار قناة وجه متقدمة (عندما تكون موجودة في GLB)
         <select value={advancedChannel}
          onChange={e=>setAdvancedChannel(e.target.value as ActiveFaceBlendshape|'none')}
          className="mt-1 block w-full rounded-lg border border-white/20 bg-slate-950 p-2">
          <option value="none">بدون حركة إضافية</option>
          {availableAdvancedChannels.map(name=>
           <option value={name} key={name}>{name}</option>)}
         </select>
        </label>
        {advancedChannel!=='none'&&<label className="block text-xs">
         قوة القناة المتقدمة: {Math.round(advancedWeight*100)}%
         <input type="range" min="0" max="1" step=".05" value={advancedWeight}
          onChange={e=>setAdvancedWeight(Number(e.target.value))}
          className="mt-2 w-full accent-violet-300"/>
        </label>}
       </>}
       <button type="button" className="rounded-lg bg-white/10 px-3 py-2 text-xs"
        onClick={()=>{setManualValues(NEUTRAL_AVATAR_EXPRESSION);setAdvancedChannel('none')}}>
        إعادة جميع حركات الوجه إلى الصفر
       </button>
      </div>}
      <p className="mt-2 text-[11px] text-slate-400">
       القناع المستورد يحتاج Morph Targets بنفس الأسماء. هذا الاختبار لا ينشر فيديو ولا يتطلب إذن الكاميرا.
      </p>
     </div>
     <div className="rounded-2xl border border-white/10 bg-slate-900 p-4">
      <h2 className="font-semibold">4. درجة الاستجابة</h2>
      <input type="range" min="0" max="1" step=".05" value={strength}
       onChange={event=>setStrength(Number(event.target.value))}
       className="mt-3 w-full accent-cyan-400" aria-label="شدة حركة الوجه"/>
      <p className="text-xs text-slate-300">شدة التحريك: {Math.round(strength*100)}%</p>
     </div>
     <p role="status" className="rounded-xl border border-white/10 bg-slate-950 p-3 text-xs leading-6 text-slate-300">{message}</p>
     <p className="text-xs leading-6 text-slate-400">الصور المرجعية تحدد الاتجاه الفني: شعر منحوت ومضيء، خامات جلد وعيون لامعة ووجه دقيق. المطابقة البصرية العالية تتطلب نماذج نحت وخامات وملفات GLB مُجهّزة بإشراف فني، وليس مجرد أشكال إجرائية. معاينة محلية فقط، لا يوجد بث Agora للجمهور.</p>
    </aside>
   </div>
  </section>
 </main>
}
