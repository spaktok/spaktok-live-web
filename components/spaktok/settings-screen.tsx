"use client";

import React from "react"

import { useState } from "react";
import { motion } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  User,
  Bell,
  Lock,
  Shield,
  Eye,
  Moon,
  Globe,
  HelpCircle,
  FileText,
  LogOut,
  Trash2,
  CreditCard,
  Gift,
  UserPlus,
  QrCode,
  Smartphone,
  Database,
  Check,
} from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { cn } from "@/lib/utils";
import { createClient } from "@/lib/supabase/client";
import { APP_NAME } from "@/lib/brand";

interface SettingsScreenProps {
  onBack?: () => void;
}

interface SettingItem {
  icon: React.ReactNode;
  label: string;
  description?: string;
  action?: "navigate" | "toggle" | "danger";
  settingKey?: keyof typeof defaultSettings;
  value?: boolean;
  badge?: string;
}

const defaultSettings = {
  notifications: true,
  darkMode: true,
  privateAccount: false,
  twoFactor: true,
  dataSaver: false,
  autoPlay: true,
};

interface SettingSection {
  title: string;
  items: SettingItem[];
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const [settings, setSettings] = useState(defaultSettings);
  const [feedback, setFeedback] = useState<string | null>(null);

  const showFeedback = (message: string) => {
    setFeedback(message);
    window.setTimeout(() => setFeedback(null), 2600);
  };

  const settingSections: SettingSection[] = [
    {
      title: "الحساب",
      items: [
        { icon: <User className="w-5 h-5" />, label: "تعديل الملف الشخصي", action: "navigate" },
        { icon: <Lock className="w-5 h-5" />, label: "تغيير كلمة المرور", action: "navigate" },
        { icon: <CreditCard className="w-5 h-5" />, label: "المحفظة والدفع", action: "navigate", badge: "$125" },
        { icon: <Gift className="w-5 h-5" />, label: "العملات والهدايا", action: "navigate", badge: "2,500" },
        { icon: <QrCode className="w-5 h-5" />, label: "رمز QR الخاص بي", action: "navigate" },
      ],
    },
    {
      title: "الخصوصية والأمان",
      items: [
        { icon: <Eye className="w-5 h-5" />, label: "حساب خاص", description: "فقط المتابعون يرون محتواك", action: "toggle", settingKey: "privateAccount", value: settings.privateAccount },
        { icon: <Shield className="w-5 h-5" />, label: "التحقق بخطوتين", description: "حماية إضافية لحسابك", action: "toggle", settingKey: "twoFactor", value: settings.twoFactor },
        { icon: <UserPlus className="w-5 h-5" />, label: "الحسابات المحظورة", action: "navigate" },
        { icon: <Database className="w-5 h-5" />, label: "تحميل بياناتي", action: "navigate" },
      ],
    },
    {
      title: "الإشعارات",
      items: [
        { icon: <Bell className="w-5 h-5" />, label: "تفعيل الإشعارات", action: "toggle", settingKey: "notifications", value: settings.notifications },
      ],
    },
    {
      title: "المظهر والتفضيلات",
      items: [
        { icon: <Moon className="w-5 h-5" />, label: "الوضع الليلي", action: "toggle", settingKey: "darkMode", value: settings.darkMode },
        { icon: <Globe className="w-5 h-5" />, label: "اللغة", action: "navigate", badge: "العربية" },
        { icon: <Smartphone className="w-5 h-5" />, label: "توفير البيانات", description: "تقليل استهلاك الإنترنت", action: "toggle", settingKey: "dataSaver", value: settings.dataSaver },
      ],
    },
    {
      title: "الدعم والمعلومات",
      items: [
        { icon: <HelpCircle className="w-5 h-5" />, label: "مركز المساعدة", action: "navigate" },
        { icon: <FileText className="w-5 h-5" />, label: "الشروط والأحكام", action: "navigate" },
        { icon: <Shield className="w-5 h-5" />, label: "سياسة الخصوصية", action: "navigate" },
      ],
    },
    {
      title: "إجراءات الحساب",
      items: [
        { icon: <LogOut className="w-5 h-5" />, label: "تسجيل الخروج", action: "danger" },
        { icon: <Trash2 className="w-5 h-5" />, label: "حذف الحساب", action: "danger" },
      ],
    },
  ];

  const toggleSetting = (key: keyof typeof settings) => {
    setSettings((prev) => {
      const nextValue = !prev[key]
      if (key === "darkMode") {
        document.documentElement.classList.toggle("dark", nextValue)
      }
      setFeedback(`${key === "darkMode" ? "الوضع الليلي" : key === "notifications" ? "الإشعارات" : key === "privateAccount" ? "الحساب الخاص" : key === "dataSaver" ? "توفير البيانات" : "التحقق بخطوتين"} ${nextValue ? "مفعّل" : "متوقف"}`)
      return { ...prev, [key]: nextValue }
    })
  };

  return (
    <div className="h-full bg-background flex flex-col">
      {/* Header */}
      <div className="sticky top-0 z-10 backdrop-blur-xl bg-background/80 border-b border-border/50">
        <div className="flex items-center gap-3 p-4">
          {onBack && (
            <Button variant="ghost" size="icon" onClick={onBack} className="rounded-full">
              <ChevronLeft className="w-5 h-5" />
            </Button>
          )}
          <h1 className="text-xl font-bold">الإعدادات</h1>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto pb-20">
        {/* Profile Card */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="m-4 p-4 rounded-2xl bg-gradient-to-br from-primary/20 to-[#3155ff]/20 border border-primary/30"
        >
          <div className="flex items-center gap-4">
            <Avatar className="w-16 h-16 ring-2 ring-primary/50">
              <AvatarImage src="https://images.unsplash.com/photo-1535713875002-d1d0cf377fde?w=200" />
              <AvatarFallback>U</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg">أحمد محمد</h2>
                <div className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>
              </div>
              <p className="text-sm text-muted-foreground">@ahmed_creator</p>
              <div className="flex items-center gap-4 mt-2">
                <div className="text-center">
                  <p className="font-bold text-sm">125K</p>
                  <p className="text-[10px] text-muted-foreground">متابع</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm">890</p>
                  <p className="text-[10px] text-muted-foreground">متابَع</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm">2.5M</p>
                  <p className="text-[10px] text-muted-foreground">إعجاب</p>
                </div>
              </div>
            </div>
          </div>
        </motion.div>

        {/* Settings Sections */}
        {settingSections.map((section, sectionIndex) => (
          <motion.div
            key={section.title}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: sectionIndex * 0.05 }}
            className="mb-6"
          >
            <h3 className="px-4 mb-2 text-sm font-semibold text-muted-foreground">
              {section.title}
            </h3>
            <div className="mx-4 rounded-2xl bg-card border border-border/50 overflow-hidden">
              {section.items.map((item, itemIndex) => (
                <div
                  key={item.label}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(event) => {
                    if (event.key === "Enter" || event.key === " ") {
                      event.preventDefault()
                      event.currentTarget.click()
                    }
                  }}
                  className={cn(
                    "flex items-center gap-3 p-4 hover:bg-muted/30 transition-colors cursor-pointer",
                    itemIndex !== section.items.length - 1 && "border-b border-border/30",
                    item.action === "danger" && "text-blue-500"
                  )}
                  onClick={() => {
                    if (item.action === "toggle" && item.settingKey) {
                      toggleSetting(item.settingKey);
                      return;
                    }
                    if (item.action === "navigate") {
                      showFeedback(`${item.label}: ستتوفر إعداداته التفصيلية هنا قريباً`);
                      return;
                    }
                    if (item.action === "danger") {
                      if (item.label === "تسجيل الخروج") {
                        showFeedback("جارٍ تسجيل الخروج...");
                        void createClient().auth.signOut();
                        return;
                      }
                      showFeedback("يمكنك تأكيد حذف الحساب من هذه الخطوة");
                    }
                  }}
                >
                  <div
                    className={cn(
                      "w-10 h-10 rounded-xl flex items-center justify-center",
                      item.action === "danger"
                        ? "bg-blue-500/10 text-blue-500"
                        : "bg-muted text-muted-foreground"
                    )}
                  >
                    {item.icon}
                  </div>
                  <div className="flex-1">
                    <p className="font-medium text-sm">{item.label}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    )}
                  </div>
                  {item.badge && (
                    <span className="text-sm text-muted-foreground">{item.badge}</span>
                  )}
                  {item.action === "navigate" && (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                  {item.action === "toggle" && (
                    <Switch
                      checked={item.value}
                      onCheckedChange={() => {
                        if (item.settingKey) toggleSetting(item.settingKey);
                      }}
                      onClick={(event) => event.stopPropagation()}
                      className="data-[state=checked]:bg-primary"
                    />
                  )}
                </div>
              ))}
            </div>
          </motion.div>
        ))}

        {feedback && (
          <div
            className="mx-4 mb-4 rounded-2xl border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-foreground"
            role="status"
            aria-live="polite"
          >
            {feedback}
          </div>
        )}

        {/* App Version */}
        <div className="text-center py-6 text-muted-foreground">
          <p className="text-sm">{APP_NAME}</p>
          <p className="text-xs">الإصدار 1.0.0</p>
        </div>
      </div>
    </div>
  );
}
