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

interface LanguageContextValue {
  language: LanguageCode
  languageName: string
  direction: 'rtl' | 'ltr'
  setLanguage: (language: LanguageCode) => void
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

  const value = useMemo(() => ({ language, languageName: languageNames[language], direction, setLanguage }), [language, direction])
  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
}

export type { LanguageCode }
