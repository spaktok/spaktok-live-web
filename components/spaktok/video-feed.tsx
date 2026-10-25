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
  const [nextCursor, setNextCursor] = useState<string | null>(null)
  const [isLoadingMore, setIsLoadingMore] = useState(false)
  const [loadMoreError, setLoadMoreError] = useState(false)
  const [canPrecache, setCanPrecache] = useState(true)
  const [isVisible, setIsVisible] = useState(true)
  const loadMoreAbortRef = useRef<AbortController | null>(null)

  // Pause background playback and respect the viewer's data-saving preference.
  useEffect(() => {
    const connection = (navigator as Navigator & {
      connection?: { saveData?: boolean; effectiveType?: string; addEventListener?: (type: string, callback: () => void) => void; removeEventListener?: (type: string, callback: () => void) => void }
    }).connection
    const updatePolicy = () => {
      setCanPrecache(!connection?.saveData && !['slow-2g', '2g', '3g'].includes(connection?.effectiveType ?? ''))
    }
    const updateVisibility = () => setIsVisible(!document.hidden)
    updatePolicy()
    updateVisibility()
    connection?.addEventListener?.('change', updatePolicy)
    document.addEventListener('visibilitychange', updateVisibility)
    return () => {
      connection?.removeEventListener?.('change', updatePolicy)
      document.removeEventListener('visibilitychange', updateVisibility)
      loadMoreAbortRef.current?.abort()
    }
  }, [])

  useEffect(() => {
    const controller = new AbortController()
    fetch('/api/feed?limit=12', { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('Feed unavailable')
        return response.json() as Promise<{ videos?: Video[]; nextCursor?: string | null }>
      })
      .then((payload) => {
        if (!Array.isArray(payload.videos)) throw new Error('invalid_feed')
        setVideos(payload.videos)
        setNextCursor(payload.nextCursor ?? null)
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

  const loadMore = useCallback(async () => {
    if (!nextCursor || isLoadingMore || loadMoreError || isFeedLoading) return
    const controller = new AbortController()
    loadMoreAbortRef.current = controller
    setIsLoadingMore(true)
    try {
      const response = await fetch(`/api/feed?limit=12&cursor=${encodeURIComponent(nextCursor)}`, {
        cache: 'no-store',
        signal: controller.signal,
      })
      if (!response.ok) throw new Error('feed_page_unavailable')
      const payload = await response.json() as { videos?: Video[]; nextCursor?: string | null }
      if (!Array.isArray(payload.videos)) throw new Error('invalid_feed_page')
      if (controller.signal.aborted) return
      setVideos((current) => {
        const known = new Set(current.map((video) => video.id))
        return [...current, ...payload.videos!.filter((video) => !known.has(video.id))]
      })
      // If the upstream returns a repeated cursor, fail closed to avoid request loops.
      setNextCursor(payload.nextCursor && payload.nextCursor !== nextCursor ? payload.nextCursor : null)
      setLoadMoreError(false)
    } catch {
      if (!controller.signal.aborted) setLoadMoreError(true)
    } finally {
      if (!controller.signal.aborted) setIsLoadingMore(false)
      if (loadMoreAbortRef.current === controller) loadMoreAbortRef.current = null
    }
  }, [nextCursor, isLoadingMore, loadMoreError, isFeedLoading])

  // Load the next page before reaching the end of the current one.
  useEffect(() => {
    if (!isFeedLoading && nextCursor && activeIndex >= videos.length - 4) {
      void loadMore()
    }
  }, [activeIndex, videos.length, nextCursor, isFeedLoading, loadMore])

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
    if (ratio >= 0.4 && canPrecache) setPreloadNext(true)
  }, [canPrecache])

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
      className="relative h-full w-full overflow-y-scroll snap-y snap-mandatory overscroll-contain scrollbar-hide"
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
        const shouldPrecache = canPrecache && index === activeIndex + 1 && preloadNext
        return (
          <div key={video.id} className="h-full w-full snap-start snap-always" style={{ scrollSnapAlign: 'start' }}>
            {isWithinWindow ? (
              <VideoCard
                video={video}
                isActive={isActive && isVisible}
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
      {isLoadingMore && (
        <div className="pointer-events-none sticky bottom-24 mx-auto w-fit rounded-full bg-black/75 px-4 py-2 text-xs text-white/80" role="status" dir="rtl">
          جارٍ تحميل المزيد...
        </div>
      )}
      {loadMoreError && nextCursor && (
        <button type="button" className="sticky bottom-24 mx-auto block rounded-full bg-white px-4 py-2 text-xs font-semibold text-black"
          onClick={() => setLoadMoreError(false)} dir="rtl">
          تعذر تحميل المزيد — إعادة المحاولة
        </button>
      )}
    </div>
  )
}
