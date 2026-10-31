import { describe, expect, it } from 'vitest'
import { DEFAULT_LOCALE, directionOf, matchLocale, resolveLocale, isLocale, LOCALES } from './config'
import { loadMessages } from './messages'
import { placeholdersOf } from './format'

describe('locale resolution and translations', () => {
  it('keeps the saved language ahead of the browser header', () => {
    expect(resolveLocale('ar','de-DE,de;q=0.9')).toBe('ar')
    expect(resolveLocale('de','ar-SA,ar;q=0.9')).toBe('de')
  })
  it('honors browser preference weights and fallback', () => {
    expect(matchLocale('es-MX;q=0.6,ar-SA;q=0.9,de;q=0.2')).toBe('ar')
    expect(matchLocale('xx-ZZ,zh-Hans;q=0.5')).toBe('zh')
    expect(resolveLocale('invalid','fr-CA,fr;q=0.9')).toBe('fr')
    expect(resolveLocale(undefined,null)).toBe(DEFAULT_LOCALE)
  })
  it('uses RTL for Arabic only', () => {
    for(const {code} of LOCALES){ expect(isLocale(code)).toBe(true); expect(directionOf(code)).toBe(code==='ar'?'rtl':'ltr') }
  })
  it('keeps keys and placeholders aligned in 15 languages', async () => {
    const en=await loadMessages('en'); const keys=Object.keys(en).sort()
    for(const {code} of LOCALES){
      const messages=await loadMessages(code)
      expect(Object.keys(messages).sort()).toEqual(keys)
      for(const key of keys){
        const k=key as keyof typeof en
        expect(placeholdersOf(messages[k])).toEqual(placeholdersOf(en[k]))
      }
    }
  })
})
