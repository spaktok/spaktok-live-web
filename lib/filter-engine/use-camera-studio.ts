'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FilterRenderer, type FaceGeometry, type RenderInput } from './renderer'
import { isFace3DSelected, neutralBeauty, neutralColor, neutralEffects, neutralFaceFx, resolveColor, type StudioState } from './params'
import { composeRealityFrame } from './reality-compositor'
import { createRealityExecutionPlan, shouldUseRealityGpu2 } from './reality-pipeline'
import { loadFaceLandmarker, recoverFaceLandmarkerOnCpu, configureFace3DExtras, loadSegmenter, smoothFace, toFaceGeometry } from './vision'
import { drawFaceMask } from './face-overlay'
import {trackingIntervalMs,updatedMean} from './vision-scheduler'
import type {FaceMesh3DEngine,Face3DFrame} from './face3d'
import {stabilizeFaceMesh,hasFreshFace} from './face3d-tracking'
import {cameraSurfaceDimensions} from './preview-surface'

export type Facing = 'user' | 'environment'
export type CameraStatus = 'idle' | 'starting' | 'ready' | 'denied' | 'unsupported' | 'error'
export type VisionStatus = 'off' | 'loading' | 'ready' | 'tracking' | 'no-face' | 'unavailable'

interface Options {
  state: StudioState
  audio?: boolean
  paused?: boolean
  /** Output aspect ratio (width / height). Portrait 9:16 matches stories and live. */
  aspect?: number
}

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number
  cancelVideoFrameCallback?: (id: number) => void
}

// Use a smaller WebGL surface on lower-end devices to avoid UI jank.
const chooseOutputHeight = () => {
  const cpu = navigator.hardwareConcurrency || 4
  const memory = (navigator as Navigator & { deviceMemory?: number }).deviceMemory
  return cpu <= 4 || (memory !== undefined && memory <= 3) ? 960 : 1280
}

/**
 * Real camera pipeline: getUserMedia -> WebGL color/beauty shader -> canvas.
 * Face mesh and person segmentation run on-device (MediaPipe) so reshape and
 * background effects follow the face frame-by-frame.
 */
export function useCameraStudio({ state, audio = false, paused = false, aspect = 9 / 16 }: Options) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const arCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const threeCanvasRef=useRef<HTMLCanvasElement|null>(null)
  const threeEngineRef=useRef<FaceMesh3DEngine|null>(null)
  const face3DRef=useRef<Face3DFrame|null>(null)
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const recordingCompositeRef=useRef(false)
  const compositeArRef=useRef(false)
  const rendererRef = useRef<FilterRenderer | null>(null)
  const filteredFrameReadyRef = useRef(false)
  const gpu2RequestedRef=useRef(false)
  const gpu2ActiveRef=useRef(false)
  const streamRef = useRef<MediaStream | null>(null)
  const stateRef = useRef(state)
  const faceRef = useRef<FaceGeometry | null>(null)
  const maskRef = useRef<{ data: Uint8Array; width: number; height: number } | null>(null)
  const lastVisionRef = useRef(0)
  const inferenceMsRef = useRef(0)
  const visionBusyRef = useRef(false)
  const activeRef = useRef(!paused)
  const fpsRef = useRef({last:0,frames:0})
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])
  const compareRef = useRef(false)

  const [facing, setFacing] = useState<Facing>('user')
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [vision, setVision] = useState<VisionStatus>('off')
  const [hasMultipleCameras, setHasMultipleCameras] = useState(true)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number } | null>(null)
  const [zoom, setZoomState] = useState(1)
  const [recording, setRecording] = useState(false)
  const [previewFps,setPreviewFps] = useState<number | null>(null)
  const [gpuAvailable,setGpuAvailable] = useState(true)
  const [gpu2Active,setGpu2Active] = useState(false)
  const [threeStatus,setThreeStatus]=useState<'idle'|'loading'|'ready'|'unavailable'>('idle')
  const [threeQuality,setThreeQuality]=useState<'hd'|'fallback'|'none'>('none')
  const [resolution, setResolution] = useState<{ width: number; height: number } | null>(null)

  stateRef.current = state
  activeRef.current = !paused
  const executionPlan = createRealityExecutionPlan(state)
  compositeArRef.current = executionPlan.faceOverlay

  const needsFace = executionPlan.trackFace
  const needsMask = executionPlan.trackPerson

  useEffect(()=>{
    // Device QA opt-in only until Android/iOS parity and sustained FPS pass.
    gpu2RequestedRef.current=new URLSearchParams(window.location.search).get('realityGpu')==='2'
  },[])

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((track) => track.stop())
    streamRef.current = null
  }, [])

  const start = useCallback(
    async (nextFacing: Facing) => {
      if (typeof navigator === 'undefined' || !navigator.mediaDevices?.getUserMedia) {
        setStatus('unsupported')
        return
      }
      setStatus('starting')
      stopStream()
      try {
        // A fresh stream per facing mode is the only reliable way to switch cameras on iOS and Android.
        const stream = await navigator.mediaDevices.getUserMedia({
          video: {
            facingMode: { ideal: nextFacing },
            width: { ideal: 1920 },
            height: { ideal: 1080 },
            frameRate: { ideal: 30, max: 60 },
          },
          audio: audio ? { echoCancellation: true, noiseSuppression: true, autoGainControl: true } : false,
        })
        streamRef.current = stream
        const track = stream.getVideoTracks()[0]
        const settings = track.getSettings()
        const capabilities = (track.getCapabilities?.() ?? {}) as MediaTrackCapabilities & {
          torch?: boolean
          zoom?: { min: number; max: number }
        }
        setTorchSupported(Boolean(capabilities.torch))
        setTorchOn(false)
        setZoomRange(capabilities.zoom ? { min: capabilities.zoom.min, max: Math.min(capabilities.zoom.max, 10) } : null)
        setZoomState(1)
        setResolution(settings.width && settings.height ? { width: settings.width, height: settings.height } : null)

        const actualFacing = (settings.facingMode as Facing | undefined) ?? nextFacing
        setFacing(actualFacing)

        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          video.muted = true
          await video.play().catch(() => undefined)
        }
        // Native HTML video and the transparent Face AR layer can still work
        // on phones where the WebGL color renderer cannot initialize.
        setStatus('ready')

        navigator.mediaDevices
          .enumerateDevices()
          .then((devices) => setHasMultipleCameras(devices.filter((device) => device.kind === 'videoinput').length > 1))
          .catch(() => undefined)
      } catch (error) {
        const name = (error as DOMException)?.name
        setStatus(name === 'NotAllowedError' || name === 'SecurityError' ? 'denied' : 'error')
      }
    },
    [audio, stopStream],
  )

  useEffect(() => {
    start('user')
    return () => {
      recorderRef.current?.state === 'recording' && recorderRef.current.stop()
      stopStream()
    }
  }, [start, stopStream])

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const video=videoRef.current
    const rect=video?.getBoundingClientRect()
    const initial=cameraSurfaceDimensions(rect?.width??0,rect?.height??0,chooseOutputHeight())
      ??{width:Math.round(chooseOutputHeight()*aspect),height:chooseOutputHeight()}
    canvas.height=initial.height
    canvas.width=initial.width
    filteredFrameReadyRef.current = false
    try {
      rendererRef.current = new FilterRenderer(canvas)
      setGpuAvailable(true)
    } catch {
      rendererRef.current = null
      setGpuAvailable(false)
    }
    const overlay=arCanvasRef.current
    if(overlay){overlay.width=canvas.width;overlay.height=canvas.height}
    if(threeCanvasRef.current){threeCanvasRef.current.width=canvas.width;threeCanvasRef.current.height=canvas.height}
    const composition=document.createElement('canvas')
    composition.width=canvas.width;composition.height=canvas.height
    compositeCanvasRef.current=composition
    const resizeToActualViewport=()=>{
      const videoRect=video?.getBoundingClientRect()
      const desired=cameraSurfaceDimensions(videoRect?.width??0,videoRect?.height??0,chooseOutputHeight())
      if(!desired)return
      if(Math.abs(canvas.width-desired.width)<2&&canvas.height===desired.height)return
      canvas.width=desired.width;canvas.height=desired.height
      if(overlay){overlay.width=desired.width;overlay.height=desired.height}
      if(composition){composition.width=desired.width;composition.height=desired.height}
      if(threeCanvasRef.current){
        if(threeEngineRef.current)threeEngineRef.current.resize(desired.width,desired.height)
        else{threeCanvasRef.current.width=desired.width;threeCanvasRef.current.height=desired.height}
      }
    }
    const resizeObserver=typeof ResizeObserver!=='undefined' ? new ResizeObserver(resizeToActualViewport) : null
    if(video)resizeObserver?.observe(video)
    const onViewportChange=()=>resizeToActualViewport()
    window.addEventListener('resize',onViewportChange,{passive:true})
    resizeToActualViewport()
    return () => {
      resizeObserver?.disconnect()
      window.removeEventListener('resize',onViewportChange)
      rendererRef.current?.dispose()
      rendererRef.current = null
      filteredFrameReadyRef.current = false
      compositeCanvasRef.current = null
    }
  }, [aspect])

  useEffect(() => {
    if (!needsFace && !needsMask) {
      faceRef.current = null
      maskRef.current = null
      setVision('off')
      return
    }
    let cancelled = false
    setVision('loading')
    Promise.all([needsFace ? loadFaceLandmarker() : null, needsMask ? loadSegmenter() : null])
      .then(() => !cancelled && setVision(value => value === 'tracking' ? value : 'ready'))
      .catch(() => !cancelled && setVision('unavailable'))
    return () => {
      cancelled = true
    }
  }, [needsFace, needsMask])

  /** All photo/video/live outputs composite the SAME graded GPU frame + AR layers. */
  const drawCompositeFrame = (video:HTMLVideoElement, mode:Facing, layer:HTMLCanvasElement|null)=>{
    return composeRealityFrame({
      target:compositeCanvasRef.current,
      video,
      filtered:filteredFrameReadyRef.current?canvasRef.current:null,
      overlay:layer,
      face3d:isFace3DSelected(stateRef.current.face.id)?threeCanvasRef.current:null,
      mirror:mode==='user',
      showEffects:!compareRef.current,
      effectOpacity:stateRef.current.face.strength,
    })
  }

  useEffect(()=>{
    if(!isFace3DSelected(state.face.id)){setThreeStatus('idle');setThreeQuality('none');return}
    let cancelled=false
    setThreeStatus('loading')
    setThreeQuality('none')
    import('./face3d').then(async({FaceMesh3DEngine,isFace3DId})=>{
      if(!isFace3DId(state.face.id))return
      if(cancelled)return
      const layer=threeCanvasRef.current,base=canvasRef.current
      if(!layer||!base)return
      let engine=threeEngineRef.current
      if(!engine){engine=new FaceMesh3DEngine(layer,base.width,base.height);threeEngineRef.current=engine}
      const loaded=await engine.setLens(state.face.id)
      if(!cancelled){setThreeQuality(loaded?engine.modelQuality:'none');setThreeStatus(loaded?'ready':'unavailable')}
    }).catch(()=>{if(!cancelled){setThreeQuality('none');setThreeStatus('unavailable')}})
    return()=>{cancelled=true}
  },[state.face.id])
  useEffect(()=>()=>{threeEngineRef.current?.dispose();threeEngineRef.current=null},[])

  useEffect(() => {
    if (status !== 'ready') return
    const video = videoRef.current as VideoWithFrameCallback | null
    if (!video) return
    let frameId = 0
    let stopped = false
    let lostFrames = 0

    const runVision = async (now: number) => {
      // Serialize ML inference and keep WebGL rendering independent.
      if (visionBusyRef.current || document.hidden) return
      const current = stateRef.current
      const plan = createRealityExecutionPlan(current)
      const wantsFace = plan.trackFace
      const wantsMask = plan.trackPerson
      if (!wantsFace && !wantsMask) return
      const cores=navigator.hardwareConcurrency||4
      const memory=(navigator as Navigator & {deviceMemory?:number}).deviceMemory
      const interval=trackingIntervalMs(inferenceMsRef.current,cores,memory,wantsMask)
      if(now-lastVisionRef.current<interval)return
      lastVisionRef.current = now
      visionBusyRef.current = true
      try {
      const aspectRatio = video.videoWidth / video.videoHeight
      if (wantsFace) {
        const landmarker = await loadFaceLandmarker().catch(() => null)
        if (!landmarker) { setVision('unavailable'); faceRef.current=null; return }
        try{await configureFace3DExtras(isFace3DSelected(current.face.id))}
        catch{/* tracked coordinates still work without expression extras */}
        let result: ReturnType<typeof landmarker.detectForVideo> | null = null
        try {
          result = landmarker.detectForVideo(video, now)
        } catch {
          try {
            const cpu = await recoverFaceLandmarkerOnCpu()
            result = cpu?.detectForVideo(video, now) ?? null
          } catch {
            faceRef.current = null
            setVision('unavailable')
            return
          }
          if (!result) { faceRef.current=null; setVision('unavailable'); return }
        }
        const landmarks = result?.faceLandmarks?.[0]
        if (landmarks) {
          lostFrames = 0
          if(isFace3DSelected(current.face.id)){
            const previous=face3DRef.current
            const tracked=stabilizeFaceMesh(previous?.landmarks??null,
              landmarks.map(p=>({x:p.x,y:p.y,z:p.z??0})),
              previous?now-previous.timestamp:0,aspectRatio)
            // Pose and deformable mesh need identical stabilized points;
            // independently smoothed anchors cause floating facial overlays.
            const aligned=toFaceGeometry(tracked,aspectRatio)
            faceRef.current=aligned
            const blends:Record<string,number>={}
            for(const item of result?.faceBlendshapes?.[0]?.categories||[])
              blends[item.categoryName]=item.score
            face3DRef.current={
              landmarks:tracked,
              geometry:aligned,
              matrix:result?.facialTransformationMatrixes?.[0]?.data?
                Array.from(result.facialTransformationMatrixes[0].data):undefined,
              blendshapes:blends,timestamp:now,
            }
          } else {
            face3DRef.current=null
            faceRef.current=smoothFace(faceRef.current,toFaceGeometry(landmarks,aspectRatio))
          }
          setVision((value) => (value === 'tracking' ? value : 'tracking'))
        } else if (++lostFrames > 4) {
          faceRef.current = null
          face3DRef.current=null
          setVision((value) => (value === 'no-face' ? value : 'no-face'))
        }
      }
      if (wantsMask) {
        const segmenter = await loadSegmenter().catch(() => null)
        segmenter?.segmentForVideo(video, now, (result) => {
          const mask = result.confidenceMasks?.[0]
          if (!mask) return
          const floats = mask.getAsFloat32Array()
          const bytes = new Uint8Array(floats.length)
          for (let i = 0; i < floats.length; i++) bytes[i] = floats[i] * 255
          maskRef.current = { data: bytes, width: mask.width, height: mask.height }
        })
      }
      } finally {
        inferenceMsRef.current=updatedMean(inferenceMsRef.current,performance.now()-now)
        visionBusyRef.current=false
      }
    }

    const draw = () => {
      if (stopped) return
      const now = performance.now()
      if (activeRef.current && !document.hidden && video.readyState >= 2 && video.videoWidth) {
        runVision(now).catch(() => { faceRef.current=null; setVision('unavailable') })
        const current = stateRef.current
        const original = compareRef.current
        const overlay=arCanvasRef.current
        const overlayCtx=overlay?.getContext('2d')
        if(overlayCtx && overlay){
          overlayCtx.clearRect(0,0,overlay.width,overlay.height)
          if(compositeArRef.current && !original){
            drawFaceMask(overlayCtx,faceRef.current,current.face,
              video.videoWidth,video.videoHeight,overlay.width,overlay.height,
              facing==='user',now/1000)
          }
        }
        // A single Three.js WebGL context handles the camera shader, face
        // depth and PBR assets in QA mode. Legacy stays the safe default.
        let frameUsedGpu2=false
        if(isFace3DSelected(current.face.id)&&threeEngineRef.current){
          try{
            const tracked=face3DRef.current
            const fresh=tracked&&hasFreshFace(tracked.timestamp,now)?tracked:null
            const candidate=shouldUseRealityGpu2(gpu2RequestedRef.current,true,current)
            const cameraInput:RenderInput|undefined=candidate?{
              source:video,
              color:original?neutralColor:resolveColor(current),
              beauty:original?neutralBeauty:current.beauty,
              effects:original?neutralEffects:current.effects,
              faceFx:neutralFaceFx,
              mirror:facing==='user',
              face:faceRef.current,
              mask:maskRef.current,
              time:now/1000,
            }:undefined
            threeEngineRef.current.render(original?null:fresh,
              video.videoWidth,video.videoHeight,facing==='user',
              current.face.id,current.face.strength,current.face.makeup,cameraInput)
            frameUsedGpu2=candidate
          }catch{
            threeEngineRef.current.dispose()
            threeEngineRef.current=null
            frameUsedGpu2=false
            setThreeStatus('unavailable')
          }
        }
        if(gpu2ActiveRef.current!==frameUsedGpu2){
          gpu2ActiveRef.current=frameUsedGpu2
          setGpu2Active(frameUsedGpu2)
        }
        // Legacy shader remains fully supported for all normal flows.
        // In GPU v2 the SAME GLSL executes inside FaceMesh3DEngine, avoiding
        // another GL pass and a Canvas2D recording compositing readback.
        if(!frameUsedGpu2&&rendererRef.current){
          try{
            filteredFrameReadyRef.current=rendererRef.current.render({
              source:video,
              color:original?neutralColor:resolveColor(current),
              beauty:original?neutralBeauty:current.beauty,
              effects:original?neutralEffects:current.effects,
              faceFx:neutralFaceFx,
              mirror:facing==='user',
              face:faceRef.current,
              mask:maskRef.current,
              time:now/1000,
            })===true
          }catch{
            // Preserve camera usability when a mobile WebGL context fails.
            filteredFrameReadyRef.current=false
            rendererRef.current?.dispose()
            rendererRef.current=null
            setGpuAvailable(false)
          }
        }
        // Integrated GPU v2 records Three.js's final canvas directly.
        if(frameUsedGpu2)filteredFrameReadyRef.current=false
        if(recordingCompositeRef.current)drawCompositeFrame(video,facing,overlay)
        const fps=fpsRef.current
        fps.frames+=1
        if(fps.last===0)fps.last=now
        else if(now-fps.last>=1200){
          setPreviewFps(Math.round(1000*fps.frames/(now-fps.last)))
          fps.last=now;fps.frames=0
        }
      }
      schedule()
    }

    const schedule = () => {
      if (video.requestVideoFrameCallback) frameId = video.requestVideoFrameCallback(draw)
      else frameId = requestAnimationFrame(draw)
    }
    schedule()
    return () => {
      stopped = true
      if (video.cancelVideoFrameCallback) video.cancelVideoFrameCallback(frameId)
      cancelAnimationFrame(frameId)
    }
  }, [status, facing])

  const flip = useCallback(() => {
    faceRef.current = null
    face3DRef.current=null
    return start(facing === 'user' ? 'environment' : 'user')
  }, [facing, start])

  const setTorch = useCallback(async (on: boolean) => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints({ advanced: [{ torch: on } as MediaTrackConstraintSet] })
      setTorchOn(on)
    } catch {
      setTorchOn(false)
    }
  }, [])

  const setZoom = useCallback(async (value: number) => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    setZoomState(value)
    await track.applyConstraints({ advanced: [{ zoom: value } as MediaTrackConstraintSet] }).catch(() => undefined)
  }, [])

  /** Hold-to-compare: renders the untouched camera feed while true. */
  const setCompare = useCallback((value: boolean) => {
    compareRef.current = value
  }, [])

  const capturePhoto = useCallback((quality=0.95)=>{
    if(gpu2ActiveRef.current && threeCanvasRef.current)
      return threeCanvasRef.current.toDataURL('image/jpeg',quality)
    if(compositeArRef.current){
      const video=videoRef.current
      if(video?.videoWidth){
        drawCompositeFrame(video,facing,arCanvasRef.current)
        return compositeCanvasRef.current?.toDataURL('image/jpeg',quality)??null
      }
      return null
    }
    if(!filteredFrameReadyRef.current && videoRef.current?.videoWidth){
      drawCompositeFrame(videoRef.current,facing,null)
      return compositeCanvasRef.current?.toDataURL('image/jpeg',quality)??null
    }
    return canvasRef.current?.toDataURL('image/jpeg',quality)??null
  },[facing])

  /** Small frame for AI analysis — keeps the request fast and cheap. */
  const captureAnalysisFrame = useCallback(() => {
    const video = videoRef.current
    if (!video?.videoWidth) return null
    const scale = 512 / Math.max(video.videoWidth, video.videoHeight)
    const canvas = document.createElement('canvas')
    canvas.width = Math.round(video.videoWidth * scale)
    canvas.height = Math.round(video.videoHeight * scale)
    canvas.getContext('2d')?.drawImage(video, 0, 0, canvas.width, canvas.height)
    return canvas.toDataURL('image/jpeg', 0.8)
  }, [])

  /** Filtered output stream (canvas video + mic audio) — used for recording and live broadcast. */
  const getOutputStream = useCallback(() => {
    const canvas = gpu2ActiveRef.current?threeCanvasRef.current:
      compositeArRef.current||!filteredFrameReadyRef.current?
        compositeCanvasRef.current:canvasRef.current
    if (!canvas) return null
    if(canvas===compositeCanvasRef.current && videoRef.current?.videoWidth)
      drawCompositeFrame(videoRef.current,facing,arCanvasRef.current)
    const output = canvas.captureStream(30)
    streamRef.current?.getAudioTracks().forEach((track) => output.addTrack(track))
    return output
  }, [facing])

  const startRecording = useCallback(() => {
    recordingCompositeRef.current = !gpu2ActiveRef.current && (compositeArRef.current||!filteredFrameReadyRef.current)
    const output = getOutputStream()
    if (!output || typeof MediaRecorder === 'undefined') { recordingCompositeRef.current=false; return false }
    const mimeType = ['video/mp4;codecs=avc1', 'video/webm;codecs=vp9,opus', 'video/webm;codecs=vp8,opus', 'video/webm'].find((type) =>
      MediaRecorder.isTypeSupported(type),
    )
    const recorder = new MediaRecorder(output, { mimeType, videoBitsPerSecond: 6_000_000 })
    chunksRef.current = []
    recorder.ondataavailable = (event) => event.data.size && chunksRef.current.push(event.data)
    recorder.start(250)
    recorderRef.current = recorder
    setRecording(true)
    return true
  }, [getOutputStream])

  const stopRecording = useCallback(
    () =>
      new Promise<Blob | null>((resolve) => {
        const recorder = recorderRef.current
        if (!recorder || recorder.state !== 'recording') {
          resolve(null)
          return
        }
        recorder.onstop = () => {
          recordingCompositeRef.current=false
          setRecording(false)
          resolve(new Blob(chunksRef.current, { type: recorder.mimeType || 'video/webm' }))
        }
        recorder.stop()
      }),
    [],
  )

  return {
    videoRef,
    canvasRef,
    arCanvasRef,
    threeCanvasRef,
    threeStatus,
    threeQuality,
    gpuAvailable,
    gpu2Active,
    status,
    vision,
    facing,
    resolution,
    hasMultipleCameras,
    torchSupported,
    torchOn,
    zoomRange,
    zoom,
    recording,
    previewFps,
    retry: () => start(facing),
    flip,
    setTorch,
    setZoom,
    setCompare,
    capturePhoto,
    captureAnalysisFrame,
    getOutputStream,
    startRecording,
    stopRecording,
  }
}

export type CameraStudio = ReturnType<typeof useCameraStudio>
