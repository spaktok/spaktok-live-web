import type { Locale } from './config'

export type MessageVars = Record<string, string | number>

export function interpolate(template: string, vars?: MessageVars): string {
  if (!vars) return template
  return template.replace(/\{(\w+)\}/g, (match, name: string) => (name in vars ? String(vars[name]) : match))
}

export function placeholdersOf(template: string): string[] {
  return [...template.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort()
}

const intlTag: Partial<Record<Locale, string>> = { zh: 'zh-CN', pt: 'pt-BR' }
export const toIntlLocale = (locale: Locale) => intlTag[locale] ?? locale

export function formatCompact(locale: Locale, value: number): string {
  return new Intl.NumberFormat(toIntlLocale(locale), { notation: 'compact', maximumFractionDigits: 1 }).format(value)
}

export function formatInteger(locale: Locale, value: number): string {
  return new Intl.NumberFormat(toIntlLocale(locale), { maximumFractionDigits: 0 }).format(value)
}

const UNITS: Array<[Intl.RelativeTimeFormatUnit, number]> = [
  ['year', 31_536_000], ['month', 2_592_000], ['week', 604_800], ['day', 86_400], ['hour', 3_600], ['minute', 60],
]

export function formatRelative(locale: Locale, date: Date, now = Date.now()): string {
  const seconds = Math.round((date.getTime() - now) / 1000)
  if (!Number.isFinite(seconds)) return ''
  const rtf = new Intl.RelativeTimeFormat(toIntlLocale(locale), { numeric: 'auto' })
  for (const [unit, size] of UNITS) {
    if (Math.abs(seconds) >= size) return rtf.format(Math.trunc(seconds / size), unit)
  }
  return rtf.format(0, 'second')
}
