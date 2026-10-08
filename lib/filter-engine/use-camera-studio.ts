'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { FilterRenderer, type FaceGeometry } from './renderer'
import { resolveColor, type StudioState } from './params'
import { loadFaceLandmarker, loadSegmenter, smoothFace, toFaceGeometry } from './vision'

export type Facing = 'user' | 'environment'
export type CameraStatus = 'idle' | 'starting' | 'ready' | 'denied' | 'unsupported' | 'error'
export type VisionStatus = 'off' | 'loading' | 'tracking' | 'no-face' | 'unavailable'

interface Options {
  state: StudioState
  audio?: boolean
  /** Output aspect ratio (width / height). Portrait 9:16 matches stories and live. */
  aspect?: number
}

type VideoWithFrameCallback = HTMLVideoElement & {
  requestVideoFrameCallback?: (cb: () => void) => number
  cancelVideoFrameCallback?: (id: number) => void
}

const OUTPUT_HEIGHT = 1280

/**
 * Real camera pipeline: getUserMedia -> WebGL color/beauty shader -> canvas.
 * Face mesh and person segmentation run on-device (MediaPipe) so reshape and
 * background effects follow the face frame-by-frame.
 */
export function useCameraStudio({ state, audio = false, aspect = 9 / 16 }: Options) {
  const videoRef = useRef<HTMLVideoElement | null>(null)
  const canvasRef = useRef<HTMLCanvasElement | null>(null)
  const rendererRef = useRef<FilterRenderer | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const stateRef = useRef(state)
  const faceRef = useRef<FaceGeometry | null>(null)
  const maskRef = useRef<{ data: Uint8Array; width: number; height: number } | null>(null)
  const lastVisionRef = useRef(0)
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  const [facing, setFacing] = useState<Facing>('user')
  const [status, setStatus] = useState<CameraStatus>('idle')
  const [vision, setVision] = useState<VisionStatus>('off')
  const [hasMultipleCameras, setHasMultipleCameras] = useState(true)
  const [torchSupported, setTorchSupported] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [zoomRange, setZoomRange] = useState<{ min: number; max: number } | null>(null)
  const [zoom, setZoomState] = useState(1)
  const [recording, setRecording] = useState(false)
  const [resolution, setResolution] = useState<{ width: number; height: number } | null>(null)

  stateRef.current = state

  const needsFace = Object.values(state.beauty).some((value) => value > 0)
  const needsMask = state.effects.backgroundBlur > 0

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
    canvas.height = OUTPUT_HEIGHT
    canvas.width = Math.round(OUTPUT_HEIGHT * aspect)
    try {
      rendererRef.current = new FilterRenderer(canvas)
    } catch {
      rendererRef.current = null
    }
    return () => {
      rendererRef.current?.dispose()
      rendererRef.current = null
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
      .then(() => !cancelled && setVision('tracking'))
      .catch(() => !cancelled && setVision('unavailable'))
    return () => {
      cancelled = true
    }
  }, [needsFace, needsMask])

  useEffect(() => {
    if (status !== 'ready') return
    const video = videoRef.current as VideoWithFrameCallback | null
    if (!video) return
    let frameId = 0
    let stopped = false
    let lostFrames = 0

    const runVision = async (now: number) => {
      // Vision runs at ~30fps max; rendering stays at the camera's native rate.
      if (now - lastVisionRef.current < 33) return
      lastVisionRef.current = now
      const current = stateRef.current
      const wantsFace = Object.values(current.beauty).some((value) => value > 0)
      const wantsMask = current.effects.backgroundBlur > 0
      const aspectRatio = video.videoWidth / video.videoHeight
      if (wantsFace) {
        const landmarker = await loadFaceLandmarker().catch(() => null)
        const result = landmarker?.detectForVideo(video, now)
        const landmarks = result?.faceLandmarks?.[0]
        if (landmarks) {
          lostFrames = 0
          faceRef.current = smoothFace(faceRef.current, toFaceGeometry(landmarks, aspectRatio))
          setVision((value) => (value === 'tracking' ? value : 'tracking'))
        } else if (++lostFrames > 6) {
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
    }

    const draw = () => {
      if (stopped) return
      const now = performance.now()
      if (video.readyState >= 2 && video.videoWidth) {
        runVision(now).catch(() => undefined)
        const current = stateRef.current
        rendererRef.current?.render({
          source: video,
          color: resolveColor(current),
          beauty: current.beauty,
          backgroundBlur: current.effects.backgroundBlur,
          mirror: facing === 'user',
          face: faceRef.current,
          mask: maskRef.current,
          time: now / 1000,
        })
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

  const capturePhoto = useCallback((quality = 0.95) => canvasRef.current?.toDataURL('image/jpeg', quality) ?? null, [])

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
    const canvas = canvasRef.current
    if (!canvas) return null
    const output = canvas.captureStream(30)
    streamRef.current?.getAudioTracks().forEach((track) => output.addTrack(track))
    return output
  }, [])

  const startRecording = useCallback(() => {
    const output = getOutputStream()
    if (!output || typeof MediaRecorder === 'undefined') return false
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
    retry: () => start(facing),
    flip,
    setTorch,
    setZoom,
    capturePhoto,
    captureAnalysisFrame,
    getOutputStream,
    startRecording,
    stopRecording,
  }
}

export type CameraStudio = ReturnType<typeof useCameraStudio>
