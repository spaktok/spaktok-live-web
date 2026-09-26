// SpakTail - Complete Type Definitions

export interface User {
  id: string
  username: string
  displayName: string
  avatar: string
  bio?: string
  followers: number
  following: number
  likes: number
  coins?: number
  diamonds?: number
  level?: number
  xp?: number
  isVerified: boolean
  isLive?: boolean
  isPremium?: boolean
  badges?: Badge[]
  createdAt: Date
}

export interface Badge {
  id: string
  name: string
  icon: string
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
}

export interface Video {
  id: string
  user: User
  videoUrl: string
  thumbnailUrl: string
  caption: string
  music?: MusicTrack
  likes: number
  comments: number
  shares: number
  views: number
  downloads?: number
  isLiked?: boolean
  isBookmarked?: boolean
  tags: string[]
  mentions?: string[]
  effects?: VideoEffect[]
  duetWith?: Video
  stitchFrom?: Video
  isAd?: boolean
  allowComments?: boolean
  allowDuet?: boolean
  allowStitch?: boolean
  createdAt: Date
}

export interface MusicTrack {
  id?: string
  name: string
  artist: string
  coverUrl: string
  duration?: number
  isOriginal?: boolean
  usageCount?: number
}

export interface VideoEffect {
  id: string
  name: string
  type: 'filter' | 'sticker' | 'text' | 'ar'
  timestamp: number
  duration: number
}

export interface Story {
  id: string
  user: User
  mediaUrl: string
  mediaType: 'image' | 'video'
  duration: number
  views: number
  isViewed?: boolean
  reactions: StoryReaction[]
  mentions?: string[]
  location?: string
  music?: MusicTrack
  filter?: Filter
  stickers?: Sticker[]
  createdAt: Date
  expiresAt: Date
}

export interface StoryReaction {
  userId: string
  emoji: string
  timestamp: Date
}

export interface Sticker {
  id: string
  type: 'emoji' | 'gif' | 'poll' | 'question' | 'countdown' | 'mention' | 'hashtag' | 'location' | 'link'
  content: string
  position: { x: number; y: number }
  scale: number
  rotation: number
}

// Spak - Voice/Photo Message (Like Snapchat)
export interface Spak {
  id: string
  senderId: string
  receiverId: string
  type: 'photo' | 'video'
  mediaUrl: string
  voiceUrl?: string
  voiceDuration?: number
  textOverlay?: string
  textPosition?: { x: number; y: number }
  textStyle?: TextStyle
  filter?: Filter
  stickers: Sticker[]
  isViewed: boolean
  viewedAt?: Date
  expiresAfterView: number // seconds after view
  allowReplay: boolean
  replayCount: number
  maxReplays: number
  isScreenshotted: boolean
  screenshottedAt?: Date
  createdAt: Date
}

export interface TextStyle {
  font: string
  size: number
  color: string
  backgroundColor?: string
  alignment: 'left' | 'center' | 'right'
  isBold: boolean
  isItalic: boolean
}

export interface LiveStream {
  id: string
  user: User
  title: string
  description?: string
  thumbnailUrl: string
  viewers: number
  peakViewers?: number
  likes: number
  gifts: LiveGift[]
  totalGiftValue?: number
  comments?: LiveComment[]
  isLive: boolean
  isPaused?: boolean
  startedAt: Date
  endedAt?: Date
  duration?: number
  tags: string[]
  category?: LiveCategory
  isAgeRestricted?: boolean
  allowGifts?: boolean
  giftGoal?: GiftGoal
  coHosts?: User[]
  blockedUsers?: string[]
  moderators?: string[]
  quality?: '720p' | '1080p' | '4K'
  // Battle/PK features
  battle?: LiveBattle
  // Multi-guest features
  guests?: LiveGuest[]
  maxGuests?: number
}

export interface LiveCategory {
  id: string
  name: string
  nameAr: string
  icon: string
}

export interface LiveGift {
  id: string
  gift: Gift
  sender: User
  quantity: number
  timestamp: Date
  animation: GiftAnimation
}

export interface GiftAnimation {
  type: 'float' | 'explode' | 'rain' | 'fullscreen'
  duration: number
}

export interface LiveComment {
  id: string
  user: User
  content: string
  isPinned: boolean
  isHighlighted: boolean
  giftAttached?: Gift
  timestamp: Date
}

export interface GiftGoal {
  targetAmount: number
  currentAmount: number
  title: string
  reward: string
}

// Live Battle/PK System
export interface LiveBattle {
  id: string
  challenger: User
  opponent: User
  status: 'pending' | 'active' | 'finished'
  challengerScore: number
  opponentScore: number
  duration: number
  startedAt?: Date
  endedAt?: Date
  winner?: User
  stakes?: BattleStakes
  rounds: BattleRound[]
}

export interface BattleRound {
  roundNumber: number
  challengerGifts: number
  opponentGifts: number
  winner: 'challenger' | 'opponent' | 'tie'
}

export interface BattleStakes {
  type: 'coins' | 'diamonds' | 'badge' | 'custom'
  amount?: number
  description?: string
}

export interface LiveGuest {
  user: User
  joinedAt: Date
  position: number
  isMuted: boolean
  isVideoOff: boolean
}

export interface Gift {
  id: string
  name: string
  nameAr?: string
  icon: string
  value: number
  coinCost?: number
  animation?: string
  animationType?: GiftAnimation['type']
  isLimited?: boolean
  limitedUntil?: Date
  category?: 'basic' | 'premium' | 'luxury' | 'legendary' | 'event'
  requiredLevel?: number
  soundEffect?: string
}

export interface Message {
  id: string
  chatId?: string
  senderId: string
  receiverId: string
  type?: 'text' | 'image' | 'video' | 'voice' | 'spak' | 'gift' | 'sticker' | 'location' | 'contact'
  content?: string
  mediaUrl?: string
  mediaThumbnail?: string
  voiceDuration?: number
  voiceWaveform?: number[]
  spak?: Spak
  gift?: Gift
  sticker?: ChatSticker
  location?: LocationData
  replyTo?: Message
  forwardedFrom?: User
  isRead: boolean
  isDelivered?: boolean
  isSelfDestruct: boolean
  destructAfter?: number
  destructTimer?: 'afterView' | 'afterSend'
  isEdited?: boolean
  editedAt?: Date
  reactions?: MessageReaction[]
  createdAt: Date
  readAt?: Date
  deletedAt?: Date
  deletedFor?: string[]
}

export interface MessageReaction {
  userId: string
  emoji: string
  timestamp: Date
}

export interface ChatSticker {
  id: string
  packId: string
  url: string
  isAnimated: boolean
}

export interface LocationData {
  latitude: number
  longitude: number
  name: string
  address: string
}

export interface Chat {
  id: string
  type?: 'direct' | 'group'
  participants: User[]
  groupName?: string
  groupAvatar?: string
  groupAdmins?: string[]
  lastMessage?: Message
  unreadCount: number
  isPinned: boolean
  isMuted: boolean
  muteUntil?: Date
  isArchived?: boolean
  theme?: ChatTheme
  nickname?: { [userId: string]: string }
  typing?: string[]
  updatedAt: Date
  createdAt?: Date
}

export interface ChatTheme {
  id: string
  name: string
  backgroundImage?: string
  backgroundColor?: string
  bubbleColor: string
  textColor: string
}

export interface Filter {
  id: string
  name: string
  nameAr: string
  thumbnailUrl: string
  previewUrl?: string
  category: FilterCategory
  intensity?: number
  isNew?: boolean
  isTrending?: boolean
  isPremium?: boolean
  usageCount?: number
  creatorId?: string
}

export type FilterCategory = 'beauty' | 'fun' | 'ar' | 'color' | 'vintage' | 'artistic' | 'seasonal' | 'branded'

export interface ARLens {
  id: string
  name: string
  nameAr: string
  thumbnailUrl: string
  previewUrl: string
  category: 'face' | 'world' | 'body' | 'hand'
  is3D: boolean
  hasSound: boolean
  isInteractive: boolean
  triggers: ARTrigger[]
  creator: User
  usageCount: number
  isNew?: boolean
  isTrending?: boolean
}

export interface ARTrigger {
  type: 'tap' | 'openMouth' | 'raiseEyebrows' | 'smile' | 'blink' | 'headTurn'
  action: string
}

export interface Product {
  id: string
  name: string
  nameAr: string
  price: number
  originalPrice?: number
  currency: string
  images: string[]
  video?: string
  description: string
  descriptionAr?: string
  seller: User
  rating: number
  reviews: number
  reviewsList?: ProductReview[]
  inStock: boolean
  stockCount?: number
  category: string
  subcategory?: string
  variants?: ProductVariant[]
  shipping?: ShippingInfo
  tags?: string[]
  linkedVideo?: Video
}

export interface ProductVariant {
  id: string
  name: string
  value: string
  price?: number
  inStock: boolean
  image?: string
}

export interface ShippingInfo {
  freeShipping: boolean
  estimatedDays: number
  cost?: number
}

export interface ProductReview {
  id: string
  user: User
  rating: number
  content: string
  images: string[]
  video?: string
  isVerifiedPurchase: boolean
  helpfulCount: number
  createdAt: Date
}

export interface Notification {
  id: string
  type: NotificationType
  fromUser?: User
  content: string
  contentAr?: string
  referenceId?: string
  referenceType?: 'video' | 'live' | 'message' | 'order' | 'battle'
  thumbnail?: string
  isRead: boolean
  actionUrl?: string
  createdAt: Date
}

export type NotificationType = 
  | 'like' 
  | 'comment' 
  | 'follow' 
  | 'mention' 
  | 'live' 
  | 'message' 
  | 'gift' 
  | 'spak'
  | 'battle_invite'
  | 'battle_result'
  | 'level_up'
  | 'achievement'
  | 'order_update'
  | 'creator_post'
  | 'trending'
  | 'reminder'

export interface Comment {
  id: string
  videoId: string
  user: User
  content: string
  likes: number
  isLiked?: boolean
  isPinned: boolean
  isCreatorLiked: boolean
  replies: Comment[]
  replyCount: number
  mentions: string[]
  timestamp?: number
  createdAt: Date
}

// Wallet and Coins System
export interface Wallet {
  userId: string
  coins: number
  diamonds: number
  pendingWithdrawal: number
  totalEarned: number
  totalSpent: number
  transactions: Transaction[]
}

export interface Transaction {
  id: string
  type: 'purchase' | 'gift_sent' | 'gift_received' | 'withdrawal' | 'reward' | 'refund'
  amount: number
  currency: 'coins' | 'diamonds' | 'real'
  realCurrency?: string
  realAmount?: number
  description: string
  referenceId?: string
  status: 'pending' | 'completed' | 'failed' | 'cancelled'
  createdAt: Date
}

// Competition System
export interface Competition {
  id: string
  title: string
  titleAr: string
  description: string
  descriptionAr: string
  coverImage: string
  type: 'hashtag' | 'duet' | 'battle' | 'vote'
  hashtag?: string
  rules: string[]
  prizes: Prize[]
  participants: CompetitionEntry[]
  participantCount: number
  startDate: Date
  endDate: Date
  votingEndDate?: Date
  status: 'upcoming' | 'active' | 'voting' | 'ended'
  winners?: CompetitionEntry[]
  sponsor?: User
}

export interface Prize {
  rank: number
  title: string
  value: number
  type: 'coins' | 'diamonds' | 'badge' | 'product' | 'cash'
  description: string
}

export interface CompetitionEntry {
  id: string
  user: User
  video: Video
  votes: number
  rank?: number
  submittedAt: Date
}

// Achievement System
export interface Achievement {
  id: string
  name: string
  nameAr: string
  description: string
  descriptionAr: string
  icon: string
  category: 'creator' | 'viewer' | 'social' | 'special'
  tier: 'bronze' | 'silver' | 'gold' | 'platinum' | 'diamond'
  requirement: AchievementRequirement
  reward: AchievementReward
  isSecret: boolean
  unlockedAt?: Date
  progress?: number
}

export interface AchievementRequirement {
  type: 'videos' | 'likes' | 'followers' | 'gifts' | 'watch_time' | 'comments' | 'shares' | 'live_hours' | 'battles_won'
  count: number
}

export interface AchievementReward {
  type: 'coins' | 'diamonds' | 'badge' | 'filter' | 'frame'
  amount?: number
  itemId?: string
}

// Navigation Types
export type TabType = 'home' | 'discover' | 'stories' | 'create' | 'chat' | 'profile'
export type FeedType = 'forYou' | 'following' | 'live' | 'friends'
export type CreateType = 'video' | 'photo' | 'spak' | 'live' | 'story'
export type DiscoverType = 'trending' | 'hashtags' | 'sounds' | 'effects' | 'live' | 'shop'

// Screen States
export type AppScreen = 
  | 'splash'
  | 'auth'
  | 'feed'
  | 'discover'
  | 'camera'
  | 'spak'
  | 'chat'
  | 'chatDetail'
  | 'profile'
  | 'settings'
  | 'live'
  | 'liveStream'
  | 'liveBattle'
  | 'shop'
  | 'notifications'
  | 'storyViewer'
  | 'videoDetail'
  | 'wallet'
  | 'competition'
  | 'search'
