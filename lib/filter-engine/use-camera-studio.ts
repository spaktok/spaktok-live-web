'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FilterRenderer, type FaceGeometry } from './renderer'
import { needsFaceTracking, needsFaceFxTracking, needsSegmentation, neutralBeauty, neutralColor, neutralEffects, neutralFaceFx, resolveColor, type StudioState } from './params'
import { loadFaceLandmarker, recoverFaceLandmarkerOnCpu, loadSegmenter, smoothFace, toFaceGeometry } from './vision'
import { drawFaceMask, drawCoverFrame } from './face-overlay'

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
  const compositeCanvasRef = useRef<HTMLCanvasElement | null>(null)
  const recordingNativeArRef=useRef(false)
  const usingNativeArRef=useRef(false)
  const rendererRef = useRef<FilterRenderer | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const stateRef = useRef(state)
  const faceRef = useRef<FaceGeometry | null>(null)
  const maskRef = useRef<{ data: Uint8Array; width: number; height: number } | null>(null)
  const lastVisionRef = useRef(0)
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
  const [resolution, setResolution] = useState<{ width: number; height: number } | null>(null)

  stateRef.current = state
  activeRef.current = !paused
  usingNativeArRef.current = needsFaceFxTracking(state.face)

  const needsFace = needsFaceTracking(state.beauty) || needsFaceFxTracking(state.face)
  const needsMask = needsSegmentation(state.effects)

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
    const height = chooseOutputHeight()
    canvas.height = height
    canvas.width = Math.round(height * aspect)
    try {
      rendererRef.current = new FilterRenderer(canvas)
      setGpuAvailable(true)
    } catch {
      rendererRef.current = null
      setGpuAvailable(false)
    }
    const overlay=arCanvasRef.current
    if(overlay){overlay.width=canvas.width;overlay.height=canvas.height}
    const composition=document.createElement('canvas')
    composition.width=canvas.width;composition.height=canvas.height
    compositeCanvasRef.current=composition
    return () => {
      rendererRef.current?.dispose()
      rendererRef.current = null
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

  const drawCompositeFrame = (video:HTMLVideoElement, mode:Facing, layer:HTMLCanvasElement|null)=>{
    const surface=compositeCanvasRef.current
    const ctx=surface?.getContext('2d',{alpha:false})
    if(!ctx||!surface)return false
    if(!drawCoverFrame(ctx,video,surface.width,surface.height,mode==='user'))return false
    if(layer&&!compareRef.current)ctx.drawImage(layer,0,0,surface.width,surface.height)
    return true
  }

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
      const wantsFace = needsFaceTracking(current.beauty) || needsFaceFxTracking(current.face)
      const wantsMask = needsSegmentation(current.effects)
      if (!wantsFace && !wantsMask) return
      if (now - lastVisionRef.current < (wantsMask ? 150 : 90)) return
      lastVisionRef.current = now
      visionBusyRef.current = true
      try {
      const aspectRatio = video.videoWidth / video.videoHeight
      if (wantsFace) {
        const landmarker = await loadFaceLandmarker().catch(() => null)
        if (!landmarker) { setVision('unavailable'); faceRef.current=null; return }
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
          faceRef.current = smoothFace(faceRef.current, toFaceGeometry(landmarks, aspectRatio))
          setVision((value) => (value === 'tracking' ? value : 'tracking'))
        } else if (++lostFrames > 4) {
          faceRef.current = null
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
      } finally { visionBusyRef.current = false }
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
          if(usingNativeArRef.current && !original){
            drawFaceMask(overlayCtx,faceRef.current,current.face,
              video.videoWidth,video.videoHeight,overlay.width,overlay.height,
              facing==='user',now/1000)
          }
        }
        if(usingNativeArRef.current){
          // Native video is composited by the browser for the preview; do not
          // re-upload every face frame to WebGL on mobile graphics drivers.
          if(recordingNativeArRef.current) drawCompositeFrame(video,facing,overlay)
        }else if(rendererRef.current){
          try{
            rendererRef.current.render({
              source: video,
              color: original ? neutralColor : resolveColor(current),
              beauty: original ? neutralBeauty : current.beauty,
              effects: original ? neutralEffects : current.effects,
              faceFx: neutralFaceFx,
              mirror: facing === 'user',
              face: faceRef.current,
              mask: maskRef.current,
              time: now / 1000,
            })
          }catch{setGpuAvailable(false)}
        }
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
    if(usingNativeArRef.current){
      const video=videoRef.current
      if(video?.videoWidth){
        drawCompositeFrame(video,facing,arCanvasRef.current)
        return compositeCanvasRef.current?.toDataURL('image/jpeg',quality)??null
      }
      return null
    }
    if(!rendererRef.current && videoRef.current?.videoWidth){
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
    const canvas = usingNativeArRef.current||!rendererRef.current?
      compositeCanvasRef.current:canvasRef.current
    if (!canvas) return null
    if(canvas===compositeCanvasRef.current && videoRef.current?.videoWidth)
      drawCompositeFrame(videoRef.current,facing,arCanvasRef.current)
    const output = canvas.captureStream(30)
    streamRef.current?.getAudioTracks().forEach((track) => output.addTrack(track))
    return output
  }, [])

  const startRecording = useCallback(() => {
    recordingNativeArRef.current = usingNativeArRef.current||!rendererRef.current
    const output = getOutputStream()
    if (!output || typeof MediaRecorder === 'undefined') { recordingNativeArRef.current=false; return false }
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
          recordingNativeArRef.current=false
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
    gpuAvailable,
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
