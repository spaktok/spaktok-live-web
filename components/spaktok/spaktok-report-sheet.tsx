'use client'

import { useState } from 'react'
import { Flag, X } from 'lucide-react'
import type { ReportCategory, ReportTarget } from '@/lib/moderation/spaktok-report-rules'

const CATEGORIES: Array<{ id: ReportCategory; label: string }> = [
  { id: 'illegal_content', label: 'محتوى غير قانوني' },
  { id: 'child_safety', label: 'سلامة الأطفال' },
  { id: 'harassment', label: 'تحرش أو تنمر' },
  { id: 'hate', label: 'خطاب كراهية' },
  { id: 'violence', label: 'عنف أو تهديد' },
  { id: 'self_harm', label: 'إيذاء النفس' },
  { id: 'sexual', label: 'محتوى جنسي' },
  { id: 'scam', label: 'احتيال أو بريد مزعج' },
  { id: 'ip_infringement', label: 'انتهاك حقوق ملكية' },
  { id: 'privacy', label: 'انتهاك الخصوصية' },
  { id: 'other', label: 'سبب آخر' },
]
const NEEDS_TEXT: ReportCategory[] = ['illegal_content', 'ip_infringement', 'other']

const ERRORS: Record<string, string> = {
  unauthorized: 'سجّل الدخول لإرسال بلاغ.',
  already_reported: 'أرسلت بلاغاً عن هذا المحتوى من قبل.',
  self_report: 'لا يمكنك الإبلاغ عن محتواك.',
  target_not_found: 'المحتوى لم يعد موجوداً.',
  rate_limited: 'أرسلت بلاغات كثيرة. حاول لاحقاً.',
  invalid_request: 'أكمل الحقول المطلوبة.',
}

interface Props { targetType: ReportTarget; targetId: string; onClose: () => void }

export function SpaktokReportSheet({ targetType, targetId, onClose }: Props) {
  const [category, setCategory] = useState<ReportCategory | null>(null)
  const [explanation, setExplanation] = useState('')
  const [goodFaith, setGoodFaith] = useState(false)
  const [state, setState] = useState<{ kind: 'idle' | 'sending' | 'done' } | { kind: 'error'; message: string }>({ kind: 'idle' })

  const needsText = category !== null && NEEDS_TEXT.includes(category)
  const ready = category !== null && goodFaith && (!needsText || explanation.trim().length >= 10)

  async function submit() {
    if (!ready || state.kind === 'sending') return
    setState({ kind: 'sending' })
    try {
      const res = await fetch('/api/reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ targetType, targetId, category, explanation, goodFaith }),
      })
      if (res.ok) return setState({ kind: 'done' })
      const data = await res.json().catch(() => ({})) as { error?: string }
      setState({ kind: 'error', message: ERRORS[data.error ?? ''] ?? 'تعذر إرسال البلاغ. حاول لاحقاً.' })
    } catch { setState({ kind: 'error', message: 'تعذر الاتصال. حاول لاحقاً.' }) }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center bg-black/60" dir="rtl" role="dialog" aria-modal="true" aria-labelledby="report-title" onClick={onClose}>
      <div className="flex max-h-[85vh] w-full max-w-md flex-col gap-4 overflow-y-auto rounded-t-3xl bg-[#111] p-5 text-white" onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h2 id="report-title" className="flex items-center gap-2 text-base font-bold"><Flag className="size-4" />الإبلاغ عن المحتوى</h2>
          <button type="button" onClick={onClose} aria-label="إغلاق" className="flex size-9 items-center justify-center rounded-full bg-white/10"><X className="size-4" /></button>
        </div>

        {state.kind === 'done' ? (
          <div className="flex flex-col gap-3">
            <p className="text-sm leading-relaxed">وصل بلاغك. سيراجعه فريق الإشراف ونُعلمك بالقرار وسببه. يمكنك متابعته والطعن في القرار من صفحة «بلاغاتي».</p>
            <button type="button" onClick={onClose} className="rounded-full bg-white py-3 text-sm font-bold text-black">تم</button>
          </div>
        ) : (
          <>
            <fieldset className="flex flex-col gap-2">
              <legend className="mb-2 text-sm text-white/70">ما المشكلة؟</legend>
              <div className="flex flex-wrap gap-2">
                {CATEGORIES.map(c => (
                  <button key={c.id} type="button" aria-pressed={category === c.id} onClick={() => setCategory(c.id)}
                    className={`rounded-full px-3 py-2 text-sm ${category === c.id ? 'bg-white text-black' : 'bg-white/10 text-white'}`}>
                    {c.label}
                  </button>
                ))}
              </div>
            </fieldset>

            <label className="flex flex-col gap-2 text-sm">
              <span className="text-white/70">{needsText ? 'اشرح لماذا تعتبر المحتوى مخالفاً (مطلوب)' : 'تفاصيل إضافية (اختياري)'}</span>
              <textarea value={explanation} onChange={e => setExplanation(e.target.value)} maxLength={1000} rows={3}
                className="rounded-2xl bg-white/10 p-3 text-sm leading-relaxed text-white placeholder:text-white/40" placeholder="مثال: الدقيقة 0:12 تحتوي على..." />
            </label>

            <label className="flex items-start gap-2 text-sm leading-relaxed">
              <input type="checkbox" checked={goodFaith} onChange={e => setGoodFaith(e.target.checked)} className="mt-1 size-4" />
              <span>أؤكد أن المعلومات في هذا البلاغ صحيحة ودقيقة حسب علمي.</span>
            </label>

            {state.kind === 'error' && <p role="alert" className="text-sm text-[#ff8a8a]">{state.message}</p>}

            <button type="button" disabled={!ready || state.kind === 'sending'} onClick={() => void submit()}
              className="rounded-full bg-white py-3 text-sm font-bold text-black disabled:opacity-40">
              {state.kind === 'sending' ? 'جارٍ الإرسال…' : 'إرسال البلاغ'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}
