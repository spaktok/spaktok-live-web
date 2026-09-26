import React from "react"
import type { Metadata, Viewport } from 'next'
import { Noto_Sans } from 'next/font/google'
import './globals.css'
import { APP_LOGO_URL } from '@/lib/brand'

const notoSans = Noto_Sans({
  subsets: ['latin', 'latin-ext'],
  display: 'swap',
  variable: '--font-noto-sans',
})

export const metadata: Metadata = {
  title: 'SpakTail | Die Zukunft sozialer Verbindungen',
  description: 'Die nächste Generation sozialer Medien: Videos, Live-Streams, Chats und mehr.',
  keywords: ['soziale Medien', 'Video', 'Live-Stream', 'Chat', 'Creator', 'Filter'],
  authors: [{ name: 'SpakTail' }],
  creator: 'SpakTail',
  icons: {
    icon: APP_LOGO_URL,
    apple: APP_LOGO_URL,
  },
  openGraph: {
    type: 'website',
    locale: 'de_DE',
    title: 'SpakTail | Die Zukunft sozialer Verbindungen',
    description: 'Die nächste Generation sozialer Medien',
    siteName: 'SpakTail',
  },
    generator: 'v0.app'
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  themeColor: '#0a0a14',
  colorScheme: 'dark',
}

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode
}>) {
  return (
    <html lang="de" dir="ltr" className={`${notoSans.variable} bg-background`}>
      <body className="font-sans antialiased">
        {children}</body>
    </html>
  )
}
