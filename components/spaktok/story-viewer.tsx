'use client'

import React from "react"

import { useState, useEffect } from 'react'
import { X, Heart, Send, MoreHorizontal, ChevronLeft, ChevronRight, Volume2, VolumeX, Pause, Play } from 'lucide-react'
import { timeAgo } from '@/lib/mock-data'
import { createClient } from '@/lib/supabase/client'
import type { Story, User } from '@/lib/types'
import { cn } from '@/lib/utils'

interface StoryViewerProps {
  initialStoryId: string
  onClose: () => void
}

export function StoryViewer({ initialStoryId, onClose }: StoryViewerProps) {
  const [stories, setStories] = useState<Story[]>([])
  const [currentIndex, setCurrentIndex] = useState(0)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let active = true
    const loadStories = async () => {
      const { data } = await createClient().from('stories').select('id, user_id, media_url, media_type, duration, views_count, created_at, expires_at, profiles(id, username, display_name, avatar_url, bio, is_verified, followers_count, following_count, likes_count, created_at)').gt('expires_at', new Date().toISOString()).order('created_at', { ascending: false })
      if (!active) return
      const nextStories = (data || []).map((row) => {
        const profile = Array.isArray(row.profiles) ? row.profiles[0] : row.profiles
        const user: User = { id: row.user_id, username: profile?.username || 'user', displayName: profile?.display_name || 'مستخدم', avatar: profile?.avatar_url || '', bio: profile?.bio || '', isVerified: Boolean(profile?.is_verified), followers: profile?.followers_count || 0, following: profile?.following_count || 0, likes: profile?.likes_count || 0, createdAt: new Date(profile?.created_at || row.created_at) }
        return { id: row.id, user, mediaUrl: row.media_url, mediaType: row.media_type === 'video' ? 'video' : 'image', duration: row.duration || 5, views: row.views_count || 0, isViewed: false, reactions: [], createdAt: new Date(row.created_at), expiresAt: new Date(row.expires_at) } as Story
      })
      setStories(nextStories)
      setCurrentIndex(Math.max(0, nextStories.findIndex((item) => item.id === initialStoryId)))
      setLoading(false)
    }
    void loadStories()
    return () => { active = false }
  }, [initialStoryId])
  const [progress, setProgress] = useState(0)
  const [isPaused, setIsPaused] = useState(false)
  const [isMuted, setIsMuted] = useState(true)
  const [replyText, setReplyText] = useState('')
  const [showReactions, setShowReactions] = useState(false)
  const [uiHidden, setUiHidden] = useState(false)
  const holdTimerRef = React.useRef<ReturnType<typeof setTimeout> | null>(null)
  const holdTriggeredRef = React.useRef(false)

  const story = stories[currentIndex]
  if (loading) return <div className="fixed inset-0 z-50 flex items-center justify-center bg-black text-sm text-white/70">جارٍ تحميل القصة...</div>
  if (!story) return <div className="fixed inset-0 z-50 flex flex-col items-center justify-center gap-3 bg-black text-sm text-white/70"><span>القصة غير متاحة</span><button onClick={onClose} className="rounded-full bg-white/10 px-4 py-2 text-white">إغلاق</button></div>
  const storyIsVideo = story.mediaType === 'video' && /\.(mp4|webm|mov)(?:$|\?)/i.test(story.mediaUrl)
  const storyDuration = (story.duration || 5) * 1000
  const videoRef = React.useRef<HTMLVideoElement>(null)

  useEffect(() => {
    if (isPaused || storyIsVideo) return

    const interval = setInterval(() => {
      setProgress(prev => {
        if (prev >= 100) {
          goToNext()
          return 0
        }
        return prev + (100 / (storyDuration / 100))
      })
    }, 100)

    return () => clearInterval(interval)
  }, [currentIndex, isPaused, storyDuration, storyIsVideo])

  useEffect(() => {
    const video = videoRef.current
    if (!video || !storyIsVideo) return
    video.muted = isMuted
    if (isPaused) {
      video.pause()
    } else {
      video.play().catch(() => {})
    }
  }, [currentIndex, isMuted, isPaused, storyIsVideo])

  const goToNext = () => {
    if (currentIndex < stories.length - 1) {
      setCurrentIndex(prev => prev + 1)
      setProgress(0)
    } else {
      onClose()
    }
  }

  const goToPrev = () => {
    if (currentIndex > 0) {
      setCurrentIndex(prev => prev - 1)
      setProgress(0)
    }
  }

  // Distinguish a short tap (navigation) from a sustained press
  // (pause + hide UI for pure viewing) as described in the spec.
  const handlePressStart = () => {
    holdTriggeredRef.current = false
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
    holdTimerRef.current = setTimeout(() => {
      holdTriggeredRef.current = true
      setIsPaused(true)
      setUiHidden(true)
    }, 250)
  }

  const handlePressEnd = (e: React.MouseEvent | React.TouchEvent) => {
    if (holdTimerRef.current) {
      clearTimeout(holdTimerRef.current)
      holdTimerRef.current = null
    }
    if (holdTriggeredRef.current) {
      // Release from a long press: resume playback and restore the UI.
      holdTriggeredRef.current = false
      setIsPaused(false)
      setUiHidden(false)
      return
    }
    const rect = e.currentTarget.getBoundingClientRect()
    const clientX = 'changedTouches' in e ? e.changedTouches[0]?.clientX ?? 0 : e.clientX
    const x = clientX - rect.left
    const width = rect.width
    if (x < width * 0.3) {
      goToPrev()
    } else if (x > width * 0.7) {
      goToNext()
    } else {
      setIsPaused((prev) => !prev)
    }
  }

  useEffect(() => () => {
    if (holdTimerRef.current) clearTimeout(holdTimerRef.current)
  }, [])

  const reactions = ['❤️', '😂', '😮', '😢', '👏', '🔥']

  const sendReaction = (emoji: string) => {
    console.log('Sent reaction:', emoji)
    setShowReactions(false)
  }

  return (
    <div className="fixed inset-0 z-50 bg-black">
      {/* Story Image/Video */}
      <div 
        className="absolute inset-0 select-none"
        onMouseDown={handlePressStart}
        onMouseUp={handlePressEnd}
        onTouchStart={handlePressStart}
        onTouchEnd={handlePressEnd}
      >
        {storyIsVideo ? (
          <video
            ref={videoRef}
            src={story.mediaUrl}
            poster={story.user.avatar}
            autoPlay
            playsInline
            muted={isMuted}
            onEnded={goToNext}
            onTimeUpdate={(event) => {
              const video = event.currentTarget
              if (video.duration > 0) setProgress((video.currentTime / video.duration) * 100)
            }}
            className="h-full w-full object-cover"
          />
        ) : (
          <img
            src={story.mediaUrl || story.user.avatar || '/placeholder.svg'}
            alt={`قصة ${story.user.displayName}`}
            className="h-full w-full object-cover"
            crossOrigin="anonymous"
          />
        )}
        <div className="absolute inset-0 bg-gradient-to-b from-black/50 via-transparent to-black/70" />
      </div>

      {/* Progress Bars + Header */}
      <div className={cn('absolute top-0 left-0 right-0 p-3 safe-top z-10 transition-opacity duration-200', uiHidden && 'opacity-0 pointer-events-none')}>
        <div className="flex gap-1 mb-4">
          {stories.map((_, index) => (
            <div key={index} className="flex-1 h-0.5 bg-white/30 rounded-full overflow-hidden">
              <div 
                className={cn(
                  "h-full bg-white rounded-full transition-all",
                  index < currentIndex ? "w-full" : index === currentIndex ? "" : "w-0"
                )}
                style={{ 
                  width: index === currentIndex ? `${progress}%` : undefined 
                }}
              />
            </div>
          ))}
        </div>

        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="relative">
              <img
                src={story.user.avatar || "/placeholder.svg"}
                alt={story.user.displayName}
                className="w-10 h-10 rounded-full border-2 border-white object-cover"
                crossOrigin="anonymous"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-white font-semibold text-sm">{story.user.displayName}</span>
                {story.user.isVerified && (
                  <div className="w-4 h-4 rounded-full bg-[#ffffff] flex items-center justify-center">
                    <svg className="w-2.5 h-2.5 text-black" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" />
                    </svg>
                  </div>
                )}
              </div>
              <span className="text-white/60 text-xs">{timeAgo(story.createdAt)}</span>
            </div>
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              onClick={(e) => { e.stopPropagation(); setIsPaused(!isPaused) }}
              className="w-9 h-9 rounded-full glass flex items-center justify-center press-effect"
            >
              {isPaused ? (
                <Play className="w-4 h-4 text-white" fill="white" />
              ) : (
                <Pause className="w-4 h-4 text-white" fill="white" />
              )}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); setIsMuted(!isMuted) }}
              className="w-9 h-9 rounded-full glass flex items-center justify-center press-effect"
            >
              {isMuted ? (
                <VolumeX className="w-4 h-4 text-white" />
              ) : (
                <Volume2 className="w-4 h-4 text-white" />
              )}
            </button>
            <button 
              onClick={(e) => { e.stopPropagation(); onClose() }}
              className="w-9 h-9 rounded-full glass flex items-center justify-center press-effect"
            >
              <X className="w-5 h-5 text-white" />
            </button>
          </div>
        </div>
      </div>

      {/* Navigation Arrows */}
      {!uiHidden && currentIndex > 0 && (
        <button
          onClick={(e) => { e.stopPropagation(); goToPrev() }}
          className="absolute left-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full glass flex items-center justify-center press-effect z-10"
        >
          <ChevronRight className="w-5 h-5 text-white" />
        </button>
      )}
      {!uiHidden && currentIndex < stories.length - 1 && (
        <button
          onClick={(e) => { e.stopPropagation(); goToNext() }}
          className="absolute right-2 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full glass flex items-center justify-center press-effect z-10"
        >
          <ChevronLeft className="w-5 h-5 text-white" />
        </button>
      )}

      {/* Reactions */}
      {showReactions && (
        <div className="absolute bottom-28 left-1/2 -translate-x-1/2 glass-card rounded-full px-4 py-2 flex items-center gap-3 animate-scale-in z-20">
          {reactions.map((emoji) => (
            <button
              key={emoji}
              onClick={() => sendReaction(emoji)}
              className="text-2xl hover:scale-125 transition-transform press-effect"
            >
              {emoji}
            </button>
          ))}
        </div>
      )}

      {/* Bottom Actions */}
      <div className={cn('absolute bottom-0 left-0 right-0 p-4 safe-bottom z-10 transition-opacity duration-200', uiHidden && 'opacity-0 pointer-events-none')}>
        <div className="flex items-center gap-3">
          <div className="flex-1 glass rounded-full flex items-center px-4 py-2.5">
            <input
              type="text"
              value={replyText}
              onChange={(e) => setReplyText(e.target.value)}
              placeholder="أرسل رسالة..."
              className="flex-1 bg-transparent text-white text-sm placeholder:text-white/40 outline-none"
              onClick={(e) => e.stopPropagation()}
            />
          </div>
          <button 
            onClick={(e) => { e.stopPropagation(); setShowReactions(!showReactions) }}
            className="w-12 h-12 rounded-full glass flex items-center justify-center press-effect"
          >
            <Heart className="w-6 h-6 text-white" />
          </button>
          <button 
            onClick={(e) => e.stopPropagation()}
            className="w-12 h-12 rounded-full glass flex items-center justify-center press-effect"
          >
            <Send className="w-6 h-6 text-white" />
          </button>
        </div>
      </div>
    </div>
  )
}
