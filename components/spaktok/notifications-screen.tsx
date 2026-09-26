"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Heart,
  MessageCircle,
  UserPlus,
  AtSign,
  Gift,
  ShoppingBag,
  Play,
  ChevronLeft,
  Settings,
  Check,
  CheckCheck,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { EmptyState } from "@/components/spaktok/feedback-state";

interface Notification {
  id: string;
  type: "like" | "comment" | "follow" | "mention" | "gift" | "purchase" | "live";
  user: {
    username: string;
    avatar: string;
    isVerified: boolean;
  };
  content: string;
  thumbnail?: string;
  time: string;
  isRead: boolean;
}

const mockNotifications: Notification[] = [
  {
    id: "1",
    type: "like",
    user: { username: "sarah_designs", avatar: "https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100", isVerified: true },
    content: "أعجبت بفيديوك",
    thumbnail: "https://images.unsplash.com/photo-1611162616305-c69b3fa7fbe0?w=100",
    time: "منذ 2 دقيقة",
    isRead: false,
  },
  {
    id: "2",
    type: "comment",
    user: { username: "ahmed_tech", avatar: "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100", isVerified: false },
    content: 'علّق: "محتوى رائع! استمر 🔥"',
    thumbnail: "https://images.unsplash.com/photo-1611162618071-b39a2ec055fb?w=100",
    time: "منذ 15 دقيقة",
    isRead: false,
  },
  {
    id: "3",
    type: "follow",
    user: { username: "maya_art", avatar: "https://images.unsplash.com/photo-1534528741775-53994a69daeb?w=100", isVerified: true },
    content: "بدأت بمتابعتك",
    time: "منذ 1 ساعة",
    isRead: false,
  },
  {
    id: "4",
    type: "gift",
    user: { username: "king_viewer", avatar: "https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100", isVerified: false },
    content: "أرسل لك هدية Galaxy 🌟 (500 عملة)",
    time: "منذ 2 ساعة",
    isRead: true,
  },
  {
    id: "5",
    type: "live",
    user: { username: "gaming_pro", avatar: "https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=100", isVerified: true },
    content: "بدأ بثاً مباشراً: جلسة ألعاب",
    time: "منذ 3 ساعات",
    isRead: true,
  },
  {
    id: "6",
    type: "mention",
    user: { username: "fitness_coach", avatar: "https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100", isVerified: true },
    content: 'أشار إليك في تعليق: "@user تمارين رائعة!"',
    time: "منذ 5 ساعات",
    isRead: true,
  },
  {
    id: "7",
    type: "purchase",
    user: { username: "shopper_123", avatar: "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100", isVerified: false },
    content: "اشترى منتجك: قميص SpakTok الحصري",
    time: "منذ يوم",
    isRead: true,
  },
];

const getNotificationIcon = (type: Notification["type"]) => {
  switch (type) {
    case "like":
      return <Heart className="w-4 h-4 text-blue-500 fill-blue-500" />;
    case "comment":
      return <MessageCircle className="w-4 h-4 text-sky-500" />;
    case "follow":
      return <UserPlus className="w-4 h-4 text-emerald-500" />;
    case "mention":
      return <AtSign className="w-4 h-4 text-violet-500" />;
    case "gift":
      return <Gift className="w-4 h-4 text-amber-500" />;
    case "purchase":
      return <ShoppingBag className="w-4 h-4 text-blue-500" />;
    case "live":
      return <Play className="w-4 h-4 text-blue-500 fill-blue-500" />;
  }
};

interface NotificationsScreenProps {
  onBack?: () => void;
}

export function NotificationsScreen({ onBack }: NotificationsScreenProps) {
  const [notifications, setNotifications] = useState(mockNotifications);
  const [filter, setFilter] = useState<"all" | "unread">("all");
  const [followedUsers, setFollowedUsers] = useState<string[]>([]);
  const [feedback, setFeedback] = useState<string | null>(null);

  const filteredNotifications = filter === "unread" 
    ? notifications.filter(n => !n.isRead)
    : notifications;

  const unreadCount = notifications.filter(n => !n.isRead).length;

  const markAllAsRead = () => {
    setNotifications(notifications.map(n => ({ ...n, isRead: true })));
  };

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="flex items-center justify-between p-4">
          <div className="flex items-center gap-3">
            {onBack && (
              <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
                <ChevronLeft className="w-5 h-5" />
              </Button>
            )}
            <div>
              <h1 className="text-xl font-bold">الإشعارات</h1>
              {unreadCount > 0 && (
                <p className="text-xs text-muted-foreground">{unreadCount} غير مقروءة</p>
              )}
            </div>
          </div>
          <div className="flex items-center gap-2">
            {unreadCount > 0 && (
              <Button variant="ghost" size="sm" onClick={markAllAsRead} className="text-xs">
                <CheckCheck className="w-4 h-4 mr-1" />
                قراءة الكل
              </Button>
            )}
            <Button variant="ghost" size="icon" className="rounded-full" onClick={() => setFeedback("يمكنك تخصيص أنواع الإشعارات من الإعدادات") } aria-label="إعدادات الإشعارات">
              <Settings className="w-5 h-5" />
            </Button>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="flex gap-2 px-4 pb-3">
          <Button
            variant={filter === "all" ? "default" : "ghost"}
            size="sm"
            onClick={() => setFilter("all")}
            className={cn(
              "rounded-full text-xs",
              filter === "all" && "bg-primary text-primary-foreground"
            )}
          >
            الكل
          </Button>
          <Button
            variant={filter === "unread" ? "default" : "ghost"}
            size="sm"
            onClick={() => setFilter("unread")}
            className={cn(
              "rounded-full text-xs",
              filter === "unread" && "bg-primary text-primary-foreground"
            )}
          >
            غير مقروءة
            {unreadCount > 0 && (
              <span className="ml-1 px-1.5 py-0.5 bg-blue-500 text-white rounded-full text-[10px]">
                {unreadCount}
              </span>
            )}
          </Button>
        </div>
      </div>

      {feedback && (
        <div className="mx-4 mt-3 rounded-xl border border-primary/30 bg-primary/10 px-3 py-2 text-xs" role="status" aria-live="polite">
          {feedback}
        </div>
      )}

      {/* Notifications list */}
      <div className="flex-1 overflow-y-auto">
        <AnimatePresence>
  {filteredNotifications.length === 0 ? (
  <div className="flex min-h-64 items-center justify-center px-4">
    <EmptyState title={filter === "unread" ? "لا توجد إشعارات غير مقروءة" : "لا توجد إشعارات بعد"} description="ستظهر التحديثات والتفاعلات الجديدة هنا." />
  </div>
  ) : (
            filteredNotifications.map((notification, index) => (
              <motion.div
                key={notification.id}
                initial={{ opacity: 0, x: -20 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: index * 0.05 }}
                onClick={() => {
                  if (!notification.isRead) {
                    setNotifications((current) => current.map((item) =>
                      item.id === notification.id ? { ...item, isRead: true } : item
                    ))
                  }
                }}
                className={cn(
                  "flex items-start gap-3 p-4 border-b border-border/30 hover:bg-muted/30 transition-colors cursor-pointer",
                  !notification.isRead && "bg-primary/5"
                )}
                role="button"
                tabIndex={0}
                aria-label={`${notification.user.username}: ${notification.content}`}
                onKeyDown={(event) => {
                  if (event.key === "Enter" || event.key === " ") {
                    event.preventDefault()
                    if (!notification.isRead) {
                      setNotifications((current) => current.map((item) =>
                        item.id === notification.id ? { ...item, isRead: true } : item
                      ))
                    }
                  }
                }}
              >
                {/* User avatar with notification type icon */}
                <div className="relative">
                  <Avatar className="w-12 h-12 ring-2 ring-border/50">
                    <AvatarImage src={notification.user.avatar || "/placeholder.svg"} />
                    <AvatarFallback>{notification.user.username[0]}</AvatarFallback>
                  </Avatar>
                  <div className="absolute -bottom-1 -right-1 w-6 h-6 rounded-full bg-background border-2 border-background flex items-center justify-center">
                    {getNotificationIcon(notification.type)}
                  </div>
                </div>

                {/* Content */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-1.5">
                    <span className="font-semibold text-sm">{notification.user.username}</span>
                    {notification.user.isVerified && (
                      <div className="w-4 h-4 rounded-full bg-sky-500 flex items-center justify-center">
                        <Check className="w-2.5 h-2.5 text-white" />
                      </div>
                    )}
                  </div>
                  <p className="text-sm text-muted-foreground line-clamp-2 mt-0.5">
                    {notification.content}
                  </p>
                  <p className="text-xs text-muted-foreground/70 mt-1">{notification.time}</p>
                </div>

                {/* Thumbnail or action */}
                {notification.thumbnail && (
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    <img
                      src={notification.thumbnail || "/placeholder.svg"}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  </div>
                )}
                {notification.type === "follow" && (
                  <Button
                    size="sm"
                    onClick={(event) => {
                      event.stopPropagation()
                      setFollowedUsers((current) => current.includes(notification.id) ? current.filter((id) => id !== notification.id) : [...current, notification.id])
                    }}
                    className="rounded-full text-xs h-8 bg-primary hover:bg-primary/90"
                  >
                    {followedUsers.includes(notification.id) ? "متابَع" : "متابعة"}
                  </Button>
                )}
                {notification.type === "live" && (
                  <Button onClick={(event) => { event.stopPropagation(); setFeedback("سيتم فتح البث المباشر عند توفره") }} size="sm" className="rounded-full text-xs h-8 bg-blue-500 hover:bg-blue-600 text-white">
                    مشاهدة
                  </Button>
                )}

                {/* Unread indicator */}
                {!notification.isRead && (
                  <div className="w-2.5 h-2.5 rounded-full bg-primary flex-shrink-0" />
                )}
              </motion.div>
            ))
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
