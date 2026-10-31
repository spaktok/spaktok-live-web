'use client'

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { LOCALES, LOCALE_COOKIE, directionOf, nativeName, type Direction, type Locale } from '@/lib/i18n/config'
import { formatCompact, formatInteger, formatRelative, interpolate, type MessageVars } from '@/lib/i18n/format'
import { loadMessages, type MessageKey, type Messages } from '@/lib/i18n/messages'

export const supportedLanguages = LOCALES.map((l) => [l.code, l.name] as const)

interface LanguageContextValue {
  language: Locale
  languageName: string
  direction: Direction
  setLanguage: (language: Locale) => Promise<void>
  t: (key: MessageKey, vars?: MessageVars) => string
  compact: (value: number) => string
  integer: (value: number) => string
  relative: (date: Date | string) => string
}

const LanguageContext = createContext<LanguageContextValue | null>(null)

export function LanguageProvider({ initialLanguage, initialMessages, children }: {
  initialLanguage: Locale
  initialMessages: Messages
  children: React.ReactNode
}) {
  const router = useRouter()
  const [state, setState] = useState({ language: initialLanguage, messages: initialMessages })
  const { language, messages } = state
  const direction = directionOf(language)

  useEffect(() => {
    document.documentElement.lang = language
    document.documentElement.dir = direction
  }, [direction, language])

  const setLanguage = useCallback(async (next: Locale) => {
    const nextMessages = await loadMessages(next)
    document.cookie = `${LOCALE_COOKIE}=${next}; path=/; max-age=31536000; samesite=lax`
    setState({ language: next, messages: nextMessages })
    router.refresh()
  }, [router])

  const value = useMemo<LanguageContextValue>(() => ({
    language,
    languageName: nativeName(language),
    direction,
    setLanguage,
    t: (key, vars) => interpolate(messages[key] ?? key, vars),
    compact: (n) => formatCompact(language, n),
    integer: (n) => formatInteger(language, n),
    relative: (date) => formatRelative(language, typeof date === 'string' ? new Date(date) : date),
  }), [language, direction, messages, setLanguage])

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>
}

export function useLanguage() {
  const context = useContext(LanguageContext)
  if (!context) throw new Error('useLanguage must be used within LanguageProvider')
  return context
}

export type { Locale as LanguageCode }
