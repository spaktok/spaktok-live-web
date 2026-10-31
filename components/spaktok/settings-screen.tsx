"use client";

import React from "react"

import { useEffect, useState } from "react";
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

import { APP_NAME } from "@/lib/brand";
import {
 DEFAULT_DEVICE_PREFERENCES,SPAKTOK_PREFERENCES_KEY,
 SPAKTOK_PREFERENCES_EVENT,parseDevicePreferences,
} from '@/lib/video/user-playback-preferences'
import { useAuth } from "@/hooks/use-auth";
import { supportedLanguages, useLanguage, type LanguageCode } from '@/components/language-provider'

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
 ...DEFAULT_DEVICE_PREFERENCES,
 privateAccount:false,
 twoFactor:false,
};

interface SettingSection {
  title: string;
  items: SettingItem[];
}

export function SettingsScreen({ onBack }: SettingsScreenProps) {
  const { user: authUser, signOut } = useAuth()
  const { language, languageName, setLanguage, t } = useLanguage()
  const languageLabel = t('settings.language')
  const [settings, setSettings] = useState(defaultSettings);
  const [exporting,setExporting]=useState(false)
  useEffect(()=>{
    const stored=parseDevicePreferences(window.localStorage.getItem(SPAKTOK_PREFERENCES_KEY))
    setSettings(prev=>({...prev,...stored}))
  },[])
  const [account, setAccount] = useState<{ displayName: string; username: string; avatarUrl: string; followers: number; following: number; likes: number; isVerified: boolean } | null>(null)

  useEffect(() => {
    if (!authUser) return
    const loadAccount = async () => {
      const response = await fetch(`/api/native/profile?id=${encodeURIComponent(authUser.id)}`, { cache: 'no-store' })
      if (!response.ok) return
      const data = await response.json() as { profile?: { displayName:string;username:string;avatar:string;followers:number;following:number;likes:number;isVerified:boolean } }
      const p=data.profile
      if (p) setAccount({ displayName:p.displayName,username:p.username,avatarUrl:p.avatar,followers:p.followers,following:p.following,likes:p.likes,isVerified:p.isVerified })
    }
    void loadAccount()
  }, [authUser])
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
        { icon: <CreditCard className="w-5 h-5" />, label: "المحفظة والدفع", action: "navigate" },
        { icon: <Gift className="w-5 h-5" />, label: "العملات والهدايا", action: "navigate" },
        { icon: <QrCode className="w-5 h-5" />, label: "رمز QR الخاص بي", action: "navigate" },
      ],
    },
    {
      title: "الخصوصية والأمان",
      items: [
        { icon: <Eye className="w-5 h-5" />, label: "حساب خاص", description: "لم يُفعّل على الخادم بعد", action: "toggle", settingKey: "privateAccount", value: settings.privateAccount },
        { icon: <Shield className="w-5 h-5" />, label: "التحقق بخطوتين", description: "قيد التطوير — غير مفعّل حاليًا", action: "toggle", settingKey: "twoFactor", value: settings.twoFactor },
        { icon: <UserPlus className="w-5 h-5" />, label: "الحسابات المحظورة", action: "navigate" },
        { icon: <Database className="w-5 h-5" />, label: "تحميل بياناتي", description:"تنزيل نسخة جزئية من معلومات الحساب في ملف JSON", action: "navigate" },
      ],
    },
    {
      title: "الإشعارات",
      items: [
        { icon: <Bell className="w-5 h-5" />, label: "تفعيل الإشعارات", description:"تفضيل محلي لهذا الجهاز، وليس إذن إشعارات النظام", action: "toggle", settingKey: "notifications", value: settings.notifications },
      ],
    },
    {
      title: "المظهر والتفضيلات",
      items: [
        { icon: <Moon className="w-5 h-5" />, label: "الوضع الليلي", action: "toggle", settingKey: "darkMode", value: settings.darkMode },
        { icon: <Globe className="w-5 h-5" />, label: t('settings.language'), action: "navigate", badge: languageName },
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

  const downloadMyData = async()=>{
    if(exporting)return
    setExporting(true)
    try{
      const response=await fetch('/api/account/export',{
        method:'GET',credentials:'same-origin',cache:'no-store',
      })
      if(!response.ok)throw Error('export_unavailable')
      const file=await response.blob()
      if(file.size>12*1024*1024)throw Error('export_too_large')
      const url=URL.createObjectURL(file)
      try{
        const a=document.createElement('a')
        a.href=url;a.download='spaktok-account-export.json'
        document.body.appendChild(a);a.click();a.remove()
      }finally{window.setTimeout(()=>URL.revokeObjectURL(url),1000)}
      showFeedback('تم تجهيز ملف الحساب. النسخة جزئية؛ يمكن طلب نسخة أشمل من المسؤول عن المنصة.')
    }catch{showFeedback('تعذر تجهيز ملف بياناتك حاليًا. حاول مجددًا.')}
    finally{setExporting(false)}
  }

  const toggleSetting = (key: keyof typeof settings) => {
    if (key === 'privateAccount' || key === 'twoFactor') {
      showFeedback('هذا الخيار لا يمكن تفعيله بعد؛ لم يتم ربط الحماية مع الخادم.')
      return
    }
    setSettings((prev) => {
      const nextValue = !prev[key]
      const next={...prev,[key]:nextValue}
      try{
        window.localStorage.setItem(SPAKTOK_PREFERENCES_KEY,JSON.stringify({
          notifications:next.notifications,darkMode:next.darkMode,
          dataSaver:next.dataSaver,autoPlay:next.autoPlay,
        }))
        window.dispatchEvent(new Event(SPAKTOK_PREFERENCES_EVENT))
      }catch{/* UI state still works in private mode. */}
      if(key==='darkMode')document.documentElement.classList.toggle('dark',nextValue)
      setFeedback(`${key==='darkMode'?'الوضع الليلي':key==='notifications'?'تفضيل الإشعارات':key==='dataSaver'?'توفير بيانات الفيديو':'الإعداد'} ${nextValue?'مفعّل':'متوقف'}`)
      return next
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
              <h1 className="text-xl font-bold">{t('settings.title')}</h1>
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
              <AvatarImage src={account?.avatarUrl || undefined} />
              <AvatarFallback>{(account?.displayName || authUser?.email || 'م').slice(0, 1)}</AvatarFallback>
            </Avatar>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <h2 className="font-bold text-lg">{account?.displayName || 'حسابي'}</h2>
                {account?.isVerified && <div className="w-5 h-5 rounded-full bg-sky-500 flex items-center justify-center">
                  <Check className="w-3 h-3 text-white" />
                </div>}
              </div>
              <p className="text-sm text-muted-foreground">@{account?.username || '...'}</p>
              <div className="flex items-center gap-4 mt-2">
                <div className="text-center">
                  <p className="font-bold text-sm">{account ? `${Math.round(account.followers / 1000)}K` : '—'}</p>
                  <p className="text-[10px] text-muted-foreground">متابع</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm">{account ? account.following.toLocaleString('ar') : '—'}</p>
                  <p className="text-[10px] text-muted-foreground">متابَع</p>
                </div>
                <div className="text-center">
                  <p className="font-bold text-sm">{account ? account.likes.toLocaleString('ar') : '—'}</p>
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
          if(item.label===languageLabel)return
          if(item.label==='تحميل بياناتي'){void downloadMyData();return}
          showFeedback(`${item.label}: غير مفعّل على الخادم بعد`);
          return;
        }
                    if (item.action === "danger") {
                      if (item.label === "تسجيل الخروج") {
                        showFeedback("جارٍ تسجيل الخروج...");
                        void signOut().catch(() => showFeedback('تعذر تسجيل الخروج. حاول مرة أخرى.'));
                        return;
                      }
                      showFeedback('حذف الحساب يتطلب آلية تحقق وحذف بيانات؛ غير متاح بعد.');
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
                    <p className="font-medium text-sm">{item.label}{item.label==='تحميل بياناتي'&&exporting?' — جارٍ التجهيز…':''}</p>
                    {item.description && (
                      <p className="text-xs text-muted-foreground">{item.description}</p>
                    )}
                  </div>
          {item.label === languageLabel ? (
            <select
              aria-label="اختيار اللغة"
              value={language}
              onChange={(event) => setLanguage(event.target.value as LanguageCode)}
              onClick={(event) => event.stopPropagation()}
              className="max-w-32 rounded-lg border border-border bg-background px-2 py-1 text-xs text-foreground"
            >
              {supportedLanguages.map(([code, name]) => <option key={code} value={code}>{name}</option>)}
            </select>
          ) : item.badge ? (
            <span className="text-sm text-muted-foreground">{item.badge}</span>
          ) : null}
          {item.action === "navigate" && item.label !== 'اللغة' && (
                    <ChevronRight className="w-5 h-5 text-muted-foreground" />
                  )}
                  {item.action === "toggle" && (
                    <Switch
                      checked={item.value}
                      disabled={item.settingKey === 'privateAccount' || item.settingKey === 'twoFactor'}
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
