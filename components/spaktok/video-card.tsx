'use client'

import { useState, useRef, useEffect } from 'react'
import type { MouseEvent, TouchEvent } from 'react'
import { Heart, MessageCircle, Share2, Bookmark, Download, Music2, Play, Volume2, VolumeX, X, Send } from 'lucide-react'
import type { Video } from '@/lib/types'
import { formatNumber } from '@/lib/mock-data'
import { cn } from '@/lib/utils'
import { downloadVideo, shareExternally } from '@/lib/share'

interface VideoCardProps {
  video: Video
  isActive: boolean
  shouldPrecache?: boolean
  onProgress?: (ratio: number) => void
  onUserClick: (userId: string) => void
  onLike: (videoId: string, liked: boolean) => Promise<boolean> | boolean
  onComment: (videoId: string) => void
  onShare: (videoId: string) => void
}

export function VideoCard({ video, isActive, shouldPrecache = false, onProgress, onUserClick, onLike, onComment, onShare }: VideoCardProps) {
  const [isLiked, setIsLiked] = useState(video.isLiked)
  const [isBookmarked, setIsBookmarked] = useState(video.isBookmarked)
  const [isMuted, setIsMuted] = useState(true)
  const [isPlaying, setIsPlaying] = useState(false)
  const [showHearts, setShowHearts] = useState<{ id: number; x: number; y: number }[]>([])
  const [showComments, setShowComments] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [comments, setComments] = useState(['محتوى رهيب!', 'أحببت الفكرة، استمر', 'أين تم تصوير هذا؟'])
  const [progress, setProgress] = useState(0)
  const [isDownloading, setIsDownloading] = useState(false)
  const [shareStatus, setShareStatus] = useState<string | null>(null)
  const videoRef = useRef<HTMLVideoElement>(null)
  const tapTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const lastTapRef = useRef<number>(0)

  useEffect(() => {
    if (videoRef.current) {
      if (isActive) {
        videoRef.current.play().catch(() => {})
        setIsPlaying(true)
      } else {
        videoRef.current.pause()
        videoRef.current.currentTime = 0
        setIsPlaying(false)
      }
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
        preload={isActive || shouldPrecache ? 'auto' : 'metadata'}
        crossOrigin="anonymous"
        aria-label={`فيديو ${video.user.displayName}`}
      />
      
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
        <button
          onClick={() => onUserClick(video.user.id)}
          className="relative press-effect"
        >
          <img
            src={video.user.avatar || "/placeholder.svg"}
            alt={video.user.displayName}
            className="w-12 h-12 rounded-full border-2 border-white object-cover"
            crossOrigin="anonymous"
          />
          <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-[#3155ff] flex items-center justify-center border-2 border-black">
            <span className="text-white text-xs font-bold">+</span>
          </div>
        </button>

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
          onClick={() => setIsBookmarked(!isBookmarked)} 
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
              {comments.map((comment) => (
                <div key={comment} className="flex items-center gap-3 text-right">
                  <img src={video.user.avatar || '/placeholder-user.jpg'} alt="" className="size-8 rounded-full object-cover" />
                  <p className="text-sm text-white/85">{comment}</p>
                </div>
              ))}
            </div>
            <form
              className="glass-light mt-4 flex items-center gap-2 rounded-full px-4 py-2"
              onSubmit={(event) => {
                event.preventDefault()
                if (!commentText.trim()) return
                setComments((current) => [...current, commentText.trim()])
                setCommentText('')
              }}
            >
              <input value={commentText} onChange={(event) => setCommentText(event.target.value)} className="min-w-0 flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35" placeholder="أضف تعليقاً..." aria-label="أضف تعليقاً" />
              <button type="submit" className="text-[#ffffff] press-effect" aria-label="إرسال التعليق"><Send className="size-4" /></button>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
