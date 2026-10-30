'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Radio, Sparkles } from 'lucide-react'
import { BottomNavigation } from '@/components/spaktok/bottom-navigation'
import { VideoFeed } from '@/components/spaktok/video-feed'
import { StoryViewer } from '@/components/spaktok/story-viewer'
import { StoriesScreen } from '@/components/spaktok/stories-screen'
import { LiveGrid } from '@/components/spaktok/live-grid'
import { LiveStream } from '@/components/spaktok/live-stream'
import { SpaktokLiveHub } from '@/components/spaktok/spaktok-live-hub'
import { ChatScreen } from '@/components/spaktok/chat-screen'
import { CameraScreen } from '@/components/spaktok/camera-screen'
import { ProfileScreen } from '@/components/spaktok/profile-screen'
import { DiscoverScreen } from '@/components/spaktok/discover-screen'
import { NotificationsScreen } from '@/components/spaktok/notifications-screen'
import { ShopScreen } from '@/components/spaktok/shop-screen'
import { SettingsScreen } from '@/components/spaktok/settings-screen'
import { AuthScreen } from '@/components/spaktok/auth-screen'
import { SplashScreen } from '@/components/spaktok/splash-screen'
import type { TabType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { useAuth } from '@/hooks/use-auth'

export default function SpakTok() {
  const [isLoading, setIsLoading] = useState(true)
  const { session, isLoading: isAuthLoading, error: authError } = useAuth()
  const isAuthenticated = !!session
  const [activeTab, setActiveTab] = useState<TabType>('home')
  const [feedType, setFeedType] = useState<'forYou' | 'following' | 'live'>('forYou')
  const [focusedVideoId, setFocusedVideoId] = useState<string | null>(null)
  const [showCamera, setShowCamera] = useState(false)
  const [cameraInitialMode,setCameraInitialMode]=useState<'photo'|'live'>('photo')
  const [viewingStory, setViewingStory] = useState<string | null>(null)
  const [viewingProfile, setViewingProfile] = useState<string | null>(null)
  const [viewingLive, setViewingLive] = useState<string | null>(null)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showShop, setShowShop] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'cancelled' | null>(null)

  useEffect(() => {
    const params=new URLSearchParams(window.location.search)
    const user=params.get('user'),video=params.get('video'),story=params.get('story')
    const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i
    if(story&&uuid.test(story)){setViewingStory(story)}
    else if(user&&uuid.test(user)){setViewingProfile(user);setActiveTab('profile')}
    else if(video&&uuid.test(video)){setFocusedVideoId(video);setFeedType('forYou');setActiveTab('home')}
    const status = params.get('payment')
    if (status === 'success' || status === 'cancelled') {
      setPaymentStatus(status)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleTabChange = (tab: TabType) => {
    if (tab === 'create') {
      setCameraInitialMode('photo')
      setShowCamera(true)
    } else {
      setFocusedVideoId(null)
      setActiveTab(tab)
      setViewingProfile(null)
      setShowNotifications(false)
      setShowShop(false)
      setShowSettings(false)
    }
  }

  const handleVideoClick = (videoId:string) => {
    setFocusedVideoId(videoId)
    setFeedType('forYou')
    setActiveTab('home')
  }

  const handleUserClick = (userId: string) => {
    setViewingProfile(userId)
    setActiveTab('profile')
  }

  const handleStoryClick = (storyId: string) => {
    setViewingStory(storyId)
  }

  const handleAddStory = () => {
    setCameraInitialMode('photo')
    setShowCamera(true)
  }

  const handleLiveClick = (liveId: string) => {
    setViewingLive(liveId)
  }

  // Splash Screen (also shown while the auth session is resolving)
  if (isLoading || isAuthLoading) {
    return <SplashScreen onComplete={() => setIsLoading(false)} />
  }

  // Auth Screen — session updates automatically via the auth listener
  if (!isAuthenticated) {
    return <AuthScreen initialError={authError} />
  }

  // Camera Screen
  if (showCamera) {
    return <CameraScreen initialMode={cameraInitialMode} onClose={() => setShowCamera(false)} />
  }

  // Story Viewer
  if (viewingStory) {
    return (
      <StoryViewer 
        initialStoryId={viewingStory} 
        onClose={() => setViewingStory(null)} 
      />
    )
  }

  // Live Stream Viewer
  if (viewingLive) {
    return (
      <LiveStream 
        streamId={viewingLive}
        onClose={() => setViewingLive(null)} 
      />
    )
  }

  // Notifications Screen
  if (showNotifications) {
    return <NotificationsScreen onBack={() => setShowNotifications(false)} />
  }

  // Shop Screen
  if (showShop) {
    return <ShopScreen onBack={() => setShowShop(false)} />
  }

  // Settings Screen
  if (showSettings) {
    return <SettingsScreen onBack={() => setShowSettings(false)} />
  }

  return (
    <div className="min-h-dvh bg-background">
      {paymentStatus && (
        <div className={cn(
          "fixed left-1/2 top-4 z-[100] -translate-x-1/2 rounded-full px-4 py-2 text-sm font-semibold shadow-lg",
          paymentStatus === 'success' ? "bg-emerald-500 text-white" : "bg-amber-500 text-black",
        )} role="status" aria-live="polite">
          {paymentStatus === 'success' ? 'Zahlung erfolgreich abgeschlossen' : 'Zahlung abgebrochen'}
          <button className="ml-3 underline underline-offset-2" onClick={() => setPaymentStatus(null)} aria-label="Zahlungsnachricht schließen">Schließen</button>
        </div>
      )}
      {/* Main Content */}
      <main className="relative spak-content-width">
        {activeTab === 'home' && (
          <div className="relative h-dvh overflow-hidden bg-black">
            {/* Feed Type Selector */}
            <Link href="/spaktok-studio"
              className="absolute right-3 top-14 z-30 flex items-center gap-2 rounded-full border border-indigo-300/35 bg-[#171536]/85 px-3 py-2 text-xs font-bold text-white shadow-xl shadow-indigo-900/40 backdrop-blur-xl transition hover:bg-indigo-500/70"
              aria-label="افتح Spaktok Studio AI Director">
              <Sparkles size={15} className="text-sky-300"/> AI Studio
            </Link>
            <div className="absolute top-0 left-0 right-0 z-20 safe-top">
                {/* Feed Tabs */}
                <div className="flex items-center justify-center gap-6 py-2 bg-black/25 backdrop-blur-sm">
                  <button
                    onClick={() => setFeedType('forYou')}
                    className={cn(
                      "text-sm font-semibold transition-all press-effect",
                      feedType === 'forYou' 
                        ? "text-white text-glow-cyan" 
                        : "text-white/50"
                    )}
                  >
                    لك
                  </button>
                  <button
                    onClick={() => setFeedType('following')}
                    aria-pressed={feedType === 'following'}
                    className={cn(
                      "text-sm font-semibold transition-all press-effect",
                      feedType === 'following' 
                        ? "text-white text-glow-cyan" 
                        : "text-white/50"
                    )}
                  >
                    أتابعهم
                  </button>
                  <button
                    onClick={() => setFeedType('live')}
                    aria-pressed={feedType === 'live'}
                    className={cn(
                      "flex items-center gap-1.5 text-sm font-semibold transition-all press-effect",
                      feedType === 'live' 
                        ? "text-white text-glow-pink" 
                        : "text-white/50"
                    )}
                  >
                    <span className="w-1.5 h-1.5 rounded-full bg-[#ff3b30] animate-live-pulse" />
                    مباشر
                  </button>
                </div>
              </div>

            {/* Content */}
            {feedType === 'live' ? (
              <SpaktokLiveHub
                onOpenLivePreview={() => {
                  setCameraInitialMode('live')
                  setShowCamera(true)
                }}
                onUserClick={handleUserClick}
              />
            ) : (
              <div className="absolute inset-0">
                <VideoFeed key={feedType + (focusedVideoId || '')} feedType={feedType} initialVideoId={focusedVideoId} onUserClick={handleUserClick} onCreate={() => setShowCamera(true)} onDiscover={() => handleTabChange('discover')} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'discover' && (
          <DiscoverScreen 
            onUserClick={handleUserClick}
            onShopClick={() => setShowShop(true)}
            onNotificationsClick={() => setShowNotifications(true)}
            onVideoClick={handleVideoClick}
          />
        )}

        {activeTab === 'stories' && (
          <StoriesScreen onStoryClick={handleStoryClick} onAddStory={handleAddStory} />
        )}

        {activeTab === 'chat' && (
          <ChatScreen onUserClick={handleUserClick} />
        )}

        {activeTab === 'profile' && (
          <ProfileScreen 
            userId={viewingProfile || undefined}
            isOwnProfile={!viewingProfile}
            onSettingsClick={() => setShowSettings(true)}
            onVideoClick={handleVideoClick}
            onBack={viewingProfile ? () => setViewingProfile(null) : undefined}
          />
        )}
      </main>

      {/* Bottom Navigation */}
      <BottomNavigation 
        activeTab={activeTab} 
        onTabChange={handleTabChange}
      />
    </div>
  )
}
