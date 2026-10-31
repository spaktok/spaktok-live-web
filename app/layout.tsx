import React from "react"
import type { Metadata, Viewport } from 'next'
import { Cairo } from 'next/font/google'
import './globals.css'
import { APP_LOGO_URL } from '@/lib/brand'
import { LanguageProvider } from '@/components/language-provider'
import { cookies, headers } from 'next/headers'
import { LOCALE_COOKIE, directionOf, resolveLocale } from '@/lib/i18n/config'
import { loadMessages } from '@/lib/i18n/messages'

const cairo = Cairo({
  subsets: ['arabic', 'latin', 'latin-ext'],
  weight: 'variable',
  display: 'swap',
  variable: '--font-cairo',
})

export const metadata: Metadata = {
  title: 'SpakTok | مقاطع قصيرة ومجتمعك في مكان واحد',
  description: 'اكتشف مقاطع جديدة، تواصل مع صناع المحتوى، وشارك لحظاتك على SpakTok.',
  keywords: ['SpakTok', 'مقاطع قصيرة', 'فيديو', 'بث مباشر', 'مبدعون'],
  authors: [{ name: 'SpakTok' }],
  creator: 'SpakTok',
  icons: {
    icon: APP_LOGO_URL,
    apple: APP_LOGO_URL,
  },
  openGraph: {
    type: 'website',
    locale: 'ar_SA',
    title: 'SpakTok | مقاطع قصيرة ومجتمعك في مكان واحد',
    description: 'اكتشف مقاطع جديدة وتواصل مع مجتمع SpakTok.',
    siteName: 'SpakTok',
  },
    generator: 'v0.app'
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  themeColor: '#0a0a14',
  colorScheme: 'dark',
}

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  const [cookieStore, requestHeaders] = await Promise.all([cookies(), headers()])
  const locale = resolveLocale(cookieStore.get(LOCALE_COOKIE)?.value, requestHeaders.get('accept-language'))
  const messages = await loadMessages(locale)
  return (
    <html lang={locale} dir={directionOf(locale)} className={`${cairo.variable} bg-background`}>
      <body className="font-sans antialiased" style={{ fontFamily: 'var(--font-cairo), system-ui, sans-serif' }}>
        <LanguageProvider initialLanguage={locale} initialMessages={messages}>{children}</LanguageProvider>
      </body>
    </html>
  )
}
