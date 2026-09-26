'use client'

import { useState, useEffect, useRef } from 'react'
import { X, Zap, RotateCcw, Settings, Sparkles, Music2, Clock, Type, Sticker, Wand2, Camera, Layers, Check, Download, Send } from 'lucide-react'
import { cameraFilters, getFilterById, captureFilteredFrame, type CameraFilterCategory } from '@/lib/camera-filters'
import { cn } from '@/lib/utils'

interface CameraScreenProps {
  onClose: () => void
}

type RecordingMode = 'photo' | '15s' | '60s' | 'story'

export function CameraScreen({ onClose }: CameraScreenProps) {
  const [isFlashOn, setIsFlashOn] = useState(false)
  const [isFrontCamera, setIsFrontCamera] = useState(true)
  const [selectedFilter, setSelectedFilter] = useState<string>('none')
  const [recordingMode, setRecordingMode] = useState<RecordingMode>('photo')
  const [isRecording, setIsRecording] = useState(false)
  const [showFilters, setShowFilters] = useState(true)
  const [recordingProgress, setRecordingProgress] = useState(0)
  const [cameraReady, setCameraReady] = useState(false)
  const [cameraError, setCameraError] = useState<string | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [activeTool, setActiveTool] = useState<string | null>(null)
  const [filterCategory, setFilterCategory] = useState<CameraFilterCategory>('all')

  const selectTool = (tool: string) => {
    setActiveTool((current) => (current === tool ? null : tool))
  }

  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const recordingTimerRef = useRef<ReturnType<typeof setInterval> | null>(null)

  const activeFilter = getFilterById(selectedFilter)

  useEffect(() => {
    let cancelled = false
    const startCamera = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setCameraError('المتصفح لا يدعم الكاميرا')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: 'user', width: { ideal: 1080 }, height: { ideal: 1920 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((track) => track.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) videoRef.current.srcObject = stream
        setCameraReady(true)
      } catch {
        setCameraError('اسمح بالوصول إلى الكاميرا لبدء التصوير')
      }
    }
    startCamera()
    return () => {
      cancelled = true
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      streamRef.current?.getTracks().forEach((track) => track.stop())
    }
  }, [])

  const toggleCamera = async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    try {
      await track.applyConstraints({ facingMode: isFrontCamera ? 'environment' : 'user' })
      setIsFrontCamera((value) => !value)
    } catch {
      setCameraError('تعذر تبديل الكاميرا')
    }
  }

  const modes: { id: RecordingMode; label: string }[] = [
    { id: 'photo', label: 'صورة' },
    { id: '15s', label: '15 ثانية' },
    { id: '60s', label: '60 ثانية' },
    { id: 'story', label: 'ستوري' },
  ]

  const capturePhoto = () => {
    if (!videoRef.current || !cameraReady) return
    // Burn the selected GPU filter into the frame, fully client-side.
    const dataUrl = captureFilteredFrame(videoRef.current, activeFilter, isFrontCamera)
    if (dataUrl) setCapturedImage(dataUrl)
  }

  const handleRecord = () => {
    if (recordingMode === 'photo') {
      capturePhoto()
      return
    }
    setIsRecording((prev) => !prev)
    if (!isRecording) {
      const duration = recordingMode === '15s' ? 15 : recordingMode === '60s' ? 60 : 30
      let progress = 0
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = setInterval(() => {
        progress += 100 / (duration * 10)
        setRecordingProgress(Math.min(progress, 100))
        if (progress >= 100) {
          if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
          recordingTimerRef.current = null
          setIsRecording(false)
          setRecordingProgress(0)
          capturePhoto()
        }
      }, 100)
    } else {
      if (recordingTimerRef.current) clearInterval(recordingTimerRef.current)
      recordingTimerRef.current = null
      setRecordingProgress(0)
    }
  }

  // Captured-media review state: preview the flattened result and confirm.
  if (capturedImage) {
    return (
      <div className="fixed inset-0 z-50 bg-black">
        <img src={capturedImage || "/placeholder.svg"} alt="المعاينة الملتقطة" className="absolute inset-0 h-full w-full object-cover" />
        <div className="absolute inset-x-0 bottom-0 h-40 bg-gradient-to-t from-black/80 to-transparent" />
        <div className="absolute top-0 left-0 right-0 p-4 safe-top">
          <button onClick={() => setCapturedImage(null)} className="w-10 h-10 rounded-full glass flex items-center justify-center press-effect">
            <X className="w-5 h-5 text-white" />
          </button>
        </div>
        <div className="absolute bottom-0 left-0 right-0 p-6 safe-bottom flex items-center justify-between gap-4">
          <a
            href={capturedImage}
            download={`nexa-${Date.now()}.jpg`}
            className="flex items-center gap-2 rounded-full glass px-5 py-3 text-sm font-semibold text-white press-effect"
          >
            <Download className="w-5 h-5" />
            حفظ
          </a>
          <button
            onClick={onClose}
            className="flex items-center gap-2 rounded-full bg-gradient-to-r from-[#ffffff] to-[#ffffff] px-6 py-3 text-sm font-bold text-white neon-cyan press-effect"
          >
            <Send className="w-5 h-5" />
            نشر
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Live camera preview with GPU-accelerated filter */}
      <div className="absolute inset-0 bg-gradient-to-b from-[#1a1a2e] to-[#0a0a14]">
        <video
          ref={videoRef}
          autoPlay
          muted
          playsInline
          className={cn('absolute inset-0 h-full w-full object-cover', isFrontCamera && 'scale-x-[-1]', !cameraReady && 'opacity-0')}
          style={{ filter: activeFilter.css || undefined }}
        />
        {activeFilter.id === 'neon-frame' && (
          <div className="pointer-events-none absolute inset-5 rounded-[2rem] border-2 border-[#f7f5ff] shadow-[0_0_12px_#fff,0_0_32px_#b026ff,0_0_70px_#3155ff]" aria-hidden="true" />
        )}
        {activeFilter.overlay && (
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundColor: activeFilter.overlay.color,
              mixBlendMode: activeFilter.overlay.blend as React.CSSProperties['mixBlendMode'],
              opacity: activeFilter.overlay.alpha,
            }}
          />
        )}
        {!cameraReady && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="flex flex-col items-center gap-3 text-center">
              <Camera className="h-16 w-16 text-white/20" />
              <p className="max-w-[220px] text-sm text-white/60">{cameraError || 'جارٍ تشغيل الكاميرا...'}</p>
            </div>
          </div>
        )}
      </div>

      {/* Top Controls */}
      <div className="absolute top-0 left-0 right-0 p-4 safe-top">
        <div className="flex items-center justify-between">
          <button onClick={onClose} className="w-10 h-10 rounded-full glass flex items-center justify-center press-effect">
            <X className="w-5 h-5 text-white" />
          </button>
          <div className="flex items-center gap-3">
            <button
              onClick={() => setIsFlashOn(!isFlashOn)}
              className={cn('w-10 h-10 rounded-full flex items-center justify-center press-effect', isFlashOn ? 'bg-[#FFB800] neon-cyan' : 'glass')}
            >
              <Zap className={cn('w-5 h-5', isFlashOn ? 'text-black' : 'text-white')} fill={isFlashOn ? 'currentColor' : 'none'} />
            </button>
            <button onClick={() => selectTool('المؤقت')} aria-label="المؤقت" className={cn('w-10 h-10 rounded-full flex items-center justify-center press-effect', activeTool === 'المؤقت' ? 'bg-white text-black' : 'glass')}>
              <Clock className="w-5 h-5" />
            </button>
            <button onClick={() => selectTool('إعدادات الكاميرا')} aria-label="إعدادات الكاميرا" className={cn('w-10 h-10 rounded-full flex items-center justify-center press-effect', activeTool === 'إعدادات الكاميرا' ? 'bg-white text-black' : 'glass')}>
              <Settings className="w-5 h-5" />
            </button>
          </div>
        </div>
      </div>

      {/* Right Side Tools */}
      <div className="absolute right-4 top-1/2 -translate-y-1/2 flex flex-col gap-4">
        <button onClick={toggleCamera} className="w-12 h-12 rounded-full glass flex items-center justify-center press-effect">
          <RotateCcw className="w-6 h-6 text-white" />
        </button>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={cn('w-12 h-12 rounded-full flex items-center justify-center press-effect', showFilters ? 'bg-gradient-to-r from-[#ffffff] to-[#ffffff] neon-cyan' : 'glass')}
        >
          <Sparkles className="w-6 h-6 text-white" />
        </button>
        {[
          ['الموسيقى', Music2],
          ['النص', Type],
          ['الملصقات', Sticker],
          ['التحسين', Wand2],
        ].map(([label, ToolIcon]) => {
          const Icon = ToolIcon as typeof Music2
          return (
            <button key={label as string} onClick={() => selectTool(label as string)} aria-label={label as string} className={cn('w-12 h-12 rounded-full flex items-center justify-center press-effect', activeTool === label ? 'bg-white text-black' : 'glass')}>
              <Icon className="w-6 h-6" />
            </button>
          )
        })}
      </div>

      {activeTool && (
        <div className="absolute right-20 top-1/2 -translate-y-1/2 rounded-xl bg-black/80 px-3 py-2 text-xs text-white" role="status">
          {activeTool} مفعّل
        </div>
      )}

      {/* GPU Filter Carousel */}
      {showFilters && (
        <div className="absolute bottom-44 left-0 right-0 animate-slide-up">
          <div className="px-4 mb-3 flex items-center justify-between gap-3">
            <h3 className="text-white text-sm font-semibold">فلاتر الكاميرا الذكية</h3>
            <span className="text-[10px] text-white/50">{cameraFilters.filter((filter) => filterCategory === 'all' || filter.category === filterCategory).length} فلتر</span>
          </div>
          <div className="mb-3 flex gap-2 overflow-x-auto px-4 scrollbar-hide">
            {([
              ['all', 'الكل'],
              ['face', 'وجوه'],
              ['neon', 'نيون'],
              ['mood', 'مزاج'],
              ['classic', 'كلاسيك'],
            ] as const).map(([category, label]) => (
              <button key={category} onClick={() => setFilterCategory(category)} className={cn('rounded-full px-3 py-1.5 text-[11px] font-semibold press-effect', filterCategory === category ? 'bg-[#3155ff] text-white' : 'bg-white/10 text-white/60')} aria-pressed={filterCategory === category}>{label}</button>
            ))}
          </div>
          <div className="flex gap-3 px-4 overflow-x-auto pb-4 scrollbar-hide">
            {cameraFilters.filter((filter) => filterCategory === 'all' || filter.category === filterCategory).map((filter) => (
              <button
                key={filter.id}
                onClick={() => setSelectedFilter(filter.id)}
                className="flex flex-col items-center gap-2 flex-shrink-0 press-effect"
                aria-pressed={selectedFilter === filter.id}
              >
                <div
                  className={cn(
                    'relative w-16 h-16 rounded-xl overflow-hidden border-2',
                    selectedFilter === filter.id ? 'border-[#ffffff] neon-cyan' : 'border-white/20',
                  )}
                >
                  <div
                    className="w-full h-full bg-gradient-to-br from-[#ffffff] via-[#ffffff] to-[#3155ff]"
                    style={{ filter: filter.css || undefined }}
                  />
                  {filter.overlay && (
                    <div
                      className="absolute inset-0"
                      style={{
                        backgroundColor: filter.overlay.color,
                        mixBlendMode: filter.overlay.blend as React.CSSProperties['mixBlendMode'],
                        opacity: filter.overlay.alpha,
                      }}
                    />
                  )}
                  {selectedFilter === filter.id && (
                    <div className="absolute inset-0 bg-[#ffffff]/20 flex items-center justify-center">
                      <Check className="w-6 h-6 text-[#ffffff]" />
                    </div>
                  )}
                </div>
                <span className="text-[10px] text-white/70">{filter.nameAr}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Bottom Controls */}
      <div className="absolute bottom-0 left-0 right-0 p-6 safe-bottom">
        <div className="flex justify-center gap-6 mb-6">
          {modes.map((mode) => (
            <button
              key={mode.id}
              onClick={() => setRecordingMode(mode.id)}
              className={cn('text-sm transition-all press-effect', recordingMode === mode.id ? 'text-white font-bold text-glow-cyan' : 'text-white/50')}
            >
              {mode.label}
            </button>
          ))}
        </div>

        <div className="flex items-center justify-center gap-8">
          <button className="w-12 h-12 rounded-xl glass overflow-hidden press-effect" aria-label="المعرض">
            <div className="w-full h-full bg-gradient-to-br from-[#1428d4] to-[#3155ff]" />
          </button>

          <button onClick={handleRecord} className="relative press-effect" aria-label={recordingMode === 'photo' ? 'التقاط صورة' : 'تسجيل'}>
            {isRecording && (
              <svg className="absolute inset-0 w-24 h-24 -rotate-90">
                <circle cx="48" cy="48" r="44" stroke="rgba(255,255,255,0.2)" strokeWidth="4" fill="none" />
                <circle
                  cx="48"
                  cy="48"
                  r="44"
                  stroke="#3155ff"
                  strokeWidth="4"
                  fill="none"
                  strokeDasharray={`${2 * Math.PI * 44}`}
                  strokeDashoffset={`${2 * Math.PI * 44 * (1 - recordingProgress / 100)}`}
                  className="transition-all duration-100"
                />
              </svg>
            )}
            <div className={cn('w-24 h-24 rounded-full border-4 flex items-center justify-center transition-all', isRecording ? 'border-[#3155ff]' : 'border-white')}>
              <div
                className={cn(
                  'transition-all',
                  recordingMode === 'photo' ? 'w-16 h-16 rounded-full bg-white' : isRecording ? 'w-8 h-8 rounded-lg bg-[#3155ff]' : 'w-16 h-16 rounded-full bg-[#3155ff]',
                )}
              />
            </div>
          </button>

          <button className="w-12 h-12 rounded-xl glass flex items-center justify-center press-effect" aria-label="التأثيرات">
            <Layers className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
