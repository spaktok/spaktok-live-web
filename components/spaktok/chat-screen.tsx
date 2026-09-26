'use client'

import { useState, useEffect, useRef, useCallback } from 'react'
import { Search, Edit, Camera, ImageIcon, Mic, Send, ChevronRight, Phone, Video, Smile, Check, CheckCheck, Eye, Play, Pause, Loader2, MessageSquarePlus } from 'lucide-react'
import { cn } from '@/lib/utils'
import { VoiceRecorder } from '@/components/spaktok/voice-recorder'
import { CallOverlay } from '@/components/spaktok/call-overlay'
import { EmptyState, ErrorState, LoadingState } from '@/components/spaktok/feedback-state'
import { createClient } from '@/lib/supabase/client'
import { useAuth } from '@/hooks/use-auth'
import {
  listConversations,
  getOrCreateConversation,
  fetchMessages,
  sendTextMessage,
  sendVoiceMessage,
  sendViewOnceMessage,
  markViewOnceOpened,
  markConversationRead,
  getMediaUrl,
  searchUsers,
  decodeWaveform,
  type ConversationSummary,
  type DBMessage,
  type UserSearchResult,
} from '@/lib/messaging'

interface ChatScreenProps {
  onUserClick: (userId: string) => void
}

interface OtherParticipant {
  id: string
  displayName: string
  username: string
  avatarUrl: string | null
  isVerified: boolean
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString('ar', { hour: '2-digit', minute: '2-digit' })
}

function fmtRelative(iso: string | null): string {
  if (!iso) return ''
  const diff = Date.now() - new Date(iso).getTime()
  const min = Math.floor(diff / 60000)
  if (min < 1) return 'الآن'
  if (min < 60) return `${min} د`
  const hr = Math.floor(min / 60)
  if (hr < 24) return `${hr} س`
  const day = Math.floor(hr / 24)
  if (day < 7) return `${day} ي`
  return new Date(iso).toLocaleDateString('ar')
}

function previewText(kind: ConversationSummary['lastMessageKind'], content: string | null): string {
  switch (kind) {
    case 'voice':
      return 'رسالة صوتية'
    case 'view-once':
      return 'صورة تُشاهد مرة واحدة'
    case 'text':
      return content ?? ''
    case 'system':
      return content ?? ''
    default:
      return 'ابدأ المحادثة'
  }
}

export function ChatScreen({ onUserClick }: ChatScreenProps) {
  const { session } = useAuth()
  const currentUserId = session?.user?.id ?? null

  const [conversations, setConversations] = useState<ConversationSummary[]>([])
  const [loading, setLoading] = useState(true)
  const [searchQuery, setSearchQuery] = useState('')
  const [userResults, setUserResults] = useState<UserSearchResult[]>([])
  const [searching, setSearching] = useState(false)
  const [inboxError, setInboxError] = useState<string | null>(null)
  const searchInputRef = useRef<HTMLInputElement | null>(null)
  const [selected, setSelected] = useState<{ conversationId: string; other: OtherParticipant } | null>(null)
  const [opening, setOpening] = useState(false)

  const refreshConversations = useCallback(async () => {
    try {
      const data = await listConversations()
      setConversations(data)
      setInboxError(null)
    } catch {
      setInboxError('تعذر تحميل الرسائل. تحقق من الاتصال وحاول مرة أخرى.')
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (!currentUserId) return
    refreshConversations()

    const supabase = createClient()
    const channel = supabase
      .channel('inbox')
      .on('postgres_changes', { event: 'INSERT', schema: 'public', table: 'messages' }, () => {
        refreshConversations()
      })
      .subscribe()

    return () => {
      supabase.removeChannel(channel)
    }
  }, [currentUserId, refreshConversations])

  // Debounced user search when the query is non-empty.
  useEffect(() => {
    const q = searchQuery.trim()
    if (!q) {
      setUserResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    const t = setTimeout(async () => {
      try {
        setUserResults(await searchUsers(q))
      } catch {
        setUserResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
    return () => clearTimeout(t)
  }, [searchQuery])

  const openConversationWith = async (u: UserSearchResult) => {
    setOpening(true)
    try {
      const conversationId = await getOrCreateConversation(u.id)
      setSelected({
        conversationId,
        other: { id: u.id, displayName: u.displayName, username: u.username, avatarUrl: u.avatarUrl, isVerified: u.isVerified },
      })
      setSearchQuery('')
    } catch {
      setInboxError('تعذر فتح المحادثة. تحقق من الاتصال وحاول مرة أخرى.')
    } finally {
      setOpening(false)
    }
  }

  if (selected && currentUserId) {
    return (
      <ChatConversation
        conversationId={selected.conversationId}
        other={selected.other}
        currentUserId={currentUserId}
        onBack={() => {
          setSelected(null)
          refreshConversations()
        }}
        onUserClick={onUserClick}
      />
    )
  }

  const showingSearch = searchQuery.trim().length > 0

  return (
    <div className="min-h-screen pt-4 pb-24">
      {/* Header */}
      <div className="px-4 mb-4">
        <div className="flex items-center justify-between mb-4">
          <h1 className="text-2xl font-bold text-white">الرسائل</h1>
          <button onClick={() => searchInputRef.current?.focus()} className="w-10 h-10 rounded-full glass flex items-center justify-center press-effect" aria-label="محادثة جديدة">
            <Edit className="w-5 h-5 text-[#ffffff]" />
          </button>
        </div>

        {/* Search */}
        <div className="glass rounded-xl flex items-center px-4 py-3">
          <Search className="w-5 h-5 text-white/40" />
          <input
            ref={searchInputRef}
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="ابحث عن مستخدم لبدء محادثة..."
            className="flex-1 bg-transparent text-white text-sm placeholder:text-white/40 outline-none mr-3"
          />
          {searching && <Loader2 className="w-4 h-4 text-white/40 animate-spin" />}
        </div>
      </div>

      {inboxError ? (
        <ErrorState title="تعذر تحميل المحادثات" description={inboxError} actionLabel="إعادة المحاولة" onAction={refreshConversations} />
      ) : showingSearch ? (
        /* User search results */
        <div className="px-4 py-2">
          {userResults.length === 0 && !searching ? (
            <p className="text-center text-sm text-white/40 py-8">لا يوجد مستخدمون مطابقون</p>
          ) : (
            userResults.map((u) => (
              <button
                key={u.id}
                onClick={() => openConversationWith(u)}
                disabled={opening}
                className="w-full flex items-center gap-3 py-3 border-b border-white/5 press-effect disabled:opacity-50"
              >
                <img
                  src={u.avatarUrl || '/placeholder.svg'}
                  alt={u.displayName}
                  className="w-12 h-12 rounded-full object-cover"
                  crossOrigin="anonymous"
                />
                <div className="flex-1 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <span className="text-white font-semibold">{u.displayName}</span>
                    {u.isVerified && <Check className="w-4 h-4 text-[#ffffff]" />}
                  </div>
                  <p className="text-sm text-white/50">@{u.username}</p>
                </div>
                <MessageSquarePlus className="w-5 h-5 text-[#ffffff]" />
              </button>
            ))
          )}
        </div>
      ) : loading ? (
        <LoadingState title="Wird geladen…" />
      ) : conversations.length === 0 ? (
        <EmptyState
          title="لا توجد محادثات بعد"
          description="ابحث عن مستخدم بالأعلى لبدء أول محادثة لك"
          actionLabel="ابدأ محادثة"
          onAction={() => searchInputRef.current?.focus()}
        />
      ) : (
        /* Conversation list */
        <div className="px-4 py-2">
          {conversations.map((c) => {
            const mineIsLast = c.lastMessageSender === currentUserId
            return (
              <button
                key={c.conversationId}
                onClick={() =>
                  setSelected({
                    conversationId: c.conversationId,
                    other: {
                      id: c.otherId,
                      displayName: c.otherDisplayName,
                      username: c.otherUsername,
                      avatarUrl: c.otherAvatarUrl,
                      isVerified: c.otherIsVerified,
                    },
                  })
                }
                className="w-full flex items-center gap-3 py-3 border-b border-white/5 press-effect"
              >
                <img
                  src={c.otherAvatarUrl || '/placeholder.svg'}
                  alt={c.otherDisplayName}
                  className="w-14 h-14 rounded-full object-cover"
                  crossOrigin="anonymous"
                />
                <div className="flex-1 text-right min-w-0">
                  <div className="flex items-center justify-between mb-1">
                    <span className="flex items-center gap-1 text-white font-semibold truncate">
                      {c.otherDisplayName}
                      {c.otherIsVerified && <Check className="w-3.5 h-3.5 text-[#ffffff] flex-shrink-0" />}
                    </span>
                    <span className="text-xs text-white/40 flex-shrink-0">{fmtRelative(c.lastMessageAt)}</span>
                  </div>
                  <div className="flex items-center justify-between gap-2">
                    <p className={cn('text-sm truncate', c.unreadCount > 0 && !mineIsLast ? 'text-white font-medium' : 'text-white/50')}>
                      {mineIsLast ? 'أنت: ' : ''}
                      {previewText(c.lastMessageKind, c.lastMessageContent)}
                    </p>
                    {c.unreadCount > 0 && (
                      <span className="min-w-5 h-5 px-1.5 rounded-full bg-[#3155ff] text-white text-xs font-bold flex items-center justify-center flex-shrink-0">
                        {c.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}

interface ChatConversationProps {
  conversationId: string
  other: OtherParticipant
  currentUserId: string
  onBack: () => void
  onUserClick: (userId: string) => void
}

function ChatConversation({ conversationId, other, currentUserId, onBack, onUserClick }: ChatConversationProps) {
  const [messages, setMessages] = useState<DBMessage[]>([])
  const [input, setInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [sending, setSending] = useState(false)
  const [viewOnce, setViewOnce] = useState<{ id: string; url: string } | null>(null)
  const [screenshotNote, setScreenshotNote] = useState<string | null>(null)
  const [conversationError, setConversationError] = useState<string | null>(null)
  const [showEmojiPicker, setShowEmojiPicker] = useState(false)
  const [callMode, setCallMode] = useState<'voice' | 'video' | null>(null)
  const scrollRef = useRef<HTMLDivElement | null>(null)
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const scrollToBottom = useCallback(() => {
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' })
    })
  }, [])

  // Initial load + read receipt + realtime subscription for this conversation.
  useEffect(() => {
    let active = true
    ;(async () => {
      try {
        const msgs = await fetchMessages(conversationId)
        if (!active) return
        setMessages(msgs)
        setConversationError(null)
        scrollToBottom()
        await markConversationRead(conversationId)
      } catch {
        if (active) setConversationError('تعذر تحميل المحادثة. حاول مرة أخرى.')
      }
    })()

    const supabase = createClient()
    const channel = supabase
      .channel(`conversation:${conversationId}`)
      .on(
        'postgres_changes',
        { event: 'INSERT', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const msg = payload.new as DBMessage
          setMessages((prev) => (prev.some((m) => m.id === msg.id) ? prev : [...prev, msg]))
          scrollToBottom()
          if (msg.sender_id !== currentUserId) markConversationRead(conversationId).catch(() => {})
        },
      )
      .on(
        'postgres_changes',
        { event: 'UPDATE', schema: 'public', table: 'messages', filter: `conversation_id=eq.${conversationId}` },
        (payload) => {
          const msg = payload.new as DBMessage
          setMessages((prev) => prev.map((m) => (m.id === msg.id ? msg : m)))
        },
      )
      .subscribe()

    return () => {
      active = false
      supabase.removeChannel(channel)
    }
  }, [conversationId, currentUserId, scrollToBottom])

  // Screenshot heuristic while a view-once image is open (Snap protocol).
  useEffect(() => {
    if (!viewOnce) return
    const onHidden = () => {
      if (document.visibilityState === 'hidden') {
        setScreenshotNote(`تم إشعار ${other.displayName} بأنك التقطت لقطة شاشة`)
      }
    }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('blur', onHidden)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('blur', onHidden)
    }
  }, [viewOnce, other.displayName])

  const handleSendText = async () => {
    const content = input.trim()
    if (!content || sending) return
    setInput('')
    setSending(true)
    try {
      await sendTextMessage(conversationId, content)
      // Realtime INSERT will append it; no optimistic duplicate needed.
    } catch {
      setInput(content)
      setConversationError('تعذر إرسال الرسالة. تحقق من الاتصال وحاول مرة أخرى.')
    } finally {
      setSending(false)
    }
  }

  const handleSendVoice = async (durationSec: number, waveform: number[], blob: Blob | null) => {
    setIsRecording(false)
    if (!blob) return
    setSending(true)
    try {
      await sendVoiceMessage(conversationId, blob, durationSec, waveform)
    } catch {
      setConversationError('تعذر إرسال الرسالة الصوتية. حاول مرة أخرى.')
    } finally {
      setSending(false)
    }
  }

  const handleViewOnceFile = async (file: File | undefined) => {
    if (!file) return
    setSending(true)
    try {
      await sendViewOnceMessage(conversationId, file)
    } catch {
      setConversationError('تعذر إرسال الصورة. تحقق من الاتصال وحاول مرة أخرى.')
    } finally {
      setSending(false)
    }
  }

  const openViewOnce = async (msg: DBMessage) => {
    if (!msg.media_url || msg.is_opened || msg.sender_id === currentUserId) return
    const url = await getMediaUrl(msg.media_url)
    if (!url) return
    setViewOnce({ id: msg.id, url })
    setMessages((prev) => prev.map((m) => (m.id === msg.id ? { ...m, is_opened: true } : m)))
    markViewOnceOpened(msg.id).catch(() => {})
  }

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-background">
      {/* Header */}
      <div className="glass border-b border-white/10 px-4 py-3 safe-top">
        <div className="flex items-center justify-between">
          <button onClick={onBack} className="flex items-center gap-2 press-effect" aria-label="رجوع">
            <ChevronRight className="w-6 h-6 text-white" />
          </button>
          <button onClick={() => onUserClick(other.id)} className="flex items-center gap-3 press-effect">
            <div className="text-left">
              <h2 className="flex items-center gap-1 text-white font-semibold">
                {other.displayName}
                {other.isVerified && <Check className="w-4 h-4 text-[#ffffff]" />}
              </h2>
              <p className="text-xs text-white/50 text-right">@{other.username}</p>
            </div>
            <img
              src={other.avatarUrl || '/placeholder.svg'}
              alt={other.displayName}
              className="w-10 h-10 rounded-full object-cover"
              crossOrigin="anonymous"
            />
          </button>
          <div className="flex items-center gap-2">
            <button onClick={() => setCallMode('voice')} className="w-9 h-9 rounded-full glass flex items-center justify-center press-effect" aria-label="مكالمة صوتية">
              <Phone className="w-4 h-4 text-[#ffffff]" />
            </button>
            <button onClick={() => setCallMode('video')} className="w-9 h-9 rounded-full glass flex items-center justify-center press-effect" aria-label="مكالمة فيديو">
              <Video className="w-4 h-4 text-[#ffffff]" />
            </button>
          </div>
        </div>
      </div>

      {callMode && (
        <CallOverlay
          conversationId={conversationId}
          participantName={other.displayName}
          participantAvatar={other.avatarUrl}
          mode={callMode}
          onClose={() => setCallMode(null)}
        />
      )}

      {conversationError && (
        <div className="mx-4 mt-3 flex items-center justify-between gap-3 rounded-xl border border-blue-400/20 bg-blue-400/10 px-3 py-2 text-right text-xs text-white/80" role="alert">
          <span>{conversationError}</span>
          <button onClick={() => { setConversationError(null); window.location.reload() }} className="shrink-0 rounded-full bg-white/10 px-3 py-1.5 font-semibold text-white press-effect">إعادة المحاولة</button>
        </div>
      )}

      {/* Messages */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-3">
        {messages.length === 0 && (
          <p className="text-center text-xs text-white/40 py-8">لا توجد رسائل بعد — أرسل أول رسالة</p>
        )}
        {screenshotNote && (
          <div className="flex justify-center">
            <span className="rounded-full bg-[#3155ff]/15 px-3 py-1 text-[10px] text-[#6d8dff]">{screenshotNote}</span>
          </div>
        )}
        {messages.map((msg) => {
          const isMine = msg.sender_id === currentUserId
          if (msg.kind === 'system') {
            return (
              <div key={msg.id} className="flex justify-center">
                <span className="rounded-full bg-[#3155ff]/15 px-3 py-1 text-[10px] text-[#6d8dff]">{msg.content}</span>
              </div>
            )
          }
          return (
            <div key={msg.id} className={cn('flex', isMine ? 'justify-start' : 'justify-end')}>
              <div
                className={cn(
                  'max-w-[75%] rounded-2xl px-4 py-2',
                  isMine ? 'bg-gradient-to-r from-[#ffffff] to-[#ffffff] rounded-br-sm' : 'glass-card rounded-bl-sm',
                )}
              >
                {msg.kind === 'text' && <p className="text-white text-sm break-words">{msg.content}</p>}

                {msg.kind === 'voice' && (
                  <VoicePlayer path={msg.media_url} waveform={decodeWaveform(msg.content)} durationSec={msg.duration_sec ?? 0} />
                )}

                {msg.kind === 'view-once' && (
                  <button
                    onClick={() => openViewOnce(msg)}
                    disabled={msg.is_opened || isMine}
                    className="flex items-center gap-2 py-1 disabled:opacity-60"
                  >
                    <Eye className="w-4 h-4 text-white" />
                    <span className="text-white text-sm">
                      {msg.is_opened ? 'شوهدت' : isMine ? 'صورة مؤقتة' : 'اضغط للمشاهدة مرة واحدة'}
                    </span>
                  </button>
                )}

                <div className="flex items-center justify-end gap-1 mt-1">
                  <span className="text-[10px] text-white/50">{fmtTime(msg.created_at)}</span>
                  {isMine && <CheckCheck className="w-3 h-3 text-white/70" />}
                </div>
              </div>
            </div>
          )
        })}
      </div>

      {/* View-once viewer: signed URL, destroyed from view on close */}
      {viewOnce && (
        <div className="fixed inset-0 z-[60] bg-black flex flex-col items-center justify-center">
          <div className="absolute top-0 left-0 right-0 p-4 safe-top flex items-center justify-between">
            <button onClick={() => setViewOnce(null)} className="rounded-full glass px-4 py-2 text-sm text-white press-effect">
              إغلاق
            </button>
            <span className="flex items-center gap-1.5 text-xs text-white/70">
              <Eye className="w-3.5 h-3.5" /> تُشاهد مرة واحدة
            </span>
          </div>
          <img src={viewOnce.url} alt="صورة مؤقتة" className="max-h-[70vh] w-auto rounded-2xl object-contain" />
          <p className="mt-4 px-8 text-center text-xs text-white/50">ستُحذف هذه الوسائط من العرض بمجرد الإغلاق</p>
        </div>
      )}

      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          handleViewOnceFile(e.target.files?.[0])
          e.target.value = ''
        }}
      />

      {/* Input */}
      <div className="glass border-t border-white/10 px-4 py-3 safe-bottom">
        {isRecording ? (
          <VoiceRecorder onCancel={() => setIsRecording(false)} onSend={handleSendVoice} />
        ) : (
          <div className="flex items-center gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              aria-label="إرسال صورة تُشاهد مرة واحدة"
              className="w-10 h-10 rounded-full glass flex items-center justify-center press-effect disabled:opacity-50"
            >
              <Camera className="w-5 h-5 text-[#ffffff]" />
            </button>
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={sending}
              className="w-10 h-10 rounded-full glass flex items-center justify-center press-effect disabled:opacity-50"
              aria-label="إرسال صورة من المعرض"
            >
              <ImageIcon className="w-5 h-5 text-[#ffffff]" />
            </button>
            <div className="flex-1 glass rounded-full flex items-center px-4 py-2">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.nativeEvent.isComposing && e.keyCode !== 229) handleSendText()
                }}
                placeholder="اكتب رسالة..."
                className="flex-1 bg-transparent text-white text-sm placeholder:text-white/40 outline-none"
              />
              <button onClick={() => setShowEmojiPicker((value) => !value)} className="press-effect" aria-label="الرموز التعبيرية" aria-expanded={showEmojiPicker}>
                <Smile className="w-5 h-5 text-white/50" />
              </button>
              {showEmojiPicker && (
                <div className="absolute bottom-16 right-4 z-10 flex gap-2 rounded-2xl border border-white/10 bg-[#111827] p-3 shadow-xl" role="dialog" aria-label="ا��تيار رمز تعبيري">
                  {['إعجاب', 'ضحك', 'ممتاز', 'موافقة', 'رائع'].map((emoji) => (
                    <button key={emoji} onClick={() => { setInput((value) => `${value}${emoji}`); setShowEmojiPicker(false) }} className="text-xl press-effect" aria-label={`إضافة ${emoji}`}>{emoji}</button>
                  ))}
                </div>
              )}
            </div>
            {input.trim() ? (
              <button
                onClick={handleSendText}
                disabled={sending}
                className="w-10 h-10 rounded-full bg-gradient-to-r from-[#ffffff] to-[#ffffff] flex items-center justify-center press-effect neon-cyan disabled:opacity-50"
                aria-label="إرسال"
              >
                {sending ? <Loader2 className="w-5 h-5 text-white animate-spin" /> : <Send className="w-5 h-5 text-white" />}
              </button>
            ) : (
              <button
                onClick={() => setIsRecording(true)}
                aria-label="تسجيل رسالة صوتية"
                className="w-10 h-10 rounded-full glass flex items-center justify-center press-effect text-[#3155ff]"
              >
                <Mic className="w-5 h-5" />
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

function VoicePlayer({ path, waveform, durationSec }: { path: string | null; waveform: number[]; durationSec: number }) {
  const [playing, setPlaying] = useState(false)
  const [loading, setLoading] = useState(false)
  const audioRef = useRef<HTMLAudioElement | null>(null)

  useEffect(() => {
    return () => {
      audioRef.current?.pause()
      audioRef.current = null
    }
  }, [])

  const toggle = async () => {
    if (!path) return
    if (audioRef.current) {
      if (playing) {
        audioRef.current.pause()
        setPlaying(false)
      } else {
        audioRef.current.play().catch(() => {})
        setPlaying(true)
      }
      return
    }
    setLoading(true)
    const url = await getMediaUrl(path)
    setLoading(false)
    if (!url) return
    const audio = new Audio(url)
    audio.onended = () => setPlaying(false)
    audioRef.current = audio
    audio.play().catch(() => {})
    setPlaying(true)
  }

  const bars = waveform.length ? waveform : [0.4, 0.6, 0.3, 0.7, 0.5]

  return (
    <button onClick={toggle} className="flex items-center gap-2 py-1 press-effect">
      {loading ? (
        <Loader2 className="w-5 h-5 text-white animate-spin flex-shrink-0" />
      ) : playing ? (
        <Pause className="w-5 h-5 text-white flex-shrink-0" fill="currentColor" />
      ) : (
        <Play className="w-5 h-5 text-white flex-shrink-0" fill="currentColor" />
      )}
      <div className="flex items-center gap-[2px] h-6">
        {bars.map((amp, i) => (
          <span key={i} className="w-[3px] rounded-full bg-white/80" style={{ height: `${Math.max(15, amp * 100)}%` }} />
        ))}
      </div>
      <span className="text-[10px] text-white/70 tabular-nums">{durationSec}s</span>
    </button>
  )
}
