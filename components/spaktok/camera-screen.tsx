'use client'

import { useEffect, useRef, useState } from 'react'
import { Camera, Download, Radio, RefreshCw, Send, SlidersHorizontal, Timer, X, Zap, Eye } from 'lucide-react'
import { cn } from '@/lib/utils'
import { createStudioState } from '@/lib/filter-engine/params'
import { useCameraStudio } from '@/lib/filter-engine/use-camera-studio'
import { useStudioStrings } from '@/lib/filter-engine/strings'
import { StudioPanel } from './studio/studio-panel'
import { FaceMaskTray } from './studio/face-mask-tray'
import { StoryComposer } from './stories/story-composer'
import { uploadVideoDirect } from '@/lib/video/direct-upload-client'

interface CameraScreenProps {
  onClose: () => void
  initialMode?: CaptureMode
}

type CaptureMode = 'photo' | '15s' | '60s' | 'story' | 'live'

const durations: Partial<Record<CaptureMode, number>> = { '15s': 15, '60s': 60, story: 15 }

type Captured = { kind: 'photo'; url: string } | { kind: 'video'; url: string; blob: Blob }

export function CameraScreen({ onClose, initialMode = 'photo' }: CameraScreenProps) {
  const { s } = useStudioStrings()
  const [studio, setStudio] = useState(() => createStudioState())
  const [mode, setMode] = useState<CaptureMode>(initialMode)
  const [showPanel, setShowPanel] = useState(false)
  const [showFaceTray,setShowFaceTray] = useState(true)
  const [timerSeconds, setTimerSeconds] = useState<0 | 3 | 10>(0)
  const [countdown, setCountdown] = useState<number | null>(null)
  const [progress, setProgress] = useState(0)
  const [captured, setCaptured] = useState<Captured | null>(null)
  const [storyEditing, setStoryEditing] = useState(false)
  const [uploadEnabled, setUploadEnabled] = useState(false)
  const [uploadChecking, setUploadChecking] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [uploadCompleted, setUploadCompleted] = useState(false)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [uploadMessage, setUploadMessage] = useState<string | null>(null)
  const uploadAbortRef = useRef<AbortController | null>(null)
  const [isLive, setIsLive] = useState(false)
  const [liveSeconds, setLiveSeconds] = useState(0)
  const [liveTitle, setLiveTitle] = useState('')

  const camera = useCameraStudio({ state: studio, audio: mode !== 'photo', paused: Boolean(captured) })
  const progressRef = useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => () => {
    if (progressRef.current) clearInterval(progressRef.current)
  }, [])

  useEffect(() => {
    if (!isLive) return
    const id = setInterval(() => setLiveSeconds((value) => value + 1), 1000)
    return () => clearInterval(id)
  }, [isLive])

  useEffect(() => () => {
    if (captured) URL.revokeObjectURL(captured.url)
  }, [captured])

  useEffect(() => () => uploadAbortRef.current?.abort(), [])

  useEffect(() => {
    if (captured?.kind !== 'video') return
    const controller = new AbortController()
    setUploadChecking(true)
    setUploadMessage(null)
    setUploadCompleted(false)
    fetch('/api/videos/upload/initiate', { cache: 'no-store', signal: controller.signal })
      .then(async (res) => res.ok ? res.json() as Promise<{ enabled?: boolean }> : { enabled: false })
      .then((data) => { if (!controller.signal.aborted) setUploadEnabled(data.enabled === true) })
      .catch(() => { if (!controller.signal.aborted) setUploadEnabled(false) })
      .finally(() => { if (!controller.signal.aborted) setUploadChecking(false) })
    return () => controller.abort()
  }, [captured?.kind])

  const submitCapturedVideo = async () => {
    if (!captured || captured.kind !== 'video' || uploading || uploadCompleted) return
    if (!uploadEnabled) {
      setUploadMessage('رفع الفيديو غير مفعّل بعد. يمكنك حفظه على الجهاز.')
      return
    }
    const blob = captured.blob
    const mimeType = blob.type.split(';')[0] || 'video/webm'
    if (!['video/mp4', 'video/webm'].includes(mimeType) ||
        blob.size < 1024 || blob.size > 20 * 1024 * 1024) {
      setUploadMessage('الملف غير مدعوم أو أكبر من 20 ميغابايت.')
      return
    }
    const controller = new AbortController()
    uploadAbortRef.current = controller
    setUploading(true)
    setUploadProgress(0)
    setUploadMessage(null)
    try {
      const res = await fetch('/api/videos/upload/initiate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        cache: 'no-store',
        signal: controller.signal,
        body: JSON.stringify({
          name: mimeType === 'video/mp4' ? 'spaktok.mp4' : 'spaktok.webm',
          bytes: blob.size,
          mimeType,
        }),
      })
      if (!res.ok) {
        const result = await res.json().catch(() => ({})) as { error?: string }
        if (res.status === 429) throw new Error('daily_limit')
        if (result.error === 'unauthorized') throw new Error('unauthorized')
        throw new Error('upload_setup_error')
      }
      const data = await res.json() as { uploadURL: string; reservationId: string }
      await uploadVideoDirect(data.uploadURL, blob, setUploadProgress, controller.signal)
      setUploadCompleted(true)
      setUploadMessage('تم حفظ الفيديو كمسودة خاصة في Cloudflare R2. لن يظهر للمشاهدين قبل المراجعة.')
    } catch (error) {
      if (!controller.signal.aborted) {
        const msg = error instanceof Error ? error.message : ''
        setUploadMessage(msg === 'daily_limit' ? 'وصلت إلى الحد اليومي التجريبي: 5 محاولات رفع.'
          : msg === 'unauthorized' ? 'يجب تسجيل الدخول لرفع الفيديو.'
          : 'تعذر رفع الفيديو. احفظه وحاول مجددًا لاحقًا.')
      }
    } finally {
      if (uploadAbortRef.current === controller) uploadAbortRef.current = null
      setUploading(false)
    }
  }

  const finishRecording = async () => {
    if (progressRef.current) clearInterval(progressRef.current)
    progressRef.current = null
    setProgress(0)
    const blob = await camera.stopRecording()
    if (blob) setCaptured({ kind: 'video', url: URL.createObjectURL(blob), blob })
  }

  const beginCapture = () => {
    if (mode === 'photo') {
      const url = camera.capturePhoto()
      if (url) setCaptured({ kind: 'photo', url })
      return
    }
    if (mode === 'live') {
      setIsLive(true)
      setLiveSeconds(0)
      setShowPanel(false)
      return
    }
    if (!camera.startRecording()) return
    const total = (durations[mode] ?? 15) * 1000
    const startedAt = performance.now()
    progressRef.current = setInterval(() => {
      const value = Math.min(1, (performance.now() - startedAt) / total)
      setProgress(value)
      if (value >= 1) finishRecording()
    }, 50)
  }

  const handleShutter = () => {
    if (camera.status !== 'ready' || countdown !== null) return
    if (camera.recording) {
      finishRecording()
      return
    }
    if (!timerSeconds || mode === 'live') {
      beginCapture()
      return
    }
    let remaining = timerSeconds
    setCountdown(remaining)
    const id = setInterval(() => {
      remaining -= 1
      if (remaining <= 0) {
        clearInterval(id)
        setCountdown(null)
        beginCapture()
      } else setCountdown(remaining)
    }, 1000)
  }

  const modes: CaptureMode[] = ['photo', '15s', '60s', 'story', 'live']
  const modeLabel = (value: CaptureMode) =>
    value === 'photo' ? s('photo') : value === '15s' ? s('video15') : value === '60s' ? s('video60') : value === 'story' ? s('story') : 'معاينة البث'

  const statusMessage =
    camera.status === 'denied' ? s('denied') : camera.status === 'unsupported' ? s('unsupported') : camera.status === 'error' ? s('cameraError') : s('starting')

  const faceArSelected = studio.face.id !== 'none'
  const visionMessage = faceArSelected
    ? camera.vision === 'loading'
      ? 'جارٍ تحميل محرك تتبع الوجه…'
      : camera.vision === 'tracking'
        ? '✓ تم اكتشاف الوجه — القناع نشط'
        : camera.vision === 'no-face' || camera.vision === 'ready'
          ? 'القناع محدد — وجّه وجهك إلى الكاميرا بإضاءة واضحة'
          : camera.vision === 'unavailable'
            ? 'تعذّر تشغيل تتبع الوجه على هذا الجهاز. القناع غير نشط.'
            : 'اختر قناعًا للبدء'
    : camera.vision === 'loading' ? s('loadingAi') :
      camera.vision === 'no-face' ? s('noFace') :
      camera.vision === 'unavailable' ? s('visionUnavailable') : null

  // Do not permanently cover the crown with a misleading "loading" banner.
  // Once 3D is visibly rendering, use silent status unless tracking fails.
  const faceHint = !faceArSelected || camera.status !== 'ready' ? null :
    camera.threeStatus === 'ready' && studio.face.id==='3d-gold-crown' && camera.threeQuality==='fallback'
      ? 'تعذر تحميل التاج التفصيلي؛ يُعرض نموذج احتياطي'
      : camera.threeStatus === 'unavailable' && studio.face.id.startsWith('3d-')
      ? 'تعذّر تحميل المجسم ثلاثي الأبعاد'
      : camera.vision === 'unavailable'
        ? 'تتبع الوجه غير متاح — تحقق من إذن الكاميرا'
        : camera.vision === 'no-face'
          ? 'اقترب قليلًا من الكاميرا مع إضاءة واضحة'
          : camera.vision === 'loading' && camera.threeStatus !== 'ready'
            ? 'جارٍ تجهيز تتبع الوجه…' : null

  const formatTime = (total: number) => `${String(Math.floor(total / 60)).padStart(2, '0')}:${String(total % 60).padStart(2, '0')}`

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black">


      <div className="relative h-full w-full max-w-[min(100vw,calc(100dvh*9/16))] overflow-hidden bg-black">
        <video ref={camera.videoRef} autoPlay playsInline muted
          className="pointer-events-none absolute inset-0 h-full w-full object-cover"
          style={{transform:camera.facing==='user'?'scaleX(-1)':undefined}}
          aria-label="معاينة الكاميرا الحقيقية"/>
        <canvas ref={camera.canvasRef}
          className={cn('pointer-events-none absolute inset-0 h-full w-full object-cover transition-opacity duration-200',
            camera.status==='ready'&&camera.gpuAvailable&&!camera.gpu2Active?'opacity-100':'opacity-0')}
          aria-hidden="true"/>
        {/* GPU-graded camera stays below the 2D/3D AR passes. All surfaces
            share the same crop, viewport dimensions and selfie mirroring. */}
        <canvas ref={camera.arCanvasRef}
          className={cn('pointer-events-none absolute inset-0 h-full w-full object-cover',
            studio.face.id==='none'?'opacity-0':'opacity-100')}
          aria-hidden="true"/>
        <canvas ref={camera.threeCanvasRef}
          className={cn('pointer-events-none absolute inset-0 h-full w-full object-cover',
            studio.face.id.startsWith('3d-')?'opacity-100':'opacity-0')}
          aria-label="مجسمات ثلاثية الأبعاد مرتبطة بالرأس" role="img"/>

        {camera.status !== 'ready' && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 px-8 text-center">
            <Camera className="h-12 w-12 text-white/30" />
            <p className="text-sm text-white/70">{statusMessage}</p>
            {(camera.status === 'denied' || camera.status === 'error') && (
              <button onClick={camera.retry} className="rounded-full bg-white px-5 py-2 text-sm font-semibold text-black">
                {s('retry')}
              </button>
            )}
          </div>
        )}

        {countdown !== null && (
          <div className="absolute inset-0 flex items-center justify-center bg-black/30">
            <span className="text-8xl font-bold tabular-nums text-white" aria-live="assertive">{countdown}</span>
          </div>
        )}

        <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
          <button onClick={isLive ? () => setIsLive(false) : onClose} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur" aria-label={s('close')}>
            <X className="h-5 w-5" />
          </button>

          {isLive ? (
            <div className="flex items-center gap-2">
              <span className="flex items-center gap-1.5 rounded-md bg-[#ff3b30] px-2 py-1 text-xs font-bold text-white">
                <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-white" />
                معاينة محلية • ليس بثًا
              </span>
              <span className="rounded-md bg-black/50 px-2 py-1 text-xs tabular-nums text-white">{formatTime(liveSeconds)}</span>
            </div>
          ) : camera.recording ? (
            <span className="flex items-center gap-1.5 rounded-full bg-black/50 px-3 py-1 text-xs font-semibold text-white">
              <span className="h-2 w-2 animate-pulse rounded-full bg-[#ff3b30]" />
              {s('recording')}
            </span>
          ) : (
            <div className="flex flex-col items-start gap-1.5">
              {!faceArSelected&&visionMessage&&<span className="rounded-full bg-black/50 px-3 py-1 text-[11px] text-white/80">{visionMessage}</span>}
              {camera.previewFps!==null&&
                <span className="rounded-full border border-[#90aaff]/20 bg-black/55 px-2.5 py-1 font-mono text-[10px] tabular-nums text-[#acc4ff]">
                  {camera.previewFps} FPS • Preview
                </span>}
              {camera.handMode!=='off'&&faceArSelected&&
                <span className="rounded-full bg-black/65 px-3 py-1 text-[10px] font-medium text-white/85">
                  Hand interaction: {camera.handMode==='grabbed'?'holding object':camera.handMode==='returning'?'returning to face':'pinch near wearable'}
                </span>}
              {camera.gpu2Active&&camera.gpu2Metrics&&
                <span className="rounded-full border border-white/15 bg-black/65 px-2.5 py-1 font-mono text-[10px] tabular-nums text-white/80"
                  title="CPU render submission time, not GPU execution time">
                  GPU2 • CPU {camera.gpu2Metrics.cpuRenderMs.toFixed(1)}ms • {camera.gpu2Metrics.drawCalls} draws • {camera.gpu2Metrics.passes} passes
                </span>}
            </div>
          )}

          <div className="flex flex-col gap-3">
            {camera.hasMultipleCameras && (
              <button onClick={camera.flip} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white backdrop-blur" aria-label={s('flip')}>
                <RefreshCw className="h-5 w-5" />
              </button>
            )}
            {camera.torchSupported && (
              <button
                onClick={() => camera.setTorch(!camera.torchOn)}
                className={cn('flex h-10 w-10 items-center justify-center rounded-full backdrop-blur', camera.torchOn ? 'bg-white text-black' : 'bg-black/40 text-white')}
                aria-label={s('flash')}
                aria-pressed={camera.torchOn}
              >
                <Zap className="h-5 w-5" />
              </button>
            )}
            {!isLive && mode !== 'live' && (
              <button
                onClick={() => setTimerSeconds((value) => (value === 0 ? 3 : value === 3 ? 10 : 0))}
                className={cn('relative flex h-10 w-10 items-center justify-center rounded-full backdrop-blur', timerSeconds ? 'bg-white text-black' : 'bg-black/40 text-white')}
                aria-label={`${s('timer')} ${timerSeconds || ''}`}
              >
                <Timer className="h-5 w-5" />
                {timerSeconds > 0 && <span className="absolute -bottom-1 -end-1 rounded-full bg-[#3155ff] px-1 text-[9px] font-bold text-white">{timerSeconds}</span>}
              </button>
            )}
            <button
              onClick={() => {setShowPanel(value=>!value);setShowFaceTray(false)}}
              className={cn('flex h-10 w-10 items-center justify-center rounded-full backdrop-blur', showPanel ? 'bg-white text-black' : 'bg-black/40 text-white')}
              aria-label="إعدادات الاستوديو المتقدمة"
              aria-pressed={showPanel}
            >
              <SlidersHorizontal className="h-5 w-5" />
            </button>
            <button type="button" onPointerDown={()=>camera.setCompare(true)}
              onPointerUp={()=>camera.setCompare(false)} onPointerCancel={()=>camera.setCompare(false)}
              onPointerLeave={()=>camera.setCompare(false)} aria-label="اضغط باستمرار لمقارنة قبل وبعد"
              className="flex h-10 w-10 items-center justify-center rounded-full bg-black/45 text-white/90 backdrop-blur active:bg-[#587ae9]">
              <Eye className="size-5"/>
            </button>
          </div>
        </div>

        {camera.zoomRange && !showPanel && (
          <div className="absolute inset-x-0 bottom-48 flex justify-center gap-2">
            {[1, 2, 5].filter((value) => value <= (camera.zoomRange?.max ?? 1)).map((value) => (
              <button
                key={value}
                onClick={() => camera.setZoom(value)}
                className={cn('h-9 w-9 rounded-full text-xs font-semibold', camera.zoom === value ? 'bg-white text-black' : 'bg-black/50 text-white')}
              >
                {value}x
              </button>
            ))}
          </div>
        )}

        {!camera.recording && !captured && !showPanel && !isLive && mode!=='live' &&
          <FaceMaskTray value={studio.face} onChange={face=>setStudio(prev=>({...prev,face}))}
            visible={showFaceTray} onToggle={()=>setShowFaceTray(v=>!v)}/>}
        {faceHint&&(
          <div className="pointer-events-none absolute inset-x-0 top-[max(4.75rem,env(safe-area-inset-top))] z-10 flex justify-center px-3">
            <span role="status" className="max-w-[85%] rounded-full border border-amber-200/25 bg-[#1a1c29]/80 px-3 py-1.5 text-center text-[11px] font-semibold text-amber-100 backdrop-blur-md">
              {faceHint}
            </span>
          </div>
        )}
        <div className="absolute inset-x-0 bottom-0 flex flex-col pb-[env(safe-area-inset-bottom)]">
          {isLive ? (
            <div className="flex flex-col gap-3 bg-gradient-to-t from-black/80 to-transparent p-4">
              <p className="text-xs text-white/70" dir="rtl">معاينة محلية للفلاتر قبل البث. لم تبدأ بثًا عامًا، ولا يوجد مشاهدون.</p>
              <div className="flex items-center gap-2">
                <button onClick={() => setShowPanel((value) => !value)} className="flex-1 rounded-full bg-white/15 py-2.5 text-sm font-semibold text-white">
                  {s('filters')}
                </button>
                <button onClick={() => setIsLive(false)} className="rounded-full bg-[#ff3b30] px-6 py-2.5 text-sm font-bold text-white">
                  إنهاء المعاينة
                </button>
              </div>
              {showPanel && <StudioPanel state={studio} onChange={setStudio} captureFrame={camera.captureAnalysisFrame} tabs={['face', 'beauty', 'filters']} />}
            </div>
          ) : (
            <>
              {showPanel && !camera.recording &&
                <div className="max-h-[29dvh] overflow-y-auto rounded-t-3xl border-t border-white/10 bg-[#0b1022]/85 backdrop-blur-xl">
                  <div className="sticky top-0 z-10 flex justify-between bg-[#0b1022]/95 px-4 py-2 text-xs font-bold text-[#b9c9ff]">
                    <span>أدوات الاستوديو</span>
                    <button onClick={()=>{setShowPanel(false);setShowFaceTray(true)}}
                      className="rounded-full border border-white/15 px-3 py-1 text-white">إغلاق ×</button>
                  </div>
                  <StudioPanel state={studio} onChange={setStudio} captureFrame={camera.captureAnalysisFrame}/>
                </div>}

              <div className="flex flex-col gap-4 bg-black/60 px-6 pb-5 pt-4 backdrop-blur-xl">
                {mode === 'live' && (
                  <input
                    value={liveTitle}
                    onChange={(event) => setLiveTitle(event.target.value)}
                    placeholder={s('liveTitle')}
                    maxLength={80}
                    className="rounded-full bg-white/10 px-4 py-2.5 text-sm text-white outline-none placeholder:text-white/40"
                  />
                )}
                <div className="flex items-center justify-between">
                  <span className="w-12" />
                  <button
                    onClick={handleShutter}
                    disabled={camera.status !== 'ready'}
                    className="relative flex h-20 w-20 items-center justify-center disabled:opacity-50"
                    aria-label={mode === 'live' ? 'بدء المعاينة المحلية' : modeLabel(mode)}
                  >
                    <svg className="absolute inset-0 -rotate-90" viewBox="0 0 80 80" aria-hidden="true">
                      <circle cx="40" cy="40" r="37" fill="none" stroke="currentColor" strokeWidth="4" className="text-white/90" />
                      {camera.recording && (
                        <circle cx="40" cy="40" r="37" fill="none" stroke="#ff3b30" strokeWidth="4" strokeDasharray={232.5} strokeDashoffset={232.5 * (1 - progress)} />
                      )}
                    </svg>
                    {mode === 'live' ? (
                      <span className="flex h-16 w-16 items-center justify-center rounded-full bg-[#ff3b30] text-white">
                        <Radio className="h-7 w-7" />
                      </span>
                    ) : (
                      <span
                        className={cn(
                          'transition-all',
                          mode === 'photo' ? 'h-16 w-16 rounded-full bg-white' : camera.recording ? 'h-7 w-7 rounded-md bg-[#ff3b30]' : 'h-16 w-16 rounded-full bg-[#ff3b30]',
                        )}
                      />
                    )}
                  </button>
                  <span className="w-12 text-center text-[10px] text-white/50">
                    {camera.resolution ? `${Math.max(camera.resolution.width, camera.resolution.height)}p` : ''}
                  </span>
                </div>
                <div className="flex justify-center gap-5 overflow-x-auto scrollbar-hide" role="tablist">
                  {modes.map((value) => (
                    <button
                      key={value}
                      role="tab"
                      aria-selected={mode === value}
                      disabled={camera.recording}
                      onClick={() => setMode(value)}
                      className={cn('shrink-0 text-sm font-semibold transition-colors', mode === value ? 'text-white' : 'text-white/45')}
                    >
                      {modeLabel(value)}
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {captured && (
          <div className="absolute inset-0 z-10 bg-black">
            {captured.kind === 'photo' ? (
              <img src={captured.url || "/placeholder.svg"} alt="" className="absolute inset-0 h-full w-full object-cover" />
            ) : (
              <video src={captured.url} autoPlay loop playsInline controls={false} className="absolute inset-0 h-full w-full object-cover" />
            )}
            {captured.kind==='photo'&&!storyEditing&&
              <button type="button" onClick={()=>setStoryEditing(true)}
                className="absolute right-4 top-[max(4rem,env(safe-area-inset-top))] z-10 rounded-full border border-[#b7c8ff]/35 bg-[#2d4b9b]/85 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-xl">
                ✨ تحويل إلى قصة
              </button>}
            <div className="absolute inset-x-0 top-0 p-4 pt-[max(1rem,env(safe-area-inset-top))]">
              <button onClick={() => { if (uploading) uploadAbortRef.current?.abort(); setCaptured(null) }} className="flex h-10 w-10 items-center justify-center rounded-full bg-black/40 text-white" aria-label={s('retake')}>
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="absolute inset-x-0 bottom-0 flex flex-col gap-3 p-6 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
              {uploadMessage && (
                <p role="status" aria-live="polite" dir="rtl" className="rounded-xl bg-black/80 px-3 py-2 text-center text-sm text-white">{uploadMessage}</p>
              )}
              {uploading && (
                <div className="flex flex-col gap-1" role="status" aria-label="رفع الفيديو" dir="rtl">
                  <span className="text-xs text-white">جارٍ الرفع: {uploadProgress}%</span>
                  <div className="h-2 w-full rounded-full bg-white/20"><div className="h-full rounded-full bg-[#3155ff]" style={{ width: `${uploadProgress}%` }} /></div>
                </div>
              )}
              <div className="flex items-center justify-between gap-4">
              <a
                href={captured.url}
                download={`spaktok-${Date.now()}.${captured.kind === 'photo' ? 'jpg' : captured.blob.type.includes('mp4') ? 'mp4' : 'webm'}`}
                className="flex items-center gap-2 rounded-full bg-white/15 px-5 py-3 text-sm font-semibold text-white backdrop-blur"
              >
                <Download className="h-5 w-5" />
                {s('save')}
              </a>
              <button
                type="button"
                onClick={() => {
                  if (uploadCompleted) onClose()
                  else if (captured.kind === 'video') void submitCapturedVideo()
                  else setUploadMessage('نشر الصور غير متاح حاليًا. يمكنك حفظ الصورة.')
                }}
                disabled={uploadChecking || uploading}
                className="flex items-center gap-2 rounded-full bg-[#3155ff] px-5 py-3 text-sm font-bold text-white disabled:opacity-50"
              >
                <Send className="h-5 w-5" />
                {uploadCompleted ? 'إغلاق' : uploading ? `${uploadProgress}%` : uploadChecking ? 'تحقق...' : captured.kind === 'photo' ? 'نشر الصورة' : uploadEnabled ? 'رفع للمراجعة' : 'النشر قيد الإعداد'}
              </button>
              </div>
            </div>
            {captured.kind==='photo'&&storyEditing&&
              <StoryComposer imageUrl={captured.url} onBack={()=>setStoryEditing(false)}/>}
          </div>
        )}
      </div>
    </div>
  )
}
