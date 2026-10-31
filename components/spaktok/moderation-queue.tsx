'use client'
import { useState } from 'react'
import useSWR from 'swr'
import { REASON_MIN, type DecisionAction, type DecisionGround } from '@/lib/moderation/spaktok-report-rules'

type Item = {
  id: string; targetType: string; targetId: string; category: string; explanation: string
  status: string; createdAtMs: number; decisionReason: string | null; appealStatus: string; appealText: string | null
}

const CATEGORY: Record<string, string> = {
  illegal_content: 'محتوى غير قانوني', child_safety: 'سلامة الأطفال', harassment: 'تحرش أو تنمر',
  hate: 'خطاب كراهية', violence: 'عنف أو تهديد', self_harm: 'إيذاء النفس', sexual: 'محتوى جنسي',
  scam: 'احتيال أو بريد مزعج', ip_infringement: 'انتهاك حقوق ملكية', privacy: 'انتهاك الخصوصية', other: 'أخرى',
}
const TARGET: Record<string, string> = { video: 'فيديو', comment: 'تعليق', user: 'مستخدم', live: 'بث مباشر' }
const ACTIONS: Array<{ action: DecisionAction; ground: DecisionGround; label: string }> = [
  { action: 'remove', ground: 'illegal', label: 'حذف — غير قانوني' },
  { action: 'remove', ground: 'terms', label: 'حذف — مخالف للشروط' },
  { action: 'restrict', ground: 'terms', label: 'تقييد — مخالف للشروط' },
  { action: 'none', ground: 'none', label: 'رفض البلاغ' },
]

class HttpError extends Error { constructor(public status: number) { super(String(status)) } }
const fetcher = async (url: string) => {
  const res = await fetch(url, { cache: 'no-store' })
  if (!res.ok) throw new HttpError(res.status)
  return (await res.json()) as { items: Item[] }
}
const accessMessage = (e: unknown) => {
  const s = e instanceof HttpError ? e.status : 0
  return s === 401 ? 'سجّل الدخول أولًا.' : s === 403 ? 'هذه الصفحة مخصصة للمشرف فقط.'
    : s === 503 ? 'الإشراف غير مفعّل بعد على الخادم.' : 'تعذر تحميل البلاغات.'
}

export function ModerationQueue() {
  const { data, error, isLoading, mutate } = useSWR('/api/admin/reports', fetcher, { refreshInterval: 30_000 })
  const items = data?.items ?? []
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-4">
        <button type="button" onClick={() => void mutate()}
          className="rounded-xl bg-white px-4 py-2 font-medium text-black">تحديث</button>
        <span className="text-sm text-white/60" aria-live="polite">{data ? `${items.length} بانتظار القرار` : ''}</span>
      </div>
      {isLoading && <p role="status">جارٍ التحقق من الصلاحيات...</p>}
      {error && <p role="status" className="rounded-xl bg-white/10 px-4 py-3">{accessMessage(error)}</p>}
      {data && items.length === 0 && <p>لا توجد بلاغات مفتوحة أو اعتراضات معلّقة.</p>}
      <ul className="flex flex-col gap-3">
        {items.map(item => <ReportCard key={item.id} item={item} onDone={() => void mutate()} />)}
      </ul>
    </div>
  )
}

function ReportCard({ item, onDone }: { item: Item; onDone: () => void }) {
  const isAppeal = item.appealStatus === 'pending'
  const [reason, setReason] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const tooShort = reason.trim().length < REASON_MIN

  const submit = async (payload: Record<string, string>) => {
    setBusy(true); setError('')
    try {
      const res = await fetch('/api/admin/reports', {
        method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ...payload, reportId: item.id, reason: reason.trim() }),
      })
      if (!res.ok) { setError(res.status === 409 ? 'تغيّرت حالة البلاغ، حدّث القائمة.' : 'تعذر حفظ القرار.'); return }
      onDone()
    } catch { setError('تعذر حفظ القرار.') } finally { setBusy(false) }
  }

  const urgent = item.category === 'child_safety' || item.category === 'illegal_content'
  return (
    <li className={`flex flex-col gap-3 rounded-xl border bg-white/5 p-4 ${urgent ? 'border-red-500/60' : 'border-white/10'}`}>
      <div className="flex items-center justify-between gap-4">
        <span className="text-sm font-semibold">
          {isAppeal ? 'اعتراض على قرار' : 'بلاغ جديد'} · {CATEGORY[item.category] ?? item.category}
        </span>
        <time className="text-xs text-white/50" dateTime={new Date(item.createdAtMs).toISOString()}>
          {new Date(item.createdAtMs).toLocaleDateString('ar')}
        </time>
      </div>
      <div className="text-xs text-white/60">
        {TARGET[item.targetType] ?? item.targetType}: <span className="break-all font-mono">{item.targetId}</span>
      </div>
      {item.explanation && <p className="text-sm leading-relaxed text-pretty">{item.explanation}</p>}
      {isAppeal && (
        <div className="flex flex-col gap-1 rounded-lg bg-white/5 p-3 text-sm leading-relaxed">
          <span className="text-xs text-white/50">القرار السابق</span>
          <p>{item.decisionReason}</p>
          <span className="text-xs text-white/50">نص الاعتراض</span>
          <p>{item.appealText}</p>
        </div>
      )}
      <label className="flex flex-col gap-1 text-xs text-white/60">
        بيان الأسباب (يُرسل لصاحب المحتوى، {REASON_MIN} حرفًا على الأقل)
        <textarea value={reason} onChange={e => setReason(e.target.value)} rows={3} maxLength={2000}
          className="rounded-lg border border-white/10 bg-black p-2 text-sm text-white" />
      </label>
      <div className="flex flex-wrap gap-2">
        {isAppeal ? (
          <>
            <DecisionButton disabled={busy || tooShort} onClick={() => void submit({ kind: 'appeal', outcome: 'upheld' })}>
              تأكيد القرار
            </DecisionButton>
            <DecisionButton disabled={busy || tooShort} onClick={() => void submit({ kind: 'appeal', outcome: 'reversed' })}>
              إلغاء القرار
            </DecisionButton>
          </>
        ) : ACTIONS.map(a => (
          <DecisionButton key={a.label} disabled={busy || tooShort}
            onClick={() => void submit({ kind: 'decision', action: a.action, ground: a.ground })}>
            {a.label}
          </DecisionButton>
        ))}
      </div>
      {error && <p role="alert" className="text-sm text-red-400">{error}</p>}
    </li>
  )
}

function DecisionButton(props: { disabled: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button type="button" disabled={props.disabled} onClick={props.onClick}
      className="rounded-lg border border-white/20 px-3 py-1.5 text-sm disabled:opacity-40">
      {props.children}
    </button>
  )
}
