'use client'

import { useEffect, useRef, useState } from 'react'
import { Lock, Trash2, Send } from 'lucide-react'
import { cn } from '@/lib/utils'

interface VoiceRecorderProps {
  onCancel: () => void
  onSend: (durationSec: number, waveform: number[], blob: Blob | null) => void
}

// Live voice recorder: captures the mic, renders a realtime waveform from the
// Web Audio AnalyserNode, and supports swipe-to-cancel / tap-to-lock.
export function VoiceRecorder({ onCancel, onSend }: VoiceRecorderProps) {
  const [elapsed, setElapsed] = useState(0)
  const [locked, setLocked] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [bars, setBars] = useState<number[]>([])

  const streamRef = useRef<MediaStream | null>(null)
  const audioCtxRef = useRef<AudioContext | null>(null)
  const analyserRef = useRef<AnalyserNode | null>(null)
  const rafRef = useRef<number | null>(null)
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const waveformRef = useRef<number[]>([])
  const recorderRef = useRef<MediaRecorder | null>(null)
  const chunksRef = useRef<Blob[]>([])

  useEffect(() => {
    let cancelled = false
    const start = async () => {
      if (!navigator.mediaDevices?.getUserMedia) {
        setError('التسجيل الصوتي غير مدعوم')
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const AudioCtx = window.AudioContext || (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext
        const audioCtx = new AudioCtx()
        const source = audioCtx.createMediaStreamSource(stream)
        const analyser = audioCtx.createAnalyser()
        analyser.fftSize = 256
        source.connect(analyser)
        audioCtxRef.current = audioCtx
        analyserRef.current = analyser

        // Capture the actual audio so the voice note can be uploaded and played back.
        try {
          const mimeType = MediaRecorder.isTypeSupported("audio/webm")
            ? "audio/webm"
            : MediaRecorder.isTypeSupported("audio/mp4")
              ? "audio/mp4"
              : ""
          const recorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
          recorder.ondataavailable = (e) => {
            if (e.data.size > 0) chunksRef.current.push(e.data)
          }
          recorder.start()
          recorderRef.current = recorder
        } catch {
          // Waveform still renders even if MediaRecorder is unavailable.
        }

        const data = new Uint8Array(analyser.frequencyBinCount)
        const tick = () => {
          analyser.getByteFrequencyData(data)
          // Average energy → single amplitude bar (0..1).
          let sum = 0
          for (let i = 0; i < data.length; i++) sum += data[i]
          const amp = Math.min(1, sum / data.length / 128)
          waveformRef.current = [...waveformRef.current, amp].slice(-48)
          setBars(waveformRef.current)
          rafRef.current = requestAnimationFrame(tick)
        }
        tick()

        timerRef.current = setInterval(() => setElapsed((e) => e + 1), 1000)
      } catch {
        setError('اسمح بالوصول إلى الميكروفون')
      }
    }
    start()
    return () => {
      cancelled = true
      if (rafRef.current) cancelAnimationFrame(rafRef.current)
      if (timerRef.current) clearInterval(timerRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      audioCtxRef.current?.close().catch(() => {})
    }
  }, [])

  const stopAll = () => {
    if (rafRef.current) cancelAnimationFrame(rafRef.current)
    if (timerRef.current) clearInterval(timerRef.current)
    streamRef.current?.getTracks().forEach((t) => t.stop())
    audioCtxRef.current?.close().catch(() => {})
  }

  const handleSend = () => {
    const recorder = recorderRef.current
    const waveform = waveformRef.current.length ? waveformRef.current : [0.4, 0.6, 0.3]
    const duration = elapsed

    if (recorder && recorder.state !== "inactive") {
      recorder.onstop = () => {
        const blob = chunksRef.current.length
          ? new Blob(chunksRef.current, { type: recorder.mimeType || "audio/webm" })
          : null
        stopAll()
        onSend(duration, waveform, blob)
      }
      recorder.stop()
    } else {
      stopAll()
      onSend(duration, waveform, null)
    }
  }

  const handleCancel = () => {
    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.onstop = null
      try {
        recorderRef.current.stop()
      } catch {
        // already stopped
      }
    }
    stopAll()
    onCancel()
  }

  const mm = Math.floor(elapsed / 60)
  const ss = String(elapsed % 60).padStart(2, '0')

  return (
    <div className="flex items-center gap-3 w-full">
      <button onClick={handleCancel} aria-label="إلغاء التسجيل" className="w-10 h-10 rounded-full glass flex items-center justify-center press-effect text-[#3155ff]">
        <Trash2 className="w-5 h-5" />
      </button>

      <div className="flex-1 glass rounded-full flex items-center gap-3 px-4 py-2 overflow-hidden">
        <span className="flex h-2.5 w-2.5 flex-shrink-0 rounded-full bg-[#3155ff] animate-pulse" />
        <span className="text-xs font-mono text-white tabular-nums">{mm}:{ss}</span>
        <div className="flex flex-1 items-center gap-[2px] h-6 overflow-hidden" aria-hidden="true">
          {error ? (
            <span className="text-[11px] text-white/50">{error}</span>
          ) : (
            bars.map((amp, i) => (
              <span
                key={i}
                className="w-[3px] flex-shrink-0 rounded-full bg-gradient-to-t from-[#ffffff] to-[#ffffff]"
                style={{ height: `${Math.max(10, amp * 100)}%` }}
              />
            ))
          )}
        </div>
      </div>

      <button
        onClick={() => setLocked((l) => !l)}
        aria-label={locked ? 'إلغاء القفل' : 'قفل التسجيل'}
        className={cn('w-10 h-10 rounded-full flex items-center justify-center press-effect', locked ? 'bg-[#ffffff] text-black' : 'glass text-white/70')}
      >
        <Lock className="w-4 h-4" />
      </button>

      <button onClick={handleSend} aria-label="إرسال" className="w-10 h-10 rounded-full bg-gradient-to-r from-[#ffffff] to-[#ffffff] flex items-center justify-center press-effect neon-cyan">
        <Send className="w-5 h-5 text-white" />
      </button>
    </div>
  )
}
