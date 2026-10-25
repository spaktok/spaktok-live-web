'use client'
import { useEffect, useState } from 'react'
import Link from 'next/link'

type Item = { id: string; createdAt: string; state: string; durationSeconds: number | null }
const labels: Record<string, string> = {
  pending_upload: 'بانتظار الرفع',
  processing: 'جارٍ المعالجة',
  ready_for_review: 'جاهز للمراجعة',
  failed: 'فشلت المعالجة',
  status_unavailable: 'تعذر الحصول على الحالة',
}
export default function VideoReviewPage() {
  const [items, setItems] = useState<Item[]>([])
  const [loading, setLoading] = useState(true)
  const [message, setMessage] = useState('')
  const load = async () => {
    setLoading(true)
    try {
      const res = await fetch('/api/admin/video-review', { cache: 'no-store' })
      if (!res.ok) {
        setItems([])
        setMessage(res.status === 401 ? 'سجّل الدخول أولًا.'
          : res.status === 403 ? 'هذه الصفحة مخصصة للمدير فقط.'
            : 'لوحة المراجعة غير مفعلة بعد.')
        return
      }
      const data = await res.json() as { items?: Item[] }
      setItems(Array.isArray(data.items) ? data.items : [])
      setMessage('')
    } catch {
      setMessage('تعذر تحميل قائمة المراجعة.')
    } finally { setLoading(false) }
  }
  useEffect(() => { void load() }, [])

  return (
    <main className="min-h-dvh bg-black px-4 py-8 text-white" dir="rtl">
      <div className="mx-auto max-w-2xl space-y-6">
        <h1 className="text-2xl font-bold">مراجعة الفيديو — SpakTok</h1>
        <p className="text-sm text-white/60">قائمة داخلية للقراءة فقط. اكتمال المعالجة لا يعني النشر.</p>
        <div className="flex items-center gap-4">
          <button type="button" onClick={() => void load()}
            className="rounded-xl bg-white px-4 py-2 font-medium text-black">تحديث</button>
          <Link href="/" className="text-sm underline">العودة للتطبيق</Link>
        </div>
        {loading && <p role="status">جارٍ التحقق من الصلاحيات...</p>}
        {message && <p role="status" className="rounded-xl bg-white/10 px-4 py-3">{message}</p>}
        {!loading && !message && items.length === 0 && <p>لا توجد فيديوهات في قائمة المراجعة.</p>}
        <ul className="space-y-3">
          {items.map((item) => (
            <li key={item.id} className="rounded-xl border border-white/10 bg-white/5 p-4">
              <div className="flex items-center justify-between gap-4">
                <span className="text-sm font-semibold">{labels[item.state] ?? 'حالة غير معروفة'}</span>
                <time className="text-xs text-white/50" dateTime={item.createdAt}>
                  {new Date(item.createdAt).toLocaleDateString('ar')}
                </time>
              </div>
              <div className="mt-2 break-all font-mono text-xs text-white/40">{item.id}</div>
              {item.durationSeconds !== null && <div className="mt-2 text-xs text-white/60">
                المدة: {Math.round(item.durationSeconds)} ثانية
              </div>}
            </li>
          ))}
        </ul>
      </div>
    </main>
  )
}
