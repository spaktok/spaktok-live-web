'use client'

import { useMemo, useState } from 'react'
import { Users, Heart, Play, Flame, Radio, Sparkles } from 'lucide-react'
import { mockLiveStreams, formatNumber } from '@/lib/mock-data'
import { ChevronLeft } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import { EmptyState } from '@/components/spaktok/feedback-state'

interface LiveGridProps {
  onLiveClick?: (liveId: string) => void
  onBack?: () => void
}

export function LiveGrid({ onLiveClick, onBack }: LiveGridProps) {
  const [selectedStream, setSelectedStream] = useState<string | null>(null)
  const [filter, setFilter] = useState<'recommended' | 'following' | 'new'>('recommended')

  const visibleStreams = useMemo(() => {
    if (filter === 'new') return [...mockLiveStreams].reverse()
    if (filter === 'following') return mockLiveStreams.filter((stream) => stream.user.isVerified || stream.viewers > 10000)
    return mockLiveStreams
  }, [filter])

  return (
    <div className="min-h-screen pt-4 pb-24 px-4">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
              <ChevronLeft className="w-5 h-5 text-white" />
            </Button>
          )}
          <div>
            <h1 className="text-2xl font-bold text-white">البث المباشر</h1>
            <p className="text-sm text-white/50">اكتشف البثوث الحية الآن</p>
          </div>
        </div>
        <div className="flex items-center gap-2 glass-card rounded-full px-4 py-2">
          <div className="w-2 h-2 rounded-full bg-[#3155ff] animate-live-pulse" />
          <span className="text-sm text-white font-medium">{mockLiveStreams.length} لايف</span>
        </div>
      </div>

      {/* Live discovery controls */}
      <div className="flex gap-2 overflow-x-auto scrollbar-hide mb-5">
        {([
          { id: 'recommended', label: 'مقترح لك', icon: Sparkles },
          { id: 'following', label: 'تتابعهم', icon: Heart },
          { id: 'new', label: 'بدأوا الآن', icon: Flame },
        ] as const).map((item) => {
          const Icon = item.icon
          return (
            <button
              key={item.id}
              onClick={() => setFilter(item.id)}
              className={cn(
                'flex items-center gap-2 rounded-full px-4 py-2 text-xs font-semibold whitespace-nowrap transition-all press-effect',
                filter === item.id ? 'bg-gradient-to-r from-[#3155ff] to-[#ffffff] text-white neon-pink' : 'glass-light text-white/65'
              )}
            >
              <Icon className="w-3.5 h-3.5" />
              {item.label}
            </button>
          )
        })}
      </div>

      {visibleStreams.length === 0 ? (
        <div className="flex min-h-64 items-center justify-center">
          <EmptyState
            title="لا توجد بثوث حالياً"
            description="جرّب تبويباً آخر أو عد لاحقاً لاكتشاف بثوث جديدة."
            actionLabel="عرض المقترحات"
            onAction={() => setFilter('recommended')}
          />
        </div>
      ) : (
        <>
      {/* Featured Live */}
      <button
        onClick={() => { setSelectedStream(visibleStreams[0]?.id ?? null); onLiveClick?.(visibleStreams[0]?.id) }}
        className="w-full relative rounded-2xl overflow-hidden mb-6 press-effect"
      >
        <div className="aspect-[16/10] relative">
          <img
            src={visibleStreams[0]?.thumbnailUrl || "/placeholder.svg"}
            alt={visibleStreams[0]?.title || 'بث مباشر'}
            className="w-full h-full object-cover"
            crossOrigin="anonymous"
          />
          <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-black/20 to-transparent" />
          
          {/* Live Badge */}
          <div className="absolute top-4 right-4 flex items-center gap-2">
            <div className="px-3 py-1 rounded-full bg-[#3155ff] text-white text-xs font-bold flex items-center gap-1.5 animate-live-pulse">
              <div className="w-1.5 h-1.5 rounded-full bg-white" />
              LIVE
            </div>
            <div className="glass-light rounded-full px-3 py-1 flex items-center gap-1.5">
              <Users className="w-3.5 h-3.5 text-white" />
              <span className="text-xs text-white font-medium">{formatNumber(visibleStreams[0]?.viewers ?? 0)}</span>
            </div>
          </div>

          {/* Play Button */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-16 h-16 rounded-full glass flex items-center justify-center neon-cyan">
              <Play className="w-8 h-8 text-white ml-1" fill="white" />
            </div>
          </div>

          {/* Info */}
          <div className="absolute bottom-0 left-0 right-0 p-4">
            <div className="flex items-center gap-3 mb-2">
              <img
                src={visibleStreams[0]?.user.avatar || "/placeholder.svg"}
                alt={visibleStreams[0]?.user.displayName || 'مبدع'}
                className="w-10 h-10 rounded-full border-2 border-[#3155ff] object-cover ring-2 ring-[#0b1f66]/80 ring-offset-1 ring-offset-black"
                crossOrigin="anonymous"
              />
              <div className="text-right">
                <h3 className="text-white font-bold">{visibleStreams[0]?.user.displayName}</h3>
                <p className="text-white/70 text-sm">{visibleStreams[0]?.title}</p>
              </div>
            </div>
            <div className="flex gap-2">
              {(visibleStreams[0]?.tags ?? []).map(tag => (
                <span key={tag} className="text-xs text-[#00D4FF]">#{tag}</span>
              ))}
            </div>
          </div>
        </div>
      </button>

      {/* Live Grid */}
      <div className="grid grid-cols-2 gap-3">
        {visibleStreams.slice(1).map((stream) => (
          <button
            key={stream.id}
            onClick={() => { setSelectedStream(stream.id); onLiveClick?.(stream.id) }}
            className="relative rounded-xl overflow-hidden press-effect"
          >
            <div className="aspect-[3/4] relative">
              <img
                src={stream.thumbnailUrl || "/placeholder.svg"}
                alt={stream.title}
                className="w-full h-full object-cover"
                crossOrigin="anonymous"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/80 via-transparent to-transparent" />
              
              {/* Live Badge */}
              <div className="absolute top-2 right-2 flex items-center gap-1.5">
                <div className="px-2 py-0.5 rounded-full bg-[#3155ff] text-white text-[10px] font-bold flex items-center gap-1 animate-live-pulse">
                  <div className="w-1 h-1 rounded-full bg-white" />
                  LIVE
                </div>
              </div>

              {/* Viewers */}
              <div className="absolute top-2 left-2 glass-light rounded-full px-2 py-0.5 flex items-center gap-1">
                <Users className="w-3 h-3 text-white" />
                <span className="text-[10px] text-white font-medium">{formatNumber(stream.viewers)}</span>
              </div>

              {/* Info */}
              <div className="absolute bottom-0 left-0 right-0 p-3">
                <div className="flex items-center gap-2 mb-1">
                  <img
                    src={stream.user.avatar || "/placeholder.svg"}
                    alt={stream.user.displayName}
                    className="w-7 h-7 rounded-full border-2 border-[#3155ff] object-cover ring-1 ring-[#0b1f66]/80 ring-offset-1 ring-offset-black"
                    crossOrigin="anonymous"
                  />
                  <span className="text-white text-xs font-semibold truncate">{stream.user.displayName}</span>
                </div>
                <p className="text-white/70 text-[10px] line-clamp-1">{stream.title}</p>
              </div>
            </div>
          </button>
        ))}
      </div>
        </>
      )}
    </div>
  )
}
