'use client'

import { useState } from 'react'
import { Search, TrendingUp, Sparkles, Music2, Hash, Users, Play, MapPin, ChevronLeft, Bell, ShoppingBag } from 'lucide-react'
import { mockVideos, mockUsers, mockLiveStreams, formatNumber } from '@/lib/mock-data'
import { cn } from '@/lib/utils'

interface DiscoverScreenProps {
  onUserClick: (userId: string) => void
  onVideoClick: (videoId: string) => void
  onShopClick?: () => void
  onNotificationsClick?: () => void
}

type CategoryType = 'all' | 'trending' | 'music' | 'gaming' | 'food' | 'sports' | 'fashion'

export function DiscoverScreen({ onUserClick, onVideoClick, onShopClick, onNotificationsClick }: DiscoverScreenProps) {
  const [searchQuery, setSearchQuery] = useState('')
  const [selectedCategory, setSelectedCategory] = useState<CategoryType>('all')
  const [followedUsers, setFollowedUsers] = useState<string[]>([])
  const [locationEnabled, setLocationEnabled] = useState(false)
  const [ghostMode, setGhostMode] = useState(true)
  const [selectedPlace, setSelectedPlace] = useState('الرياض')

  const normalizedQuery = searchQuery.trim().toLowerCase()
  const visibleUsers = mockUsers
    .filter((user) => !normalizedQuery || `${user.displayName} ${user.username}`.toLowerCase().includes(normalizedQuery))
    .slice(0, 5)
  const visibleVideos = mockVideos
    .filter((video) => !normalizedQuery || `${video.caption} ${video.user.username} ${video.tags.join(' ')}`.toLowerCase().includes(normalizedQuery))
    .filter((video) => selectedCategory === 'all' || selectedCategory === 'trending' || video.tags.some((tag) => tag.toLowerCase().includes(selectedCategory)))
    .slice(0, 4)

  const categories: { id: CategoryType; label: string; icon?: any }[] = [
    { id: 'all', label: 'الكل' },
    { id: 'trending', label: 'ترند', icon: TrendingUp },
    { id: 'music', label: 'موسيقى', icon: Music2 },
    { id: 'gaming', label: 'ألعاب' },
    { id: 'food', label: 'طعام' },
    { id: 'sports', label: 'رياضة' },
    { id: 'fashion', label: 'أزياء' },
  ]

  const trendingTags = [
    { tag: 'رمضان_كريم', posts: '2.5M' },
    { tag: 'تحدي_الرقص', posts: '1.8M' },
    { tag: 'وصفات_سريعة', posts: '950K' },
    { tag: 'تقنية_2026', posts: '720K' },
    { tag: 'سفر_وترحال', posts: '580K' },
  ]

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="sticky top-0 z-10 glass safe-top">
        <div className="px-4 py-3">
          <div className="mb-3 flex items-center justify-between">
            <h1 className="text-lg font-bold text-white">اكتشف</h1>
            <div className="flex items-center gap-2">
              {onNotificationsClick && (
                <button type="button" onClick={onNotificationsClick} aria-label="فتح التنبيهات" className="relative rounded-xl p-2 text-white/80 hover:bg-white/10">
                  <Bell className="h-5 w-5" />
                  <span className="absolute right-1 top-1 h-2 w-2 rounded-full bg-rose-500" />
                </button>
              )}
              {onShopClick && (
                <button type="button" onClick={onShopClick} aria-label="فتح المتجر" className="rounded-xl p-2 text-white/80 hover:bg-white/10">
                  <ShoppingBag className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* Search Bar */}
          <div className="glass-card rounded-2xl flex items-center px-4 py-3 mb-4">
            <Search className="w-5 h-5 text-white/40" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="ابحث عن أشخاص، أصوات، هاشتاقات..."
              className="flex-1 bg-transparent text-white text-sm placeholder:text-white/40 outline-none mr-3"
            />
          </div>

          {/* Categories */}
          <div className="flex gap-2 overflow-x-auto scrollbar-hide pb-2">
            {categories.map((cat) => (
              <button
                key={cat.id}
                onClick={() => setSelectedCategory(cat.id)}
                className={cn(
                  "flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-medium whitespace-nowrap transition-all press-effect",
                  selectedCategory === cat.id
                    ? "bg-gradient-to-r from-[#ffffff] to-[#ffffff] text-white neon-cyan"
                    : "glass-light text-white/70"
                )}
              >
                {cat.icon && <cat.icon className="w-4 h-4" />}
                {cat.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="px-4 py-4 space-y-6">
        {/* Trending Hashtags */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Hash className="w-5 h-5 text-[#ffffff]" />
              <h2 className="text-lg font-bold text-white">هاشتاقات رائجة</h2>
            </div>
            <button className="text-sm text-[#ffffff] flex items-center gap-1">
              عرض الكل
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-2 overflow-x-auto scrollbar-hide">
            {trendingTags.map((item, index) => (
              <button
                key={item.tag}
                type="button"
                onClick={() => setSearchQuery(item.tag.replaceAll('_', ' '))}
                className="glass-card rounded-xl p-3 flex-shrink-0 press-effect min-w-[140px] text-right"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={cn(
                    "w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold",
                    index === 0 ? "bg-[#FFB800] text-black" :
                    index === 1 ? "bg-white/20 text-white" :
                    index === 2 ? "bg-[#CD7F32] text-white" :
                    "glass-light text-white/70"
                  )}>
                    {index + 1}
                  </span>
                  <TrendingUp className={cn(
                    "w-4 h-4",
                    index < 3 ? "text-[#ffffff]" : "text-white/50"
                  )} />
                </div>
                <p className="text-sm font-semibold text-white text-right">#{item.tag}</p>
                <p className="text-xs text-white/50 text-right">{item.posts} منشور</p>
              </button>
            ))}
          </div>
        </section>

        {/* Live Now */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 rounded-full bg-[#3155ff] animate-live-pulse" />
              <h2 className="text-lg font-bold text-white">مباشر الآن</h2>
            </div>
            <button className="text-sm text-[#ffffff] flex items-center gap-1">
              عرض الكل
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide">
            {mockLiveStreams.map((stream) => (
              <button
                key={stream.id}
                className="relative flex-shrink-0 w-32 press-effect"
              >
                <div className="aspect-[3/4] rounded-xl overflow-hidden relative">
                  <img
                    src={stream.thumbnailUrl || "/placeholder.svg"}
                    alt={stream.title}
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  
                  {/* Live Badge */}
                  <div className="absolute top-2 left-2 flex items-center gap-1">
                    <div className="px-1.5 py-0.5 rounded bg-[#3155ff] text-[8px] font-bold text-white flex items-center gap-1 animate-live-pulse">
                      <div className="w-1 h-1 rounded-full bg-white" />
                      LIVE
                    </div>
                  </div>

                  {/* Viewers */}
                  <div className="absolute top-2 right-2 glass-light rounded-full px-1.5 py-0.5 flex items-center gap-1">
                    <Users className="w-2.5 h-2.5 text-white" />
                    <span className="text-[9px] text-white">{formatNumber(stream.viewers)}</span>
                  </div>

                  {/* Info */}
                  <div className="absolute bottom-0 left-0 right-0 p-2">
                    <div className="flex items-center gap-1.5 mb-1">
                      <img
                        src={stream.user.avatar || "/placeholder.svg"}
                        alt={stream.user.displayName}
                        className="w-5 h-5 rounded-full border border-[#3155ff] object-cover"
                        crossOrigin="anonymous"
                      />
                      <span className="text-[10px] text-white font-semibold truncate">{stream.user.username}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Suggested Creators */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-[#ffffff]" />
              <h2 className="text-lg font-bold text-white">مبدعون مقترحون</h2>
            </div>
            <button className="text-sm text-[#ffffff] flex items-center gap-1">
              عرض الكل
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          <div className="flex gap-3 overflow-x-auto scrollbar-hide">
            {visibleUsers.map((user) => (
              <article
                key={user.id}
                className="glass-card rounded-xl p-4 flex-shrink-0 w-36 text-center"
              >
                <div className="relative w-16 h-16 mx-auto mb-3">
                  <div className="w-full h-full rounded-full p-[2px] bg-gradient-to-tr from-[#ffffff] via-[#ffffff] to-[#3155ff]">
                    <img
                      src={user.avatar || "/placeholder.svg"}
                      alt={user.displayName}
                      className="w-full h-full rounded-full object-cover"
                      crossOrigin="anonymous"
                    />
                  </div>
                  {user.isVerified && (
                    <div className="absolute -bottom-1 -right-1 w-5 h-5 rounded-full bg-[#ffffff] flex items-center justify-center border-2 border-[#0a0a14]">
                      <Sparkles className="w-2.5 h-2.5 text-black" />
                    </div>
                  )}
                </div>
                <h4 className="text-sm font-semibold text-white truncate">{user.displayName}</h4>
                <p className="text-xs text-white/50 mb-3">{formatNumber(user.followers)} متابع</p>
                <button
                  type="button"
                  onClick={() => onUserClick(user.id)}
                  className="w-full py-1.5 rounded-lg glass-light text-white text-xs font-semibold press-effect"
                >
                  عرض الملف
                </button>
                <button
                  type="button"
                  onClick={() => setFollowedUsers((current) => current.includes(user.id) ? current.filter((id) => id !== user.id) : [...current, user.id])}
                  className={cn(
                    "w-full mt-2 py-1.5 rounded-lg text-xs font-semibold press-effect",
                    followedUsers.includes(user.id) ? "bg-[#ffffff]/15 text-[#ffffff]" : "bg-gradient-to-r from-[#3155ff] to-[#ffffff] text-white"
                  )}
                >
                  {followedUsers.includes(user.id) ? 'متابَع' : 'متابعة'}
                </button>
              </article>
            ))}
          </div>
        </section>

        {/* Trending Videos */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-5 h-5 text-[#ffffff]" />
              <h2 className="text-lg font-bold text-white">فيديوهات رائجة</h2>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-2">
            {visibleVideos.map((video, index) => (
              <button
                key={video.id}
                onClick={() => onVideoClick(video.id)}
                className={cn(
                  "relative rounded-xl overflow-hidden press-effect",
                  index === 0 && "col-span-2"
                )}
              >
                <div className={cn(
                  "relative",
                  index === 0 ? "aspect-video" : "aspect-[3/4]"
                )}>
                  <img
                    src={video.thumbnailUrl || "/placeholder.svg"}
                    alt={video.caption}
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                  <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-transparent to-transparent" />
                  
                  {/* Play Icon */}
                  <div className="absolute inset-0 flex items-center justify-center opacity-0 hover:opacity-100 transition-opacity">
                    <div className="w-12 h-12 rounded-full glass flex items-center justify-center">
                      <Play className="w-6 h-6 text-white ml-0.5" fill="white" />
                    </div>
                  </div>

                  {/* Stats */}
                  <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between">
                    <div className="flex items-center gap-1">
                      <Play className="w-3 h-3 text-white" fill="white" />
                      <span className="text-xs text-white font-medium">{formatNumber(video.views)}</span>
                    </div>
                    <div className="flex items-center gap-2">
                      <img
                        src={video.user.avatar || "/placeholder.svg"}
                        alt={video.user.displayName}
                        className="w-5 h-5 rounded-full border border-white/30 object-cover"
                        crossOrigin="anonymous"
                      />
                      <span className="text-xs text-white font-medium">@{video.user.username}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* Near You */}
        <section>
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <MapPin className="w-5 h-5 text-[#3155ff]" />
              <h2 className="text-lg font-bold text-white">قريب منك</h2>
            </div>
            <button
              type="button"
              onClick={() => setLocationEnabled((enabled) => !enabled)}
              className="text-sm text-[#ffffff] flex items-center gap-1 press-effect"
            >
              {locationEnabled ? 'إخفاء الخريطة' : 'عرض الخريطة'}
              <ChevronLeft className="w-4 h-4" />
            </button>
          </div>
          <div className="glass-card rounded-2xl p-4">
            <div className="relative aspect-[2/1] rounded-xl overflow-hidden bg-[#101525] mb-3">
              <div className="absolute inset-0 opacity-50 bg-[linear-gradient(25deg,transparent_48%,rgba(255,255,255,.12)_49%,transparent_51%),linear-gradient(115deg,transparent_48%,rgba(255,59,48,.12)_49%,transparent_51%)] bg-[length:54px_54px]" />
              {['الرياض', 'جدة', 'دبي'].map((place, index) => (
                <button
                  key={place}
                  type="button"
                  onClick={() => setSelectedPlace(place)}
                  className={cn(
                    'absolute flex items-center gap-1 rounded-full px-2 py-1 text-[10px] font-semibold text-white glass-light press-effect',
                    index === 0 ? 'left-[18%] top-[24%]' : index === 1 ? 'right-[16%] bottom-[22%]' : 'left-[52%] top-[54%]',
                    selectedPlace === place && 'ring-2 ring-[#ffffff] bg-[#ffffff]/25'
                  )}
                >
                  <span className="size-1.5 rounded-full bg-[#ffffff] animate-live-pulse" />
                  {place}
                </button>
              ))}
              <div className="absolute bottom-2 right-2 rounded-lg bg-black/45 px-2 py-1 text-[10px] text-white/70">{selectedPlace} · 24 قصة قريبة</div>
            </div>
            <div className="flex items-center justify-between gap-3 mb-3">
              <div>
                <p className="text-sm font-semibold text-white">وضع التخفي</p>
                <p className="text-[11px] text-white/45">لا تشارك موقعك الدقيق</p>
              </div>
              <button
                type="button"
                aria-pressed={ghostMode}
                onClick={() => setGhostMode((enabled) => !enabled)}
                className={cn('relative h-7 w-12 rounded-full transition-colors press-effect', ghostMode ? 'bg-[#ffffff]' : 'bg-white/15')}
              >
                <span className={cn('absolute top-1 size-5 rounded-full bg-white transition-transform', ghostMode ? 'translate-x-1' : 'translate-x-6')} />
              </button>
            </div>
            <button
              type="button"
              onClick={() => setLocationEnabled((enabled) => !enabled)}
              className={cn("w-full py-2.5 rounded-xl text-white font-semibold text-sm press-effect", locationEnabled ? "bg-[#ffffff]/15 text-[#ffffff]" : "glass-light")}
            >
              {locationEnabled ? 'إيقاف الموقع' : 'تفعيل الموقع واكتشاف القريب'}
            </button>
          </div>
        </section>
      </div>
    </div>
  )
}
