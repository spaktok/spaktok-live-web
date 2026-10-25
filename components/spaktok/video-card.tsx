'use client'

import { useState, useRef, useEffect } from 'react'
import type { MouseEvent, TouchEvent } from 'react'
import { Heart, MessageCircle, Share2, Bookmark, Download, Music2, Play, Volume2, VolumeX, X, Send } from 'lucide-react'
import type { Video } from '@/lib/types'
import { formatNumber } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import { downloadVideo, shareExternally } from '@/lib/share'
import type { PlaybackMetric } from '@/lib/video/playback-qa'

interface VideoCardProps {
  video: Video
  isActive: boolean
  shouldPrecache?: boolean
  onProgress?: (ratio: number) => void
  onPlaybackMetric?: (metric: PlaybackMetric) => void
  onUserClick: (userId: string) => void
  onLike: (videoId: string, liked: boolean) => Promise<boolean> | boolean
  onBookmark: (videoId: string, bookmarked: boolean) => Promise<boolean> | boolean
  onFollow: (userId: string, following: boolean) => Promise<boolean> | boolean
  onComment: (videoId: string) => void
  onShare: (videoId: string) => void
}

interface VideoComment {
  id: string
  content: string
  createdAt?: string
  user: { displayName: string; avatarUrl?: string | null }
}

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

export function VideoCard({ video, isActive, shouldPrecache = false, onProgress, onPlaybackMetric, onUserClick, onLike, onBookmark, onFollow, onComment, onShare }: VideoCardProps) {
  const [isLiked, setIsLiked] = useState(video.isLiked)
  const [isBookmarked, setIsBookmarked] = useState(video.isBookmarked)
  const [isFollowing, setIsFollowing] = useState(video.user.isFollowing)
  const [isMuted, setIsMuted] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [isBuffering, setIsBuffering] = useState(false)
  const [showHearts, setShowHearts] = useState<{ id: number; x: number; y: number }[]>([])
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState<VideoComment[]>([])
  const [commentsLoading, setCommentsLoading] = useState(false)
  const [commentsError, setCommentsError] = useState<string | null>(null)
  const [commentSubmitting, setCommentSubmitting] = useState(false)
  const [progress, setProgress] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)
  const [shareStatus, setShareStatus] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const playRequestedAt = useRef<number | null>(null)
  const stalledSince = useRef<number | null>(null)
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTapRef = useRef<number>(0)

  useEffect(() => {
    if (!showComments) return
    if (!UUID.test(video.id)) {
      setComments([
        { id: 'demo-1', content: 'محتوى رهيب!', user: { displayName: video.user.displayName, avatarUrl: video.user.avatar } },
        { id: 'demo-2', content: 'أحببت الفكرة، استمر', user: { displayName: video.user.displayName, avatarUrl: video.user.avatar } },
        { id: 'demo-3', content: 'أين تم تصوير هذا؟', user: { displayName: video.user.displayName, avatarUrl: video.user.avatar } },
      ])
      return
    }

    const controller = new AbortController()
    setCommentsLoading(true)
    setCommentsError(null)
    fetch(`/api/comments?videoId=${encodeURIComponent(video.id)}`, { cache: 'no-store', signal: controller.signal })
      .then(async (response) => {
        if (!response.ok) throw new Error('comments_unavailable')
        return response.json() as Promise<{ comments?: VideoComment[] }>
      })
      .then((payload) => setComments(Array.isArray(payload.comments) ? payload.comments : []))
      .catch(() => {
        if (!controller.signal.aborted) setCommentsError('تعذر تحميل التعليقات. حاول مجددًا.')
      })
      .finally(() => {
        if (!controller.signal.aborted) setCommentsLoading(false)
      })
    return () => controller.abort()
  }, [showComments, video.id, video.user.avatar, video.user.displayName])

  useEffect(() => {
    const media = videoRef.current
    if (!media) return
    if (isActive) {
      playRequestedAt.current = performance.now()
      stalledSince.current = null
      setIsBuffering(true)
      media.play().catch(() => {
        playRequestedAt.current = null
        setIsPlaying(false)
        setIsBuffering(false)
      })
    } else {
      playRequestedAt.current = null
      stalledSince.current = null
      media.pause()
      setIsPlaying(false)
      setIsBuffering(false)
    }
  }, [isActive])

  // Warm the buffer for the upcoming reel without playing it.
  useEffect(() => {
    if (!isActive && shouldPrecache && videoRef.current) {
      videoRef.current.load()
    }
  }, [isActive, shouldPrecache])

  const handleVideoTap = () => {
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current)
    tapTimeoutRef.current = setTimeout(() => {
      const media = videoRef.current
      if (!media) return
      if (media.paused) {
        media.play().catch(() => {})
        setIsPlaying(true)
      } else {
        media.pause()
        setIsPlaying(false)
      }
    }, 220)
  }

  const setLiked = async (nextLiked: boolean) => {
    const previousLiked = isLiked
    setIsLiked(nextLiked)
    const saved = await onLike(video.id, nextLiked)
    if (!saved) setIsLiked(previousLiked)
  }

  const spawnHeart = (clientX: number, clientY: number, target: HTMLElement) => {
    if (!isLiked) {
      void setLiked(true)
    }
    const bounds = target.getBoundingClientRect()
    const heart = { id: Date.now(), x: clientX - bounds.left, y: clientY - bounds.top }
    setShowHearts(prev => [...prev, heart])
    setTimeout(() => setShowHearts(prev => prev.filter(item => item.id !== heart.id)), 1500)
  }

  const handleDoubleTap = (event: MouseEvent<HTMLVideoElement>) => {
    if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current)
    spawnHeart(event.clientX, event.clientY, event.currentTarget)
  }

  const handleTouchEnd = (event: TouchEvent<HTMLVideoElement>) => {
    const now = Date.now()
    const touch = event.changedTouches[0]
    if (now - lastTapRef.current < 280 && touch) {
      if (tapTimeoutRef.current) clearTimeout(tapTimeoutRef.current)
      spawnHeart(touch.clientX, touch.clientY, event.currentTarget)
      lastTapRef.current = 0
    } else {
      lastTapRef.current = now
    }
  }

  // QA-only timing: local to this page, no URLs, identities or remote collection.
  const handlePlaying = () => {
    setIsPlaying(true)
    setIsBuffering(false)
    if (!isActive || !onPlaybackMetric) return
    const now = performance.now()
    if (playRequestedAt.current !== null) {
      onPlaybackMetric({ kind: 'startup', durationMs: Math.max(0, now - playRequestedAt.current) })
      playRequestedAt.current = null
    } else if (stalledSince.current !== null) {
      onPlaybackMetric({ kind: 'rebuffer', durationMs: Math.max(0, now - stalledSince.current) })
      stalledSince.current = null
    }
  }

  const handleWaiting = () => {
    if (!isActive) return
    setIsBuffering(true)
    if (onPlaybackMetric && playRequestedAt.current === null && stalledSince.current === null) {
      stalledSince.current = performance.now()
    }
  }

  const handleTimeUpdate = () => {
    const current = videoRef.current
    if (current?.duration) {
      const ratio = current.currentTime / current.duration
      setProgress(ratio * 100)
      onProgress?.(ratio)
    }
  }

  const handleLike = () => {
    void setLiked(!isLiked)
  }

  const toggleBookmark = async () => {
    const previous = isBookmarked
    const next = !previous
    setIsBookmarked(next)
    if (!(await onBookmark(video.id, next))) {
      setIsBookmarked(previous)
      setShareStatus('سجّل الدخول لحفظ الفيديو')
      window.setTimeout(() => setShareStatus(null), 2200)
    }
  }

  const toggleFollow = async () => {
    const previous = Boolean(isFollowing)
    const next = !previous
    setIsFollowing(next)
    if (!(await onFollow(video.user.id, next))) {
      setIsFollowing(previous)
      setShareStatus('سجّل الدخول لمتابعة الحساب')
      window.setTimeout(() => setShareStatus(null), 2200)
    }
  }

  return (
    <div className="relative w-full h-full bg-black">
      {/* Video */}
      <video
        ref={videoRef}
        src={video.videoUrl}
        className="absolute inset-0 w-full h-full object-cover"
        loop
        muted={isMuted}
        playsInline
        onClick={handleVideoTap}
        onDoubleClick={handleDoubleTap}
        onTouchEnd={handleTouchEnd}
        onTimeUpdate={handleTimeUpdate}
        poster={video.thumbnailUrl}
        preload={isActive ? 'auto' : shouldPrecache ? 'metadata' : 'none'}
        onPlaying={handlePlaying}
        onPause={() => { setIsPlaying(false); stalledSince.current = null }}
        onWaiting={handleWaiting}
        onCanPlay={() => setIsBuffering(false)}
        crossOrigin="anonymous"
        aria-label={`فيديو ${video.user.displayName}`}
      />
      
      {isActive && isBuffering && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none" role="status" aria-label="جارٍ تجهيز الفيديو">
          <div className="size-9 animate-spin rounded-full border-2 border-white/30 border-t-white" />
        </div>
      )}

      {/* Play/Pause Indicator */}
      {!isPlaying && (
        <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
          <div className="w-20 h-20 rounded-full glass flex items-center justify-center animate-scale-in">
            <Play className="w-10 h-10 text-white ml-1" fill="white" />
          </div>
        </div>
      )}

      {/* Floating Hearts */}
      {showHearts.map((heart) => (
        <div
          key={heart.id}
          className="absolute pointer-events-none animate-heart-pop"
          style={{ left: heart.x, top: heart.y, transform: 'translate(-50%, -50%)' }}
        >
          <Heart className="size-24 text-[#3155ff] drop-shadow-[0_0_18px_rgba(255,0,110,0.9)]" fill="#3155ff" />
        </div>
      ))}

      {/* Overlay Gradient */}
      <div className="video-overlay absolute inset-0 pointer-events-none" />
      <div className="absolute inset-x-0 bottom-0 z-10 h-0.5 bg-white/15" aria-label="تقدم الفيديو">
        <div className="progress-gradient h-full transition-[width] duration-300" style={{ width: `${progress}%` }} />
      </div>

      {/* Right Actions */}
      <div className="absolute right-3 bottom-32 flex flex-col items-center gap-5">
        <button
          type="button"
          onClick={() => setIsMuted((muted) => !muted)}
          aria-label={isMuted ? 'تشغيل صوت الفيديو' : 'كتم صوت الفيديو'}
          className="flex h-12 w-12 items-center justify-center rounded-full glass press-effect"
        >
          {isMuted ? <VolumeX className="h-5 w-5 text-white" /> : <Volume2 className="h-5 w-5 text-white" />}
        </button>

        {/* User Avatar */}
        <div className="relative">
          <button onClick={() => onUserClick(video.user.id)} className="relative press-effect" aria-label={`الملف الشخصي ${video.user.displayName}`}>
            <img src={video.user.avatar || "/placeholder.svg"} alt={video.user.displayName} className="w-12 h-12 rounded-full border-2 border-white object-cover" crossOrigin="anonymous" />
          </button>
          <button type="button" onClick={() => void toggleFollow()} aria-label={isFollowing ? 'إلغاء المتابعة' : 'متابعة الحساب'} className="absolute -bottom-1.5 left-1/2 flex size-6 -translate-x-1/2 items-center justify-center rounded-full border-2 border-black bg-[#3155ff] text-xs font-bold text-white">
            {isFollowing ? '✓' : '+'}
          </button>
        </div>

        {/* Like */}
        <button onClick={handleLike} className="flex flex-col items-center gap-1 press-effect">
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-all",
            isLiked ? "neon-pink" : "glass"
          )}>
            <Heart 
              className={cn(
                "w-7 h-7 transition-all",
                isLiked ? "text-[#3155ff] scale-110" : "text-white"
              )}
              fill={isLiked ? "#3155ff" : "none"}
            />
          </div>
          <span className="text-xs text-white font-medium">
            {formatNumber(video.likes + (isLiked && !video.isLiked ? 1 : 0))}
          </span>
        </button>

        {/* Comment */}
        <button onClick={() => { onComment(video.id); setShowComments(true) }} className="flex flex-col items-center gap-1 press-effect">
          <div className="w-12 h-12 rounded-full glass flex items-center justify-center">
            <MessageCircle className="w-7 h-7 text-white" />
          </div>
          <span className="text-xs text-white font-medium">{formatNumber(video.comments)}</span>
        </button>

        {/* Share */}
        <button
          onClick={async () => {
            onShare(video.id)
            try {
              const status = await shareExternally({ title: video.caption, text: `@${video.user.username}`, url: window.location.href })
              setShareStatus(status === 'copied' ? 'تم نسخ الرابط' : status === 'shared' ? 'تمت المشاركة' : 'المشاركة غير متاحة')
            } catch {
              setShareStatus('أُلغيت المشاركة')
            }
            window.setTimeout(() => setShareStatus(null), 2200)
          }}
          className="flex flex-col items-center gap-1 press-effect"
          aria-label="مشاركة الفيديو"
        >
          <div className="w-12 h-12 rounded-full glass flex items-center justify-center">
            <Share2 className="w-7 h-7 text-white" />
          </div>
          <span className="text-xs text-white font-medium">{formatNumber(video.shares)}</span>
        </button>

        {shareStatus && <span className="fixed bottom-6 left-1/2 z-40 -translate-x-1/2 rounded-full bg-white px-4 py-2 text-xs font-semibold text-black">{shareStatus}</span>}

        {/* Bookmark */}
        <button
          onClick={() => void toggleBookmark()}
          aria-label={isBookmarked ? 'إزالة من المحفوظات' : 'حفظ الفيديو'}
          className="flex flex-col items-center gap-1 press-effect"
        >
          <div className={cn(
            "w-12 h-12 rounded-full flex items-center justify-center transition-all",
            isBookmarked ? "neon-cyan" : "glass"
          )}>
            <Bookmark 
              className={cn(
                "w-7 h-7 transition-all",
                isBookmarked ? "text-[#ffffff]" : "text-white"
              )}
              fill={isBookmarked ? "#ffffff" : "none"}
            />
          </div>
        </button>

        <button
          onClick={async () => {
            setIsDownloading(true)
            try {
              await downloadVideo(video.videoUrl, `spaktok-${video.id}.mp4`)
              setShareStatus('بدأ تنزيل الفيديو')
            } catch {
              setShareStatus('تعذر تنزيل الفيديو')
            } finally {
              setIsDownloading(false)
              window.setTimeout(() => setShareStatus(null), 2200)
            }
          }}
          disabled={isDownloading}
          className="flex flex-col items-center gap-1 press-effect disabled:opacity-50"
          aria-label="تنزيل الفيديو"
        >
          <div className="w-12 h-12 rounded-full glass flex items-center justify-center"><Download className="w-6 h-6 text-white" /></div>
        </button>

        {/* Music Disc */}
        {video.music && (
          <div className="relative w-12 h-12">
            <div className={cn(
              "absolute inset-0 rounded-full border-2 border-white/20",
              isPlaying && "animate-spin"
            )} style={{ animationDuration: '3s' }}>
              <img
                src={video.music.coverUrl || "/placeholder.svg"}
                alt={video.music.name}
                className="w-full h-full rounded-full object-cover"
                crossOrigin="anonymous"
              />
            </div>
          </div>
        )}
      </div>

      {/* Bottom Info */}
      <div className="absolute left-0 right-16 bottom-24 p-4">
        {/* Username */}
        <button
          onClick={() => onUserClick(video.user.id)}
          className="flex items-center gap-2 mb-2 press-effect"
        >
          <span className="text-base font-bold text-white">@{video.user.username}</span>
          {video.user.isVerified && (
            <div className="w-4 h-4 rounded-full bg-[#ffffff] flex items-center justify-center">
              <svg className="w-2.5 h-2.5 text-black" fill="currentColor" viewBox="0 0 20 20">
                <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
              </svg>
            </div>
          )}
        </button>

        {/* Caption */}
        <p className="text-sm text-white/90 mb-3 line-clamp-2">{video.caption}</p>

        {/* Tags */}
        <div className="flex flex-wrap gap-2 mb-3">
          {video.tags.map((tag) => (
            <span key={tag} className="text-sm text-[#ffffff]">#{tag}</span>
          ))}
        </div>

        {/* Music */}
        {video.music && (
          <div className="flex items-center gap-2 glass-light rounded-full px-3 py-1.5 w-fit">
            <Music2 className="w-3.5 h-3.5 text-white animate-pulse" />
            <span className="text-xs text-white/90 max-w-[200px] truncate">
              {video.music.name} - {video.music.artist}
            </span>
          </div>
        )}
      </div>

      {showComments && (
        <div className="absolute inset-0 z-30 flex items-end bg-black/35 backdrop-blur-[2px]" role="dialog" aria-modal="true" aria-label="التعليقات">
          <div className="glass-card w-full rounded-t-[2rem] border-b-0 p-4 pb-8 animate-slide-up">
            <div className="mb-4 flex items-center justify-between">
              <div>
                <p className="text-sm font-bold text-white">التعليقات</p>
                <p className="text-xs text-white/45">{formatNumber(video.comments)} تعليق</p>
              </div>
              <button onClick={() => setShowComments(false)} className="glass flex size-9 items-center justify-center rounded-full" aria-label="إغلاق التعليقات">
                <X className="size-4 text-white" />
              </button>
            </div>
            <div className="flex max-h-48 flex-col gap-3 overflow-y-auto">
              {commentsLoading && <p className="text-center text-xs text-white/55">جارٍ تحميل التعليقات…</p>}
              {commentsError && <p className="text-center text-xs text-red-200" role="alert">{commentsError}</p>}
              {!commentsLoading && !commentsError && comments.length === 0 && <p className="text-center text-xs text-white/50">لا توجد تعليقات بعد.</p>}
              {comments.map((comment) => (
                <div key={comment.id} className="flex items-center gap-3 text-right">
                  <img src={comment.user.avatarUrl || '/placeholder-user.jpg'} alt="" className="size-8 rounded-full object-cover" />
                  <div className="min-w-0">
                    <p className="text-[10px] text-white/45">{comment.user.displayName}</p>
                    <p className="text-sm text-white/85">{comment.content}</p>
                  </div>
                </div>
              ))}
            </div>
            <form
              className="glass-light mt-4 flex items-center gap-2 rounded-full px-4 py-2"
              onSubmit={async (event) => {
                event.preventDefault()
                const content = commentText.trim()
                if (!content || commentSubmitting) return
                if (content.length > 500) {
                  setCommentsError('الحد الأقصى للتعليق 500 حرف.')
                  return
                }
                if (!UUID.test(video.id)) {
                  setComments((current) => [...current, { id: `demo-${Date.now()}`, content, user: { displayName: 'أنت' } }])
                  setCommentText('')
                  return
                }
                setCommentSubmitting(true)
                setCommentsError(null)
                try {
                  const response = await fetch('/api/comments', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ videoId: video.id, content }),
                  })
                  if (response.status === 401) throw new Error('سجّل الدخول لإضافة تعليق.')
                  if (!response.ok) throw new Error('تعذر إرسال التعليق. حاول مجددًا.')
                  const payload = await response.json() as { comment: VideoComment }
                  setComments((current) => [...current, payload.comment])
                  setCommentText('')
                } catch (error) {
                  setCommentsError(error instanceof Error ? error.message : 'تعذر إرسال التعليق.')
                } finally {
                  setCommentSubmitting(false)
                }
              }}
            >
              <input value={commentText} maxLength={500} onChange={(event) => setCommentText(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35" placeholder="أضف تعليقاً..." aria-label="أضف تعليقاً" />
              <button type="submit" disabled={commentSubmitting || !commentText.trim()} className="text-[#ffffff] press-effect disabled:opacity-40" aria-label="إرسال التعليق"><Send className="size-4" /></button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
