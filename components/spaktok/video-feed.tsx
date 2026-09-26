'use client'

import { useState, useRef, useEffect, useCallback } from 'react'
import { VideoCard } from './video-card'
import { mockVideos } from '@/lib/mock-data'

interface VideoFeedProps {
  onUserClick: (userId: string) => void
}

export function VideoFeed({ onUserClick }: VideoFeedProps) {
  const [activeIndex, setActiveIndex] = useState(0)
  const [preloadNext, setPreloadNext] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)
  const [videos] = useState(mockVideos)

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

  const handleLike = (videoId: string) => console.log('[v0] liked video', videoId)
  const handleComment = (videoId: string) => console.log('[v0] opened comments', videoId)
  const handleShare = (videoId: string) => console.log('[v0] shared video', videoId)

  return (
    <div
      ref={containerRef}
      className="h-full w-full overflow-y-scroll snap-y snap-mandatory overscroll-contain scrollbar-hide"
      aria-label="موجز الريلز"
    >
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
                onLike={handleLike}
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
