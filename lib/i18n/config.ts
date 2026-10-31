export const LOCALES = [
  { code: 'ar', name: 'العربية', dir: 'rtl', og: 'ar_SA' },
  { code: 'en', name: 'English', dir: 'ltr', og: 'en_US' },
  { code: 'es', name: 'Español', dir: 'ltr', og: 'es_ES' },
  { code: 'fr', name: 'Français', dir: 'ltr', og: 'fr_FR' },
  { code: 'de', name: 'Deutsch', dir: 'ltr', og: 'de_DE' },
  { code: 'tr', name: 'Türkçe', dir: 'ltr', og: 'tr_TR' },
  { code: 'pt', name: 'Português', dir: 'ltr', og: 'pt_BR' },
  { code: 'it', name: 'Italiano', dir: 'ltr', og: 'it_IT' },
  { code: 'ru', name: 'Русский', dir: 'ltr', og: 'ru_RU' },
  { code: 'zh', name: '简体中文', dir: 'ltr', og: 'zh_CN' },
  { code: 'ja', name: '日本語', dir: 'ltr', og: 'ja_JP' },
  { code: 'ko', name: '한국어', dir: 'ltr', og: 'ko_KR' },
  { code: 'hi', name: 'हिन्दी', dir: 'ltr', og: 'hi_IN' },
  { code: 'id', name: 'Bahasa Indonesia', dir: 'ltr', og: 'id_ID' },
  { code: 'nl', name: 'Nederlands', dir: 'ltr', og: 'nl_NL' },
] as const

export type Locale = (typeof LOCALES)[number]['code']
export type Direction = 'rtl' | 'ltr'

export const DEFAULT_LOCALE: Locale = 'en'
export const LOCALE_COOKIE = 'spaktok-language'

const byCode = new Map<string, (typeof LOCALES)[number]>(LOCALES.map((l) => [l.code, l]))

export function isLocale(value: unknown): value is Locale {
  return typeof value === 'string' && byCode.has(value)
}

export function directionOf(locale: Locale): Direction {
  return byCode.get(locale)?.dir ?? 'ltr'
}

export function nativeName(locale: Locale): string {
  return byCode.get(locale)?.name ?? locale
}

export function openGraphLocale(locale: Locale): string {
  return byCode.get(locale)?.og ?? 'en_US'
}

/** Picks the best supported locale from an Accept-Language header, honoring q-weights. */
export function matchLocale(acceptLanguage: string | null | undefined): Locale {
  if (!acceptLanguage) return DEFAULT_LOCALE
  const ranked = acceptLanguage
    .split(',')
    .map((part, index) => {
      const [tag, ...params] = part.trim().split(';')
      const q = params.map((p) => p.trim()).find((p) => p.startsWith('q='))
      const weight = q ? Number.parseFloat(q.slice(2)) : 1
      return { base: tag.toLowerCase().split('-')[0], weight: Number.isFinite(weight) ? weight : 0, index }
    })
    .filter((entry) => entry.base && entry.weight > 0)
    .sort((a, b) => b.weight - a.weight || a.index - b.index)
  return ranked.map((entry) => entry.base).find(isLocale) ?? DEFAULT_LOCALE
}

export function resolveLocale(cookieValue: string | undefined, acceptLanguage: string | null): Locale {
  return isLocale(cookieValue) ? cookieValue : matchLocale(acceptLanguage)
}
