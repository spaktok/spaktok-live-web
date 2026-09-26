'use client'

import { useCallback, useEffect, useRef, useState } from 'react'
import { Mic, MicOff, PhoneOff, Video, VideoOff, Volume2 } from 'lucide-react'
import { createClient } from '@/lib/supabase/client'

interface CallOverlayProps {
  conversationId: string
  participantName: string
  participantAvatar: string | null
  mode: 'voice' | 'video'
  incoming?: boolean
  onClose: () => void
}

type Signal =
  | { type: 'offer'; sdp: RTCSessionDescriptionInit }
  | { type: 'answer'; sdp: RTCSessionDescriptionInit }
  | { type: 'ice'; candidate: RTCIceCandidateInit }
  | { type: 'hangup' }

export function CallOverlay({ conversationId, participantName, participantAvatar, mode, incoming = false, onClose }: CallOverlayProps) {
  const localVideo = useRef<HTMLVideoElement>(null)
  const remoteVideo = useRef<HTMLVideoElement>(null)
  const peer = useRef<RTCPeerConnection | null>(null)
  const channel = useRef<ReturnType<ReturnType<typeof createClient>['channel']> | null>(null)
  const pendingIce = useRef<RTCIceCandidateInit[]>([])
  const [status, setStatus] = useState(incoming ? 'مكالمة واردة' : 'جاري الاتصال...')
  const [muted, setMuted] = useState(false)
  const [cameraOff, setCameraOff] = useState(mode === 'voice')
  const [speakerOn, setSpeakerOn] = useState(true)
  const [localStream, setLocalStream] = useState<MediaStream | null>(null)

  const endCall = useCallback((notify = true) => {
    if (notify) channel.current?.send({ type: 'broadcast', event: 'signal', payload: { type: 'hangup' } satisfies Signal })
    peer.current?.close()
    localStream?.getTracks().forEach((track) => track.stop())
    channel.current && createClient().removeChannel(channel.current)
    onClose()
  }, [localStream, onClose])

  useEffect(() => {
    let active = true
    const supabase = createClient()
    const rtc = new RTCPeerConnection({
      iceServers: [{ urls: 'stun:stun.l.google.com:19302' }],
    })
    peer.current = rtc
    const room = supabase.channel(`call:${conversationId}`, { config: { broadcast: { self: false } } })
    channel.current = room

    const sendSignal = (signal: Signal) => room.send({ type: 'broadcast', event: 'signal', payload: signal })
    rtc.onicecandidate = (event) => event.candidate && sendSignal({ type: 'ice', candidate: event.candidate.toJSON() })
    rtc.ontrack = (event) => {
      if (remoteVideo.current) remoteVideo.current.srcObject = event.streams[0]
    }
    rtc.onconnectionstatechange = () => {
      if (rtc.connectionState === 'connected') setStatus('متصل الآن')
      if (['failed', 'disconnected'].includes(rtc.connectionState)) setStatus('انقطع الاتصال')
    }

    room.on('broadcast', { event: 'signal' }, async ({ payload }: { payload: Signal }) => {
      if (!active) return
      if (payload.type === 'hangup') return endCall(false)
      if (payload.type === 'offer') {
        await rtc.setRemoteDescription(payload.sdp)
        const answer = await rtc.createAnswer()
        await rtc.setLocalDescription(answer)
        sendSignal({ type: 'answer', sdp: answer })
      } else if (payload.type === 'answer') {
        await rtc.setRemoteDescription(payload.sdp)
      } else if (payload.type === 'ice') {
        if (rtc.remoteDescription) await rtc.addIceCandidate(payload.candidate)
        else pendingIce.current.push(payload.candidate)
      }
    })

    const startLocalMedia = async () => {
      try {
        const stream = await navigator.mediaDevices?.getUserMedia({ audio: true, video: mode === 'video' })
        if (!stream) throw new Error('media unavailable')
        if (!active) return stream.getTracks().forEach((track) => track.stop())
        setLocalStream(stream)
        if (localVideo.current) localVideo.current.srcObject = stream
        stream.getTracks().forEach((track) => rtc.addTrack(track, stream))
        for (const candidate of pendingIce.current.splice(0)) await rtc.addIceCandidate(candidate)
        if (!incoming && room.state === 'joined') {
          const offer = await rtc.createOffer()
          await rtc.setLocalDescription(offer)
          sendSignal({ type: 'offer', sdp: offer })
        }
      } catch {
        setStatus('السماح بالكاميرا والميكروفون مطلوب')
      }
    }

    room.subscribe((event) => {
      if (event === 'SUBSCRIBED') startLocalMedia()
    })

    return () => {
      active = false
      rtc.close()
      localStream?.getTracks().forEach((track) => track.stop())
      supabase.removeChannel(room)
    }
  // The call initializes once per conversation and mode.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [conversationId, mode, incoming])

  const toggleMute = () => {
    localStream?.getAudioTracks().forEach((track) => { track.enabled = muted })
    setMuted((value) => !value)
  }

  const toggleCamera = () => {
    localStream?.getVideoTracks().forEach((track) => { track.enabled = cameraOff })
    setCameraOff((value) => !value)
  }

  return (
    <div className="fixed inset-0 z-[80] flex flex-col overflow-hidden bg-black" dir="rtl">
      {mode === 'video' && <video ref={remoteVideo} autoPlay playsInline className="absolute inset-0 h-full w-full object-cover bg-[#111]" />}
      {mode === 'voice' && <div className="absolute inset-0 flex flex-col items-center justify-center bg-[#050505]">
        <div className="mb-8 h-28 w-28 overflow-hidden rounded-[2rem] border border-white/20 bg-white/10 shadow-2xl">
          <img src={participantAvatar || '/placeholder.svg'} alt="" className="h-full w-full object-cover" />
        </div>
        <p className="text-xl font-semibold text-white">{participantName}</p>
        <p className="mt-2 text-sm text-white/50">{status}</p>
      </div>}
      {mode === 'video' && <div className="absolute right-4 top-4 h-36 w-24 overflow-hidden rounded-2xl border border-white/20 bg-black/60 shadow-2xl safe-top">
        <video ref={localVideo} autoPlay muted playsInline className="h-full w-full object-cover" />
      </div>}
      {mode === 'voice' && <div className="absolute left-1/2 top-10 -translate-x-1/2 text-center safe-top"><p className="text-lg font-semibold text-white">{participantName}</p><p className="mt-1 text-xs text-white/50">{status}</p></div>}
      {mode === 'video' && <div className="absolute bottom-36 left-1/2 -translate-x-1/2 rounded-full bg-black/50 px-4 py-2 text-xs text-white/80">{status}</div>}
      <div className="absolute bottom-0 left-0 right-0 flex items-center justify-center gap-4 bg-gradient-to-t from-black/90 to-transparent px-6 pb-10 pt-24 safe-bottom">
        <button onClick={toggleMute} aria-label={muted ? 'تشغيل الميكروفون' : 'كتم الميكروفون'} className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white press-effect">{muted ? <MicOff /> : <Mic />}</button>
        {mode === 'video' && <button onClick={toggleCamera} aria-label={cameraOff ? 'تشغيل الكاميرا' : 'إيقاف الكاميرا'} className="flex h-14 w-14 items-center justify-center rounded-full border border-white/20 bg-white/10 text-white press-effect">{cameraOff ? <VideoOff /> : <Video />}</button>}
        <button onClick={() => endCall()} aria-label="إنهاء المكالمة" className="flex h-16 w-16 items-center justify-center rounded-full bg-[#3155ff] text-white shadow-[0_8px_28px_rgba(255,59,48,.35)] press-effect"><PhoneOff /></button>
        <button onClick={() => setSpeakerOn((value) => !value)} aria-label={speakerOn ? 'إيقاف مكبر الصوت' : 'تشغيل مكبر الصوت'} aria-pressed={speakerOn} className={`flex h-14 w-14 items-center justify-center rounded-full border text-white press-effect ${speakerOn ? 'border-white/20 bg-white/10' : 'border-[#73e4ff]/60 bg-[#73e4ff]/20'}`}><Volume2 /></button>
      </div>
    </div>
  )
}

