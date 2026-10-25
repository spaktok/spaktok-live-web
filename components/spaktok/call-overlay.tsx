'use client'
import { PhoneOff, ShieldAlert } from 'lucide-react'

interface CallOverlayProps {
  conversationId: string
  participantName: string
  participantAvatar: string | null
  mode: 'voice' | 'video'
  incoming?: boolean
  onClose: () => void
}

/**
 * The deleted Supabase Realtime project used to signal WebRTC offers.
 * Do not request camera/microphone permissions or create calls without
 * replacement signaling and TURN infrastructure.
 */
export function CallOverlay({ participantName, mode, onClose }: CallOverlayProps) {
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/95 p-6 text-white" dir="rtl">
      <section className="flex w-full max-w-md flex-col items-center gap-5 rounded-3xl border border-white/10 bg-white/5 p-8 text-center">
        <ShieldAlert className="h-12 w-12 text-[#93afff]" aria-hidden="true" />
        <h2 className="text-xl font-bold">{mode === 'video' ? 'مكالمة فيديو' : 'مكالمة صوتية'} مع {participantName}</h2>
        <p className="text-sm leading-7 text-white/70">
          المكالمات غير متاحة مؤقتًا إلى حين تشغيل خادم الإشارات والاتصال الآمن
          بدل خدمة Supabase القديمة. لا يتم تشغيل الكاميرا أو الميكروفون الآن.
        </p>
        <button type="button" onClick={onClose}
          className="flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-semibold text-black">
          <PhoneOff className="h-4 w-4" /> العودة إلى المحادثة
        </button>
      </section>
    </div>
  )
}
