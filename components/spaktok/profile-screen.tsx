'use client'

import { useState } from 'react'
import { Settings, Share2, Grid3X3, Bookmark, Heart, ShoppingBag, ChevronDown, ChevronLeft, MoreHorizontal, Play, Eye, Wallet, TrendingUp, Award, Star, Zap, Crown, Edit } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { mockUsers, mockVideos, mockProducts, formatNumber } from '@/lib/mock-data'
import type { User } from '@/lib/types'
import { cn } from '@/lib/utils'

interface ProfileScreenProps {
  userId?: string
  isOwnProfile?: boolean
  onSettingsClick?: () => void
  onBack?: () => void
}

type TabType = 'videos' | 'liked' | 'saved' | 'shop'

export function ProfileScreen({ userId, isOwnProfile = true, onSettingsClick, onBack }: ProfileScreenProps) {
  const [activeTab, setActiveTab] = useState<TabType>('videos')
  const [isFollowing, setIsFollowing] = useState(false)
  const [isProfileShared, setIsProfileShared] = useState(false)

  const shareProfile = async () => {
    const shareUrl = typeof window !== 'undefined' ? window.location.href : ''
    try {
      if (navigator.share) {
        await navigator.share({ title: user.displayName, text: `@${user.username} على SpakTail`, url: shareUrl })
      } else if (navigator.clipboard) {
        await navigator.clipboard.writeText(shareUrl)
      }
      setIsProfileShared(true)
      window.setTimeout(() => setIsProfileShared(false), 2200)
    } catch {
      setIsProfileShared(false)
    }
  }
  
  const user = userId ? mockUsers.find(u => u.id === userId) || mockUsers[0] : mockUsers[0]

  const tabs = [
    { id: 'videos' as TabType, icon: Grid3X3, label: 'فيديوهات' },
    { id: 'liked' as TabType, icon: Heart, label: 'إعجابات' },
    { id: 'saved' as TabType, icon: Bookmark, label: 'محفوظات' },
    { id: 'shop' as TabType, icon: ShoppingBag, label: 'المتجر' },
  ]

  return (
    <div className="min-h-screen pb-24">
      {/* Header */}
      <div className="glass border-b border-white/10 px-4 py-3 safe-top sticky top-0 z-10">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
                <ChevronLeft className="w-5 h-5 text-white" />
              </Button>
            )}
            <button className="flex items-center gap-1 press-effect">
              <span className="text-white font-bold">{user.username}</span>
              <ChevronDown className="w-4 h-4 text-white/70" />
            </button>
          </div>
          <div className="flex items-center gap-2">
            {isOwnProfile && (
              <button className="w-9 h-9 rounded-full glass flex items-center justify-center press-effect">
                <Wallet className="w-5 h-5 text-[#ffffff]" />
              </button>
            )}
            <button className="w-9 h-9 rounded-full glass flex items-center justify-center press-effect">
              <Share2 className="w-5 h-5 text-white" />
            </button>
            <button 
              onClick={isOwnProfile ? onSettingsClick : undefined}
              className="w-9 h-9 rounded-full glass flex items-center justify-center press-effect"
            >
              {isOwnProfile ? (
                <Settings className="w-5 h-5 text-white" />
              ) : (
                <MoreHorizontal className="w-5 h-5 text-white" />
              )}
            </button>
          </div>
        </div>
      </div>

      {/* Profile Info */}
      <div className="px-4 py-6">
        <div className="flex flex-col items-center">
          {/* Avatar */}
          <div className="relative mb-4">
            <div className="w-24 h-24 rounded-full p-[3px] bg-gradient-to-tr from-[#0b1f66] via-[#3155ff] to-[#6d8dff] shadow-[0_0_18px_rgba(49,85,255,0.35)]">
              <img
                src={user.avatar || "/placeholder.svg"}
                alt={user.displayName}
                className="w-full h-full rounded-full object-cover border-2 border-[#0a0a14]"
                crossOrigin="anonymous"
              />
            </div>
            {user.isVerified && (
              <div className="absolute -bottom-1 -right-1 w-8 h-8 rounded-full bg-gradient-to-br from-[#0b1f66] to-[#3155ff] flex items-center justify-center border-2 border-[#0a0a14] shadow-[0_0_12px_rgba(49,85,255,0.45)]">
                <Star className="w-4 h-4 text-black" fill="currentColor" />
              </div>
            )}
            {isOwnProfile && (
              <button className="absolute bottom-0 left-0 w-8 h-8 rounded-full bg-white/10 flex items-center justify-center border border-white/20 press-effect">
                <Edit className="w-4 h-4 text-white" />
              </button>
            )}
          </div>

          {/* Name */}
          <h1 className="text-xl font-bold text-white mb-1">{user.displayName}</h1>
          <p className="text-sm text-white/50 mb-3">@{user.username}</p>

          {/* Bio */}
          {user.bio && (
            <p className="text-sm text-white/80 text-center mb-4 max-w-[280px]">{user.bio}</p>
          )}

          {/* Stats */}
          <div className="flex items-center gap-8 mb-6">
            <button className="flex flex-col items-center press-effect">
              <span className="text-lg font-bold text-white">{formatNumber(user.following)}</span>
              <span className="text-xs text-white/50">متابَع</span>
            </button>
            <button className="flex flex-col items-center press-effect">
              <span className="text-lg font-bold text-white">{formatNumber(user.followers)}</span>
              <span className="text-xs text-white/50">متابِع</span>
            </button>
            <button className="flex flex-col items-center press-effect">
              <span className="text-lg font-bold text-white">{formatNumber(user.likes)}</span>
              <span className="text-xs text-white/50">إعجاب</span>
            </button>
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3 w-full max-w-xs">
            {isOwnProfile ? (
              <>
                <button
                  type="button"
                  onClick={() => onSettingsClick?.()}
                  className="flex-1 py-2.5 px-4 rounded-xl glass-card text-white font-semibold text-sm press-effect"
                >
                  تعديل الملف
                </button>
                <button
                  type="button"
                  onClick={shareProfile}
                  className="flex-1 py-2.5 px-4 rounded-xl bg-gradient-to-r from-[#ffffff] to-[#ffffff] text-white font-semibold text-sm press-effect neon-cyan"
                >
                  {isProfileShared ? 'تم نسخ الرابط' : 'مشاركة الملف'}
                </button>
              </>
            ) : (
              <>
                <button 
                  onClick={() => setIsFollowing(!isFollowing)}
                  className={cn(
                    "flex-1 py-2.5 px-4 rounded-xl font-semibold text-sm press-effect transition-all",
                    isFollowing 
                      ? "glass-card text-white" 
                      : "bg-gradient-to-r from-[#0b1f66] via-[#3155ff] to-[#6d8dff] text-white shadow-[0_0_14px_rgba(49,85,255,0.3)]"
                  )}
                >
                  {isFollowing ? 'متابَع' : 'متابعة'}
                </button>
                <button className="flex-1 py-2.5 px-4 rounded-xl glass-card text-white font-semibold text-sm press-effect">
                  رسالة
                </button>
                <button className="w-11 h-11 rounded-xl glass-card flex items-center justify-center press-effect">
                  <ChevronDown className="w-5 h-5 text-white" />
                </button>
              </>
            )}
          </div>
        </div>

        {/* Creator Stats (if own profile) */}
        {isOwnProfile && (
          <div className="mt-6 glass-card rounded-2xl p-4">
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-white font-semibold">إحصائيات المبدع</h3>
              <button className="text-xs text-[#ffffff]">عرض الكل</button>
            </div>
            <div className="grid grid-cols-3 gap-3">
              <div className="glass-light rounded-xl p-3 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Eye className="w-5 h-5 text-[#ffffff]" />
                </div>
                <p className="text-lg font-bold text-white">2.5M</p>
                <p className="text-[10px] text-white/50">مشاهدات</p>
              </div>
              <div className="glass-light rounded-xl p-3 text-center">
                <div className="flex items-center justify-center mb-2">
                  <TrendingUp className="w-5 h-5 text-[#00FF88]" />
                </div>
                <p className="text-lg font-bold text-white">+15%</p>
                <p className="text-[10px] text-white/50">نمو</p>
              </div>
              <div className="glass-light rounded-xl p-3 text-center">
                <div className="flex items-center justify-center mb-2">
                  <Zap className="w-5 h-5 text-[#FFB800]" />
                </div>
                <p className="text-lg font-bold text-white">$1,250</p>
                <p className="text-[10px] text-white/50">أرباح</p>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Tabs */}
      <div className="sticky top-14 z-10 glass border-y border-white/10">
        <div className="flex">
          {tabs.map((tab) => {
            const Icon = tab.icon
            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  "flex-1 flex items-center justify-center gap-2 py-3 transition-all press-effect",
                  activeTab === tab.id 
                    ? "text-white border-b-2 border-[#ffffff]" 
                    : "text-white/50"
                )}
              >
                <Icon className={cn(
                  "w-5 h-5",
                  activeTab === tab.id && "text-[#ffffff]"
                )} />
                <span className="sr-only">{tab.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* Content Grid */}
      <div className="p-1">
        {activeTab === 'shop' ? (
          <div className="grid grid-cols-2 gap-3 p-3">
            {mockProducts.map((product) => (
              <button key={product.id} className="glass-card rounded-xl overflow-hidden press-effect text-right">
                <div className="aspect-square relative">
                  <img
                    src={product.images[0] || "/placeholder.svg"}
                    alt={product.nameAr}
                    className="w-full h-full object-cover"
                    crossOrigin="anonymous"
                  />
                </div>
                <div className="p-3">
                  <h4 className="text-sm font-semibold text-white truncate">{product.nameAr}</h4>
                  <p className="text-xs text-white/50 mb-2">{product.seller.displayName}</p>
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-[#ffffff]">{product.price} {product.currency}</span>
                    <div className="flex items-center gap-1">
                      <Star className="w-3 h-3 text-[#FFB800]" fill="#FFB800" />
                      <span className="text-xs text-white/70">{product.rating}</span>
                    </div>
                  </div>
                </div>
              </button>
            ))}
          </div>
        ) : (
          <div className="grid grid-cols-3 gap-0.5">
            {mockVideos.map((video, index) => (
              <button key={video.id} className="relative aspect-[3/4] press-effect group">
                <img
                  src={video.thumbnailUrl || "/placeholder.svg"}
                  alt={video.caption}
                  className="w-full h-full object-cover"
                  crossOrigin="anonymous"
                />
                <div className="absolute inset-0 bg-black/20 opacity-0 group-hover:opacity-100 transition-opacity" />
                <div className="absolute bottom-2 left-2 flex items-center gap-1">
                  <Play className="w-3 h-3 text-white" fill="white" />
                  <span className="text-xs text-white font-medium">{formatNumber(video.views)}</span>
                </div>
                {index === 0 && (
                  <div className="absolute top-2 right-2 px-1.5 py-0.5 rounded bg-[#3155ff] text-[8px] font-bold text-white">
                    مثبت
                  </div>
                )}
              </button>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}
