'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { VideoCard } from './video-card'
import type { Video } from '@/lib/types'

interface VideoFeedProps {
  onUserClick: (userId: string) => void
}

export function VideoFeed({ onUserClick }: VideoFeedProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [preloadNext, setPreloadNext] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [videos, setVideos] = useState<Video[]>([])
  const [isFeedLoading, setIsFeedLoading] = useState(true)
  const [feedError, setFeedError] = useState(false)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/feed?limit=12', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Feed unavailable')
        return response.json() as Promise<{ videos?: Video[] }>
      })
      .then((payload) => {
        if (!Array.isArray(payload.videos)) throw new Error('invalid_feed')
        setVideos(payload.videos)
        setActiveIndex(0)
        setFeedError(false)
      })
      .catch(() => {
        if (!controller.signal.aborted) setFeedError(true)
      })
      .finally(() => {
        if (!controller.signal.aborted) setIsFeedLoading(false)
      })
    return () => controller.abort()
  }, [])

  const updateActiveIndex = useCallback(() => {
    const container = containerRef.current
    if (!container) return
    const nextIndex = Math.round(container.scrollTop / Math.max(container.clientHeight, 1))
    setActiveIndex((current) => {
      const clamped = Math.max(0, Math.min(nextIndex, videos.length - 1))
      if (clamped !== current) setPreloadNext(false)
      return clamped
    })
  }, [videos.length])

  // Predictive pre-caching: once the active reel passes 40%, warm up the next one.
  const handleActiveProgress = useCallback((ratio: number) => {
    if (ratio >= 0.4) setPreloadNext(true)
  }, [])

  useEffect(() => {
    const container = containerRef.current
    if (!container) return
    let frame = 0
    const handleScroll = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(updateActiveIndex)
    }
    container.addEventListener('scroll', handleScroll, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      container.removeEventListener('scroll', handleScroll)
    }
  }, [updateActiveIndex])

  const handleLike = async (videoId: string, liked: boolean) => {
    try {
      const response = await fetch('/api/feed', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, liked }),
      })
      return response.ok
    } catch {
      return false
    }
  }
  const handleBookmark = async (videoId: string, bookmarked: boolean) => {
    try {
      const response = await fetch('/api/bookmarks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ videoId, bookmarked }),
      })
      return response.ok
    } catch {
      return false
    }
  }
  const handleFollow = async (userId: string, following: boolean) => {
    try {
      const response = await fetch('/api/follows', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ followingId: userId, following }),
      })
      return response.ok
    } catch {
      return false
    }
  }
  const handleComment = (videoId: string) => console.log('[v0] opened comments', videoId)
  const handleShare = (videoId: string) => console.log('[v0] shared video', videoId)

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-y-scroll snap-y snap-mandatory overscroll-contain scrollbar-hide"
      aria-label="موجز الريلز"
    >
      {isFeedLoading && (
        <div className="flex h-full items-center justify-center px-8 text-center text-sm text-white/70" dir="rtl" role="status">
          جارٍ تحميل الخلاصة...
        </div>
      )}
      {!isFeedLoading && videos.length === 0 && (
        <div className="flex h-full flex-col items-center justify-center gap-2 px-8 text-center text-sm text-white/70" dir="rtl" role="status">
          <span>{feedError ? 'تعذر تحميل الخلاصة حالياً.' : 'لا توجد ريلز منشورة بعد.'}</span>
          <span className="text-xs text-white/45">{feedError ? 'تحقق من الاتصال وحاول مجدداً.' : 'كن أول من يشارك فيديو.'}</span>
        </div>
      )}
      {videos.map((video, index) => {
        const isWithinWindow = Math.abs(index - activeIndex) <= 1
        const isActive = index === activeIndex
        const shouldPrecache = isActive || (index === activeIndex + 1 && preloadNext)
        return (
          <div key={video.id} className="h-full w-full snap-start snap-always" style={{ scrollSnapAlign: 'start' }}>
            {isWithinWindow ? (
              <VideoCard
                video={video}
                isActive={isActive}
                shouldPrecache={shouldPrecache}
                onProgress={isActive ? handleActiveProgress : undefined}
                onUserClick={onUserClick}
                onLike={(videoId, liked) => handleLike(videoId, liked)}
                onBookmark={(videoId, bookmarked) => handleBookmark(videoId, bookmarked)}
                onFollow={(userId, following) => handleFollow(userId, following)}
                onComment={handleComment}
                onShare={handleShare}
              />
            ) : (
              <div className="h-full w-full bg-black" aria-hidden="true" />
            )}
          </div>
        )
      })}
    </div>
  )
}
