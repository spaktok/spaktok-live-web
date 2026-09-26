'use client'

import { useState } from 'react'
import { X, Heart, Share2, Gift, MessageCircle, Users, MoreHorizontal, Sparkles, Crown, Zap } from 'lucide-react'
import type { LiveStream as LiveStreamType, Gift as GiftType } from '@/lib/types'
import { mockGifts, mockLiveStreams, formatNumber } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import { cameraFilters, getFilterById } from '@/lib/camera-filters'

interface LiveStreamProps {
  stream?: LiveStreamType
  streamId?: string
  onClose: () => void
}

interface ChatMessage {
  id: string
  username: string
  content: string
  isGift?: boolean
  giftIcon?: string
}

export function LiveStream({ stream: streamProp, streamId, onClose }: LiveStreamProps) {
  const stream = streamProp || mockLiveStreams.find(s => s.id === streamId) || mockLiveStreams[0]
  const [isLiked, setIsLiked] = useState(false)
  const [showGifts, setShowGifts] = useState(false)
  const [floatingHearts, setFloatingHearts] = useState<number[]>([])
  const [messages, setMessages] = useState<ChatMessage[]>([
    { id: '1', username: 'أحمد', content: 'مساء الخير!' },
    { id: '2', username: 'سارة', content: 'أخيراً لايف!' },
    { id: '3', username: 'محمد', content: 'واضح جداً اليوم', isGift: true, giftIcon: '🌹' },
    { id: '4', username: 'نورة', content: 'حبيت الموضوع!' },
    { id: '5', username: 'خالد', content: 'استمر!', isGift: true, giftIcon: '💎' },
  ])
  const [newMessage, setNewMessage] = useState('')
  const [selectedFilter, setSelectedFilter] = useState('none')
  const activeFilter = getFilterById(selectedFilter)

  const handleLike = () => {
    setIsLiked(true)
    const heartId = Date.now()
    setFloatingHearts(prev => [...prev, heartId])
    setTimeout(() => {
      setFloatingHearts(prev => prev.filter(id => id !== heartId))
    }, 2000)
  }

  const sendMessage = () => {
    if (newMessage.trim()) {
      setMessages(prev => [...prev, {
        id: Date.now().toString(),
        username: 'أنت',
        content: newMessage
      }])
      setNewMessage('')
    }
  }

  const sendGift = (gift: GiftType) => {
    setMessages(prev => [...prev, {
      id: Date.now().toString(),
      username: 'أنت',
      content: `أرسل ${gift.name}`,
      isGift: true,
      giftIcon: gift.icon
    }])
    setShowGifts(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Video Background */}
      <div className="absolute inset-0">
        <img
          src={stream.thumbnailUrl || "/placeholder.svg"}
          alt={stream.title}
          className="w-full h-full object-cover transition-all duration-300"
          style={{ filter: activeFilter.css || undefined }}
          crossOrigin="anonymous"
        />
        <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-black/80" />
      </div>

      {/* Floating Hearts */}
      <div className="absolute right-6 bottom-40 w-12 overflow-visible">
        {floatingHearts.map((id, index) => (
          <Heart
            key={id}
            className="absolute bottom-0 text-[#3155ff] animate-float-heart"
            style={{
              left: `${Math.random() * 20 - 10}px`,
              animationDelay: `${index * 0.1}s`
            }}
            fill="#3155ff"
            size={24 + Math.random() * 16}
          />
        ))}
      </div>

      {/* Top Bar */}
      <div className="absolute top-0 left-0 right-0 p-4 safe-top z-10">
        <div className="flex items-center justify-between">
          {/* Streamer Info */}
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={stream.user.avatar || "/placeholder.svg"}
                alt={stream.user.displayName}
                className="w-12 h-12 rounded-full border-2 border-[#3155ff] object-cover"
                crossOrigin="anonymous"
              />
              <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 px-2 py-0.5 rounded bg-[#3155ff] text-[8px] font-bold text-white animate-live-pulse">
                LIVE
              </div>
            </div>
            <div>
              <div className="flex items-center gap-1.5">
                <span className="text-white font-bold text-sm">{stream.user.displayName}</span>
                {stream.user.isVerified && (
                  <div className="w-4 h-4 rounded-full bg-[#ffffff] flex items-center justify-center">
                    <Sparkles className="w-2.5 h-2.5 text-black" />
                  </div>
                )}
              </div>
              <div className="flex items-center gap-2 text-white/70 text-xs">
                <div className="flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  <span>{formatNumber(stream.viewers)}</span>
                </div>
                <span>•</span>
                <div className="flex items-center gap-1">
                  <Heart className="w-3 h-3" fill="#3155ff" />
                  <span>{formatNumber(stream.likes)}</span>
                </div>
              </div>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2">
            <button className="glass-card px-4 py-2 rounded-full text-sm font-semibold text-white press-effect">
              متابعة
            </button>
            <button onClick={onClose} className="w-10 h-10 rounded-full glass flex items-center justify-center press-effect">
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>

        {/* Tags */}
        <div className="flex gap-2 mt-3">
          {stream.tags.map(tag => (
            <span key={tag} className="glass-light px-3 py-1 rounded-full text-xs text-white/80">
              #{tag}
            </span>
          ))}
        </div>
      </div>

      {/* Chat Messages */}
      <div className="absolute left-0 right-20 bottom-36 max-h-64 overflow-y-auto p-4 space-y-2">
        {messages.map((msg) => (
          <div 
            key={msg.id} 
            className={cn(
              "flex items-start gap-2 animate-slide-up",
              msg.isGift && "glass-card rounded-xl px-3 py-2"
            )}
          >
            {msg.isGift && (
              <span className="text-2xl">{msg.giftIcon}</span>
            )}
            <div>
              <span className={cn(
                "text-sm font-semibold",
                msg.isGift ? "text-[#ffffff]" : "text-[#ffffff]"
              )}>
                {msg.username}
              </span>
              <span className="text-sm text-white/90 mr-2">{msg.content}</span>
            </div>
          </div>
        ))}
      </div>

      {activeFilter.overlay && (
        <div className="pointer-events-none absolute inset-0" style={{ backgroundColor: activeFilter.overlay.color, mixBlendMode: activeFilter.overlay.blend as React.CSSProperties['mixBlendMode'], opacity: activeFilter.overlay.alpha }} aria-hidden="true" />
      )}

      <div className="absolute bottom-24 left-0 right-0 z-10 flex gap-2 overflow-x-auto px-4 pb-2 scrollbar-hide">
        {cameraFilters.filter((filter) => filter.id === 'none' || filter.category === 'face' || filter.category === 'neon').map((filter) => (
          <button key={filter.id} onClick={() => setSelectedFilter(filter.id)} className={cn('shrink-0 rounded-full px-3 py-1.5 text-[11px] font-semibold backdrop-blur-md press-effect', selectedFilter === filter.id ? 'bg-[#3155ff] text-white' : 'bg-black/50 text-white/75')} aria-pressed={selectedFilter === filter.id}>{filter.nameAr}</button>
        ))}
      </div>

      {/* Bottom Actions */}
      <div className="absolute bottom-0 left-0 right-0 p-4 safe-bottom">
        <div className="flex items-center gap-3">
          {/* Message Input */}
          <div className="flex-1 glass rounded-full flex items-center px-4 py-2">
            <input
              type="text"
              value={newMessage}
              onChange={(e) => setNewMessage(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && sendMessage()}
              placeholder="اكتب تعليق..."
              className="flex-1 bg-transparent text-white text-sm placeholder:text-white/40 outline-none"
            />
            <button onClick={sendMessage} className="text-[#ffffff] text-sm font-semibold mr-2">
              إرسال
            </button>
          </div>

          {/* Quick Actions */}
          <button 
            onClick={() => setShowGifts(!showGifts)}
            className="w-12 h-12 rounded-full glass flex items-center justify-center press-effect"
          >
            <Gift className="w-6 h-6 text-[#ffffff]" />
          </button>
          <button onClick={handleLike} className="w-12 h-12 rounded-full glass flex items-center justify-center press-effect">
            <Heart className={cn("w-6 h-6", isLiked ? "text-[#3155ff]" : "text-white")} fill={isLiked ? "#3155ff" : "none"} />
          </button>
          <button className="w-12 h-12 rounded-full glass flex items-center justify-center press-effect">
            <Share2 className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>

      {/* Gifts Panel */}
      {showGifts && (
        <div className="absolute bottom-28 left-0 right-0 p-4 animate-slide-up">
          <div className="glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-white font-bold">الهدايا</h3>
              <div className="flex items-center gap-2 glass-light rounded-full px-3 py-1">
                <Zap className="w-4 h-4 text-[#ffffff]" />
                <span className="text-sm text-white font-semibold">1,250</span>
              </div>
            </div>
            <div className="grid grid-cols-4 gap-3">
              {mockGifts.map((gift) => (
                <button
                  key={gift.id}
                  onClick={() => sendGift(gift)}
                  className="flex flex-col items-center gap-1 p-3 rounded-xl glass-light hover:bg-white/10 transition-colors press-effect"
                >
                  <span className="text-3xl">{gift.icon}</span>
                  <span className="text-xs text-white/70">{gift.value}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
