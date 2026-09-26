import type { User, Video, Story, LiveStream, Chat, Message, Filter, Product, Gift, Notification } from './types'

// Mock Users
export const mockUsers: User[] = [
  {
    id: '1',
    username: 'sarah_creates',
    displayName: 'سارة المبدعة',
    avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=150&h=150&fit=crop',
    bio: 'مبدعة محتوى | أشارك يومياتي معكم',
    followers: 2500000,
    following: 450,
    likes: 45000000,
    isVerified: true,
    isLive: true,
    createdAt: new Date('2024-01-15')
  },
  {
    id: '2',
    username: 'ahmed_tech',
    displayName: 'أحمد التقني',
    avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=150&h=150&fit=crop',
    bio: 'تقنية | مراجعات | نصائح',
    followers: 1800000,
    following: 320,
    likes: 32000000,
    isVerified: true,
    createdAt: new Date('2024-02-20')
  },
  {
    id: '3',
    username: 'nora_fitness',
    displayName: 'نورة فتنس',
    avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=150&h=150&fit=crop',
    bio: 'مدربة لياقة معتمدة',
    followers: 950000,
    following: 280,
    likes: 18000000,
    isVerified: true,
    isLive: true,
    createdAt: new Date('2024-03-10')
  },
  {
    id: '4',
    username: 'omar_comedy',
    displayName: 'عمر كوميدي',
    avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=150&h=150&fit=crop',
    bio: 'كوميديان | أضحككم كل يوم',
    followers: 3200000,
    following: 150,
    likes: 78000000,
    isVerified: true,
    createdAt: new Date('2024-01-05')
  },
  {
    id: '5',
    username: 'layla_cooking',
    displayName: 'ليلى شيف',
    avatar: 'https://images.unsplash.com/photo-1487412720507-e7ab37603c6f?w=150&h=150&fit=crop',
    bio: 'وصفات سهلة وسريعة',
    followers: 1200000,
    following: 400,
    likes: 25000000,
    isVerified: false,
    createdAt: new Date('2024-04-01')
  },
  {
    id: '6',
    username: 'khalid_music',
    displayName: 'خالد ميوزك',
    avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=150&h=150&fit=crop',
    bio: 'موسيقي | أغاني أصلية',
    followers: 890000,
    following: 220,
    likes: 15000000,
    isVerified: true,
    isLive: true,
    createdAt: new Date('2024-02-28')
  }
]

// Mock Videos
export const mockVideos: Video[] = [
  {
    id: 'v1',
    user: mockUsers[0],
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerBlazes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400&h=700&fit=crop',
    caption: 'يوم رائع في الطبيعة! من يحب الطبيعة؟',
    music: { name: 'أغنية الصيف', artist: 'فنان مشهور', coverUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=50&h=50&fit=crop' },
    likes: 125000,
    comments: 3400,
    shares: 8900,
    views: 2500000,
    isLiked: false,
    tags: ['طبيعة', 'سفر', 'مغامرة'],
    createdAt: new Date()
  },
  {
    id: 'v2',
    user: mockUsers[1],
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerEscapes.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=400&h=700&fit=crop',
    caption: 'مراجعة أحدث هاتف! شو رأيكم؟',
    music: { name: 'بيت تقني', artist: 'DJ Tech', coverUrl: 'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=50&h=50&fit=crop' },
    likes: 89000,
    comments: 2100,
    shares: 4500,
    views: 1800000,
    isLiked: true,
    tags: ['تقنية', 'مراجعة', 'هواتف'],
    createdAt: new Date()
  },
  {
    id: 'v3',
    user: mockUsers[2],
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerFun.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=700&fit=crop',
    caption: 'تمرين اليوم - 10 دقائق فقط!',
    music: { name: 'حماس', artist: 'Workout Mix', coverUrl: 'https://images.unsplash.com/photo-1571902943202-507ec2618e8f?w=50&h=50&fit=crop' },
    likes: 67000,
    comments: 1800,
    shares: 12000,
    views: 980000,
    isLiked: false,
    tags: ['فتنس', 'تمارين', 'صحة'],
    createdAt: new Date()
  },
  {
    id: 'v4',
    user: mockUsers[3],
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerJoyrides.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1527224857830-43a7acc85260?w=400&h=700&fit=crop',
    caption: 'مقلب اليوم في صديقي هههه',
    music: { name: 'ضحك', artist: 'Comedy Beats', coverUrl: 'https://images.unsplash.com/photo-1543610892-0b1f7e6d8ac1?w=50&h=50&fit=crop' },
    likes: 234000,
    comments: 8900,
    shares: 45000,
    views: 5600000,
    isLiked: false,
    tags: ['كوميدي', 'مقالب', 'ضحك'],
    createdAt: new Date()
  },
  {
    id: 'v5',
    user: mockUsers[4],
    videoUrl: 'https://storage.googleapis.com/gtv-videos-bucket/sample/ForBiggerMeltdowns.mp4',
    thumbnailUrl: 'https://images.unsplash.com/photo-1504674900247-0877df9cc836?w=400&h=700&fit=crop',
    caption: 'وصفة كيك الشوكولاتة السهلة',
    music: { name: 'طبخ سعيد', artist: 'Kitchen Vibes', coverUrl: 'https://images.unsplash.com/photo-1556909114-f6e7ad7d3136?w=50&h=50&fit=crop' },
    likes: 156000,
    comments: 4200,
    shares: 23000,
    views: 3200000,
    isLiked: true,
    tags: ['طبخ', 'حلويات', 'وصفات'],
    createdAt: new Date()
  }
]

// Mock Stories
export const mockStories: Story[] = mockUsers.map((user, index) => ({
  id: `s${index + 1}`,
  user,
  mediaUrl: `https://images.unsplash.com/photo-${1500000000000 + index * 100000}?w=400&h=700&fit=crop`,
  mediaType: index % 3 === 0 ? 'video' : 'image',
  duration: index % 3 === 0 ? 15 : 5,
  views: Math.floor(Math.random() * 50000) + 10000,
  isViewed: index > 2,
  reactions: [],
  createdAt: new Date(Date.now() - index * 3600000),
  expiresAt: new Date(Date.now() + 86400000)
}))

// Mock Live Streams
export const mockLiveStreams: LiveStream[] = [
  {
    id: 'l1',
    user: mockUsers[0],
    title: 'دردشة مسائية معكم',
    thumbnailUrl: 'https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=400&h=600&fit=crop',
    viewers: 12500,
    likes: 45000,
    gifts: [],
    isLive: true,
    startedAt: new Date(Date.now() - 1800000),
    tags: ['دردشة', 'Q&A']
  },
  {
    id: 'l2',
    user: mockUsers[2],
    title: 'تمرين مباشر - انضموا الآن!',
    thumbnailUrl: 'https://images.unsplash.com/photo-1571019614242-c5c5dee9f50b?w=400&h=600&fit=crop',
    viewers: 8900,
    likes: 23000,
    gifts: [],
    isLive: true,
    startedAt: new Date(Date.now() - 2700000),
    tags: ['فتنس', 'تمارين', 'لايف']
  },
  {
    id: 'l3',
    user: mockUsers[5],
    title: 'جلسة موسيقية حصرية',
    thumbnailUrl: 'https://images.unsplash.com/photo-1493225457124-a3eb161ffa5f?w=400&h=600&fit=crop',
    viewers: 15600,
    likes: 67000,
    gifts: [],
    isLive: true,
    startedAt: new Date(Date.now() - 3600000),
    tags: ['موسيقى', 'حصري', 'لايف']
  }
]

// Mock Chats
export const mockChats: Chat[] = mockUsers.slice(0, 5).map((user, index) => ({
  id: `c${index + 1}`,
  participants: [mockUsers[0], user],
  lastMessage: {
    id: `m${index}`,
    senderId: user.id,
    receiverId: mockUsers[0].id,
    content: index === 0 ? 'شفتي البث الأخير؟' : index === 1 ? 'تمام شكراً!' : 'هههه كان مضحك',
    isRead: index > 1,
    isSelfDestruct: false,
    createdAt: new Date(Date.now() - index * 600000)
  },
  unreadCount: index < 2 ? index + 1 : 0,
  isPinned: index === 0,
  isMuted: false,
  updatedAt: new Date(Date.now() - index * 600000)
}))

// Mock Filters
export const mockFilters: Filter[] = [
  { id: 'f1', name: 'Glow', nameAr: 'توهج', thumbnailUrl: 'https://images.unsplash.com/photo-1596462502278-27bfdc403348?w=100&h=100&fit=crop', category: 'beauty', isNew: true },
  { id: 'f2', name: 'Vintage', nameAr: 'كلاسيكي', thumbnailUrl: 'https://images.unsplash.com/photo-1558618666-fcd25c85cd64?w=100&h=100&fit=crop', category: 'vintage', isTrending: true },
  { id: 'f3', name: 'Neon', nameAr: 'نيون', thumbnailUrl: 'https://images.unsplash.com/photo-1550684848-fac1c5b4e853?w=100&h=100&fit=crop', category: 'color', isNew: true },
  { id: 'f4', name: 'Puppy', nameAr: 'كلب', thumbnailUrl: 'https://images.unsplash.com/photo-1587300003388-59208cc962cb?w=100&h=100&fit=crop', category: 'fun' },
  { id: 'f5', name: 'Crown', nameAr: 'تاج', thumbnailUrl: 'https://images.unsplash.com/photo-1578662996442-48f60103fc96?w=100&h=100&fit=crop', category: 'ar', isTrending: true },
  { id: 'f6', name: 'Smooth', nameAr: 'ناعم', thumbnailUrl: 'https://images.unsplash.com/photo-1512496015851-a90fb38ba796?w=100&h=100&fit=crop', category: 'beauty' },
  { id: 'f7', name: 'Rainbow', nameAr: 'قوس قزح', thumbnailUrl: 'https://images.unsplash.com/photo-1507400492013-162706c8c05e?w=100&h=100&fit=crop', category: 'color' },
  { id: 'f8', name: 'Cat Ears', nameAr: 'أذان قطة', thumbnailUrl: 'https://images.unsplash.com/photo-1514888286974-6c03e2ca1dba?w=100&h=100&fit=crop', category: 'ar' }
]

// Mock Gifts
export const mockGifts: Gift[] = [
  { id: 'g1', name: 'Rose', icon: '🌹', value: 10 },
  { id: 'g2', name: 'Heart', icon: '❤️', value: 50 },
  { id: 'g3', name: 'Star', icon: '⭐', value: 100 },
  { id: 'g4', name: 'Diamond', icon: '💎', value: 500 },
  { id: 'g5', name: 'Crown', icon: '👑', value: 1000 },
  { id: 'g6', name: 'Rocket', icon: '🚀', value: 2000 },
  { id: 'g7', name: 'Fire', icon: '🔥', value: 5000 },
  { id: 'g8', name: 'Universe', icon: '🌌', value: 10000 }
]

// Mock Products
export const mockProducts: Product[] = [
  {
    id: 'p1',
    name: 'Hoodie Collection',
    nameAr: 'هودي كولكشن',
    price: 149,
    currency: 'SAR',
    images: ['https://images.unsplash.com/photo-1556821840-3a63f95609a7?w=400&h=400&fit=crop'],
    description: 'هودي عصري ومريح',
    seller: mockUsers[0],
    rating: 4.8,
    reviews: 234,
    inStock: true,
    category: 'ملابس'
  },
  {
    id: 'p2',
    name: 'Wireless Earbuds',
    nameAr: 'سماعات لاسلكية',
    price: 299,
    currency: 'SAR',
    images: ['https://images.unsplash.com/photo-1590658268037-6bf12165a8df?w=400&h=400&fit=crop'],
    description: 'سماعات بجودة صوت عالية',
    seller: mockUsers[1],
    rating: 4.9,
    reviews: 567,
    inStock: true,
    category: 'إلكترونيات'
  }
]

// Mock Notifications
export const mockNotifications: Notification[] = [
  { id: 'n1', type: 'like', fromUser: mockUsers[1], content: 'أعجب بفيديوك', isRead: false, createdAt: new Date(Date.now() - 300000) },
  { id: 'n2', type: 'follow', fromUser: mockUsers[2], content: 'بدأ بمتابعتك', isRead: false, createdAt: new Date(Date.now() - 600000) },
  { id: 'n3', type: 'comment', fromUser: mockUsers[3], content: 'علق على فيديوك: "رائع جداً!"', isRead: true, createdAt: new Date(Date.now() - 1800000) },
  { id: 'n4', type: 'live', fromUser: mockUsers[0], content: 'بدأ بث مباشر', isRead: true, createdAt: new Date(Date.now() - 3600000) },
  { id: 'n5', type: 'gift', fromUser: mockUsers[4], content: 'أرسل لك هدية 💎', isRead: false, createdAt: new Date(Date.now() - 7200000) }
]

// Helper function to format numbers
export function formatNumber(num: number): string {
  if (num >= 1000000) {
    return (num / 1000000).toFixed(1) + 'M'
  }
  if (num >= 1000) {
    return (num / 1000).toFixed(1) + 'K'
  }
  return num.toString()
}

// Helper function to format time ago
export function timeAgo(date: Date): string {
  const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000)
  
  if (seconds < 60) return 'الآن'
  if (seconds < 3600) return `${Math.floor(seconds / 60)} د`
  if (seconds < 86400) return `${Math.floor(seconds / 3600)} س`
  if (seconds < 604800) return `${Math.floor(seconds / 86400)} ي`
  return `${Math.floor(seconds / 604800)} أ`
}
