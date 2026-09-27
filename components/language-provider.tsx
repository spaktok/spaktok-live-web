'use client'

import { createContext, useContext, useEffect, useMemo, useState } from 'react'

export const supportedLanguages = [
  ['ar', 'العربية'], ['en', 'English'], ['es', 'Español'], ['fr', 'Français'],
  ['de', 'Deutsch'], ['tr', 'Türkçe'], ['pt', 'Português'], ['it', 'Italiano'],
  ['ru', 'Русский'], ['zh', '中文'], ['ja', '日本語'], ['ko', '한국어'],
  ['hi', 'हिन्दी'], ['id', 'Bahasa Indonesia'], ['nl', 'Nederlands'],
] as const

type LanguageCode = (typeof supportedLanguages)[number][0]
const rtlLanguages = new Set<LanguageCode>(['ar'])
const languageNames = Object.fromEntries(supportedLanguages) as Record<LanguageCode, string>

const translations: Record<string, Partial<Record<LanguageCode, string>>> = {
  settings: { ar: 'الإعدادات', en: 'Settings', es: 'Configuración', fr: 'Paramètres', de: 'Einstellungen', tr: 'Ayarlar', pt: 'Definições', it: 'Impostazioni', ru: 'Настройки', zh: '设置', ja: '設定', ko: '설정', hi: 'सेटिंग्स', id: 'Pengaturan', nl: 'Instellingen' },
  language: { ar: 'اللغة', en: 'Language', es: 'Idioma', fr: 'Langue', de: 'Sprache', tr: 'Dil', pt: 'Idioma', it: 'Lingua', ru: 'Язык', zh: '语言', ja: '言語', ko: '언어', hi: 'भाषा', id: 'Bahasa', nl: 'Taal' },
  home: { ar: 'الرئيسية', en: 'Home', es: 'Inicio', fr: 'Accueil', de: 'Startseite', tr: 'Ana sayfa', pt: 'Início', it: 'Home', ru: 'Главная', zh: '首页', ja: 'ホーム', ko: '홈', hi: 'होम', id: 'Beranda', nl: 'Home' },
  discover: { ar: 'استكشاف', en: 'Discover', es: 'Descubrir', fr: 'Découvrir', de: 'Entdecken', tr: 'Keşfet', pt: 'Descobrir', it: 'Scopri', ru: 'Обзор', zh: '发现', ja: '発見', ko: '탐색', hi: 'खोजें', id: 'Jelajah', nl: 'Ontdekken' },
  messages: { ar: 'الرسائل', en: 'Messages', es: 'Mensajes', fr: 'Messages', de: 'Nachrichten', tr: 'Mesajlar', pt: 'Mensagens', it: 'Messaggi', ru: 'Сообщения', zh: '消息', ja: 'メッセージ', ko: '메시지', hi: 'संदेश', id: 'Pesan', nl: 'Berichten' },
  profile: { ar: 'الملف الشخصي', en: 'Profile', es: 'Perfil', fr: 'Profil', de: 'Profil', tr: 'Profil', pt: 'Perfil', it: 'Profilo', ru: 'Профиль', zh: '个人资料', ja: 'プロフィール', ko: '프로필', hi: 'प्रोफ़ाइल', id: 'Profil', nl: 'Profiel' },
}

interface LanguageContextValue {
  language: LanguageCode
  languageName: string
  direction: 'rtl' | 'ltr'
  setLanguage: (language: LanguageCode) => void
  t: (key: string, fallback?: string) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

function detectLanguage(): LanguageCode {
  if (typeof navigator === 'undefined') return 'en'
  const candidates = [...navigator.languages, navigator.language]
  const match = candidates.map((value) => value.toLowerCase().split('-')[0]).find((value): value is LanguageCode => value in languageNames)
  return match || 'en'
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [language, setLanguageState] = useState<LanguageCode>('en')

  useEffect(() => {
    const saved = window.localStorage.getItem('spaktok-language')
    const next = saved && saved in languageNames ? saved as LanguageCode : detectLanguage()
    setLanguageState(next)
  }, [])

  const setLanguage = (next: LanguageCode) => {
    setLanguageState(next)
    window.localStorage.setItem('spaktok-language', next)
  }

  const direction: 'rtl' | 'ltr' = rtlLanguages.has(language) ? 'rtl' : 'ltr'
  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = direction
  }, [direction, language])

  const t = (key: string, fallback = key) => translations[key]?.[language] || fallback
  const value = useMemo(() => ({ language, languageName: languageNames[language], direction, setLanguage, t }), [language, direction])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
}

export type { LanguageCode }
