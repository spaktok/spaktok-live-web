import type { Locale } from '../config'
import type { Messages } from './en'

const loaders: Record<Locale, () => Promise<Messages>> = {
  ar: () => import('./ar').then((m) => m.ar),
  en: () => import('./en').then((m) => m.en),
  es: () => import('./es').then((m) => m.es),
  fr: () => import('./fr').then((m) => m.fr),
  de: () => import('./de').then((m) => m.de),
  tr: () => import('./tr').then((m) => m.tr),
  pt: () => import('./pt').then((m) => m.pt),
  it: () => import('./it').then((m) => m.it),
  ru: () => import('./ru').then((m) => m.ru),
  zh: () => import('./zh').then((m) => m.zh),
  ja: () => import('./ja').then((m) => m.ja),
  ko: () => import('./ko').then((m) => m.ko),
  hi: () => import('./hi').then((m) => m.hi),
  id: () => import('./id').then((m) => m.id),
  nl: () => import('./nl').then((m) => m.nl),
}

export function loadMessages(locale: Locale): Promise<Messages> {
  return loaders[locale]()
}

export type { Messages, MessageKey } from './en'
