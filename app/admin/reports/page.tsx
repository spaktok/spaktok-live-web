import Link from 'next/link'
import type { Metadata } from 'next'
import { ModerationQueue } from '@/components/spaktok/moderation-queue'

export const metadata: Metadata = { title: 'مراجعة البلاغات — SpakTok', robots: { index: false, follow: false } }

export default function ReportsReviewPage() {
  return (
    <main className="min-h-dvh bg-black px-4 py-8 text-white" dir="rtl">
      <div className="mx-auto flex max-w-2xl flex-col gap-6">
        <div className="flex flex-col gap-2">
          <h1 className="text-2xl font-bold">مراجعة البلاغات — SpakTok</h1>
          <p className="text-sm leading-relaxed text-white/60">
            بلاغات سلامة الأطفال والمحتوى غير القانوني تظهر أولًا. كل قرار يُسجَّل مع بيان أسبابه ويمكن الاعتراض عليه.
          </p>
        </div>
        <Link href="/" className="text-sm underline">العودة للتطبيق</Link>
        <ModerationQueue />
      </div>
    </main>
  )
}
