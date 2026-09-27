'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { VideoCard } from './video-card'
import { mockVideos } from '@/lib/mock-data'
import type { Video } from '@/lib/types'

interface VideoFeedProps {
  onUserClick: (userId: string) => void
}

export function VideoFeed({ onUserClick }: VideoFeedProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [preloadNext, setPreloadNext] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [videos, setVideos] = useState<Video[]>(mockVideos)
  const [isDemoFeed, setIsDemoFeed] = useState(true)

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/feed?limit=12', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Feed unavailable')
        return response.json() as Promise<{ videos?: Video[] }>
      })
      .then((payload) => {
        if (Array.isArray(payload.videos)) {
          setVideos(payload.videos)
          setActiveIndex(0)
          setIsDemoFeed(false)
        }
      })
      .catch(() => {
        if (!controller.signal.aborted) setIsDemoFeed(true)
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
    if (isDemoFeed) return true
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
  const handleComment = (videoId: string) => console.log('[v0] opened comments', videoId)
  const handleShare = (videoId: string) => console.log('[v0] shared video', videoId)

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-y-scroll snap-y snap-mandatory overscroll-contain scrollbar-hide"
      aria-label="موجز الريلز"
    >
      {isDemoFeed && (
        <div className="pointer-events-none absolute left-3 top-3 z-20 rounded-full bg-black/45 px-2.5 py-1 text-[10px] text-white/75 backdrop-blur-sm" role="status">
          عرض تجريبي
        </div>
      )}
      {videos.length === 0 && (
        <div className="flex h-full items-center justify-center px-8 text-center text-sm text-white/70" dir="rtl">
          لا توجد ريلز منشورة بعد. كن أول من يشارك فيديو.
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
