'use client'

import { useState, useEffect } from 'react'
import { BottomNavigation } from '@/components/spaktok/bottom-navigation'
import { VideoFeed } from '@/components/spaktok/video-feed'
import { StoryBar } from '@/components/spaktok/story-bar'
import { StoryViewer } from '@/components/spaktok/story-viewer'
import { LiveGrid } from '@/components/spaktok/live-grid'
import { LiveStream } from '@/components/spaktok/live-stream'
import { ChatScreen } from '@/components/spaktok/chat-screen'
import { CameraScreen } from '@/components/spaktok/camera-screen'
import { ProfileScreen } from '@/components/spaktok/profile-screen'
import { DiscoverScreen } from '@/components/spaktok/discover-screen'
import { NotificationsScreen } from '@/components/spaktok/notifications-screen'
import { ShopScreen } from '@/components/spaktok/shop-screen'
import { SettingsScreen } from '@/components/spaktok/settings-screen'
import { AuthScreen } from '@/components/spaktok/auth-screen'
import { SplashScreen } from '@/components/spaktok/splash-screen'
import type { TabType, FeedType } from '@/lib/types'
import { cn } from '@/lib/utils'
import { Bell, ShoppingBag, Settings } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAuth } from '@/hooks/use-auth'

export default function SpakTailElite() {
  const [isLoading, setIsLoading] = useState(true)
  const { session, isLoading: isAuthLoading } = useAuth()
  const isAuthenticated = !!session
  const [activeTab, setActiveTab] = useState<TabType>('home')
  const [feedType, setFeedType] = useState<FeedType>('forYou')
  const [showCamera, setShowCamera] = useState(false)
  const [viewingStory, setViewingStory] = useState<string | null>(null)
  const [viewingProfile, setViewingProfile] = useState<string | null>(null)
  const [viewingLive, setViewingLive] = useState<string | null>(null)
  const [showNotifications, setShowNotifications] = useState(false)
  const [showShop, setShowShop] = useState(false)
  const [showSettings, setShowSettings] = useState(false)
  const [paymentStatus, setPaymentStatus] = useState<'success' | 'cancelled' | null>(null)

  useEffect(() => {
    const status = new URLSearchParams(window.location.search).get('payment')
    if (status === 'success' || status === 'cancelled') {
      setPaymentStatus(status)
      window.history.replaceState({}, '', window.location.pathname)
    }
  }, [])

  const handleTabChange = (tab: TabType) => {
    if (tab === 'create') {
      setShowCamera(true)
    } else {
      setActiveTab(tab)
      setViewingProfile(null)
      setShowNotifications(false)
      setShowShop(false)
      setShowSettings(false)
    }
  }

  const handleUserClick = (userId: string) => {
    setViewingProfile(userId)
    setActiveTab('profile')
  }

  const handleStoryClick = (storyId: string) => {
    setViewingStory(storyId)
  }

  const handleAddStory = () => {
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
    return <AuthScreen />
  }

  // Camera Screen
  if (showCamera) {
    return <CameraScreen onClose={() => setShowCamera(false)} />
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
          <div className="h-dvh flex flex-col">
            {/* Feed Type Selector */}
            <div className="absolute top-0 left-0 right-0 z-20 safe-top">
                {/* Top Actions */}
                <div className="flex items-center justify-between px-4 pt-3">
                  <h1 className="text-xl font-black tracking-[-0.04em] text-[#3155ff]">
                    SpakTail
                  </h1>
                  <div className="flex items-center gap-1">
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="spak-control h-10 w-10 rounded-xl text-white/80 hover:text-white"
                      onClick={() => setShowShop(true)}
                      aria-label="فتح المتجر"
                    >
                      <ShoppingBag className="w-5 h-5" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon" 
                      className="rounded-full text-white/80 hover:text-white relative"
                      onClick={() => setShowNotifications(true)}
                      aria-label="فتح التنبيهات"
                    >
                      <Bell className="w-5 h-5" />
                      <span className="absolute top-1 right-1 w-2 h-2 bg-rose-500 rounded-full" />
                    </Button>
                  </div>
                </div>
                
                {/* Stories */}
                <div className="glass border-b border-white/5">
                  <StoryBar 
                    onStoryClick={handleStoryClick}
                    onAddStory={handleAddStory}
                  />
                </div>
                
                {/* Feed Tabs */}
                <div className="flex items-center justify-center gap-6 py-2 glass-light">
                  <button
                    onClick={() => setFeedType('forYou')}
                    className={cn(
                      "text-sm font-semibold transition-all press-effect",
                      feedType === 'forYou' 
                        ? "text-white text-glow-cyan" 
                        : "text-white/50"
                    )}
                  >
                    Für dich
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
                    Folge ich
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
                    Live
                  </button>
                </div>
              </div>

            {/* Content */}
            {feedType === 'live' ? (
              <LiveGrid onLiveClick={handleLiveClick} onBack={() => setFeedType('forYou')} />
            ) : (
              <div className="flex-1 pt-36">
                <VideoFeed onUserClick={handleUserClick} />
              </div>
            )}
          </div>
        )}

        {activeTab === 'discover' && (
          <DiscoverScreen 
            onUserClick={handleUserClick}
            onVideoClick={(videoId) => {
              setFeedType('forYou')
              setActiveTab('home')
            }}
          />
        )}

        {activeTab === 'chat' && (
          <ChatScreen onUserClick={handleUserClick} />
        )}

        {activeTab === 'profile' && (
          <ProfileScreen 
            userId={viewingProfile || undefined}
            isOwnProfile={!viewingProfile}
            onSettingsClick={() => setShowSettings(true)}
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
