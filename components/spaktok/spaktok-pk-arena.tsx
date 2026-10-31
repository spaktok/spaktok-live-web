'use client'
import { useEffect, useState } from 'react'
import useSWR from 'swr'
import { Check, Loader2, Medal, Swords, Timer, Trophy, X } from 'lucide-react'
import { cn } from '@/lib/utils'

type Brief = {
  id: string; phase: string; rounds: number; roundSeconds: number; role: string
  host: { username: string; displayName: string }; guest: { username: string; displayName: string }
}
type List = { serverNowMs: number; live: Brief[]; mine: Brief[]; signedIn: boolean }
type Side = 'host' | 'guest'
type State = {
  id: string; serverNowMs: number; rounds: number; roundSeconds: number; role: string
  host: { username: string; displayName: string }; guest: { username: string; displayName: string }
  clock: { phase: string; round: number | null; remainingMs: number }
  result: { rounds: Array<{ round: number; host: number; guest: number; winner: Side | 'draw' }>; hostRoundWins: number; guestRoundWins: number; hostVotes: number; guestVotes: number; winner: Side | 'draw' | null }
  myVote: Side | null
}

const fetcher = async (url: string) => {
  const r = await fetch(url, { cache: 'no-store' })
  if (!r.ok) throw Error('pk_unavailable')
  return { ...(await r.json()), receivedAt: Date.now() }
}

const ERRORS: Record<string, string> = {
  unauthorized: 'سجّل الدخول أولاً.',
  guest_not_found: 'لا يوجد مستخدم بهذا الاسم.',
  cannot_battle_self: 'لا يمكنك تحدي نفسك.',
  host_busy: 'لديك جولة أو دعوة مفتوحة بالفعل.',
  guest_busy: 'هذا المبدع في جولة أخرى الآن.',
  rate_limited: 'محاولات كثيرة، انتظر قليلاً.',
  invite_unavailable: 'انتهت صلاحية الدعوة.',
  already_voted: 'صوّتت في هذه الجولة بالفعل.',
  battle_not_live: 'التصويت مغلق حاليًا.',
  participant_cannot_vote: 'المتنافسون لا يصوّتون.',
  invalid_request: 'تحقق من البيانات المدخلة.',
}

async function post(url: string, body: unknown): Promise<string | null> {
  try {
    const r = await fetch(url, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) })
    if (r.ok) return null
    const data = await r.json().catch(() => ({}))
    return ERRORS[data.error] ?? 'تعذّر تنفيذ الطلب.'
  } catch { return 'تعذّر الاتصال بالخادم.' }
}

const PHASE: Record<string, string> = {
  invited: 'بانتظار القبول', expired: 'انتهت الدعوة', declined: 'مرفوضة', cancelled: 'أُلغيت',
  countdown: 'تبدأ خلال', round: 'جولة', finished: 'انتهت',
}

function useTick(active: boolean) {
  const [, set] = useState(0)
  useEffect(() => {
    if (!active) return
    const t = setInterval(() => set(n => n + 1), 250)
    return () => clearInterval(t)
  }, [active])
}

const fmt = (ms: number) => {
  const s = Math.max(0, Math.ceil(ms / 1000))
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`
}

function BattleView({ id, onClose }: { id: string; onClose: () => void }) {
  const { data, error, mutate } = useSWR<State & { receivedAt: number }>(`/api/live/pk/${id}`, fetcher, { refreshInterval: 2000 })
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)
  const timed = data?.clock.phase === 'round' || data?.clock.phase === 'countdown' || data?.clock.phase === 'invited'
  useTick(Boolean(timed))
  if (error) return <div role="alert" className="rounded-2xl border border-rose-300/30 p-5 text-sm">تعذّر تحميل الجولة.</div>
  if (!data) return <div role="status" className="h-64 animate-pulse rounded-[28px] bg-white/10" aria-label="جارٍ التحميل" />
  const remaining = data.clock.remainingMs - (Date.now() - data.receivedAt)
  const { result } = data
  const live = result.rounds.find(r => r.round === data.clock.round)
  const hostNow = live?.host ?? 0, guestNow = live?.guest ?? 0
  const share = hostNow + guestNow === 0 ? 50 : Math.round((hostNow / (hostNow + guestNow)) * 100)
  const act = async (body: unknown) => {
    setBusy(true); setMsg(null)
    const err = await post(`/api/live/pk/${id}`, body)
    if (err) setMsg(err)
    await mutate(); setBusy(false)
  }
  const canVote = data.clock.phase === 'round' && data.role === 'viewer' && !data.myVote
  const participant = data.role === 'host' || data.role === 'guest'
  const endable = participant && ['invited', 'countdown', 'round'].includes(data.clock.phase)
  return <article className="rounded-[28px] border border-[#7b91ee]/25 bg-[#0b1021] p-5" aria-live="polite">
    <div className="flex items-center justify-between">
      <span className="flex items-center gap-2 text-xs font-bold tracking-wider text-[#afc1ff]">
        <Timer className="size-4" />{PHASE[data.clock.phase] ?? data.clock.phase}
        {data.clock.round ? ` ${data.clock.round} / ${data.rounds}` : ''}
      </span>
      <button type="button" onClick={onClose} className="rounded-lg border border-white/15 p-1.5" aria-label="إغلاق الجولة"><X className="size-4" /></button>
    </div>
    {timed && <p className="mt-4 text-center font-mono text-5xl font-black tabular-nums">{fmt(remaining)}</p>}
    <div className="mt-5 grid grid-cols-2 gap-2">
      {(['host', 'guest'] as const).map(side => {
        const p = data[side]
        const wins = side === 'host' ? result.hostRoundWins : result.guestRoundWins
        const won = result.winner === side
        return <div key={side} className={cn('rounded-2xl border p-4 text-center', won ? 'border-[#a8baff] bg-[#5275f7]/25' : 'border-white/10 bg-white/[.04]')}>
          {won && <Trophy className="mx-auto mb-1 size-5 text-[#c9d6ff]" aria-label="الفائز" />}
          <p className="truncate font-black">{p.displayName}</p>
          <p className="truncate text-[11px] text-slate-400">@{p.username}</p>
          <p className="mt-2 text-xs text-slate-300">{wins} جولات</p>
          {canVote && <button type="button" disabled={busy} onClick={() => act({ action: 'vote', side })}
            className="mt-3 w-full rounded-xl bg-[#a8baff] py-2 text-sm font-black text-[#07112b] disabled:opacity-50">صوّت</button>}
          {data.myVote === side && <p className="mt-3 flex items-center justify-center gap-1 text-xs text-[#c9d6ff]"><Check className="size-3.5" />صوتك</p>}
        </div>
      })}
    </div>
    {data.clock.phase === 'round' && <div className="mt-4" aria-label={`أصوات الجولة: ${hostNow} مقابل ${guestNow}`}>
      <div className="flex h-3 overflow-hidden rounded-full bg-white/10">
        <div className="bg-[#a8baff] transition-all" style={{ width: `${share}%` }} />
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-slate-400"><span>{hostNow}</span><span>{guestNow}</span></div>
    </div>}
    {result.rounds.length > 0 && <ol className="mt-4 flex flex-wrap justify-center gap-2">
      {result.rounds.map(r => <li key={r.round} className={cn('rounded-full border px-3 py-1 text-[11px]',
        r.round === data.clock.round ? 'border-[#a8baff]/60' : 'border-white/10')}>
        {r.round}: {r.host}–{r.guest}
      </li>)}
    </ol>}
    {data.clock.phase === 'invited' && data.role === 'guest' && <div className="mt-5 grid grid-cols-2 gap-2">
      <button type="button" disabled={busy} onClick={() => act({ action: 'accept' })} className="rounded-xl bg-[#a8baff] py-3 font-black text-[#07112b]">قبول التحدي</button>
      <button type="button" disabled={busy} onClick={() => act({ action: 'decline' })} className="rounded-xl border border-white/20 py-3">رفض</button>
    </div>}
    {endable && !(data.clock.phase === 'invited' && data.role === 'guest') ?
      <button type="button" disabled={busy} onClick={() => act({ action: 'cancel' })} className="mt-4 w-full rounded-xl border border-rose-300/30 py-2 text-xs text-rose-100">إنهاء الجولة بلا فائز</button> : null}
    {data.role === 'anonymous' && data.clock.phase === 'round' && <p className="mt-4 text-center text-xs text-slate-400">سجّل الدخول للتصويت.</p>}
    {msg && <p role="alert" className="mt-3 text-center text-xs text-rose-200">{msg}</p>}
    <p className="mt-4 text-[11px] leading-5 text-slate-500">الساعة والنقاط يحسبها الخادم. صوت مجاني واحد لكل مشاهد في كل جولة. لا هدايا ولا عملات.</p>
  </article>
}

export function SpaktokPkArena() {
  const { data, error, mutate } = useSWR<List & { receivedAt: number }>('/api/live/pk', fetcher, { refreshInterval: 5000 })
  const [openId, setOpenId] = useState<string | null>(null)
  const [username, setUsername] = useState('')
  const [rounds, setRounds] = useState<3 | 5>(3)
  const [roundSeconds, setRoundSeconds] = useState<60 | 120 | 180>(60)
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState<string | null>(null)

  if (openId) return <BattleView id={openId} onClose={() => { setOpenId(null); mutate() }} />

  const create = async (e: React.FormEvent) => {
    e.preventDefault()
    setBusy(true); setMsg(null)
    try {
      const r = await fetch('/api/live/pk', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ guestUsername: username, rounds, roundSeconds }) })
      const body = await r.json().catch(() => ({}))
      if (r.ok && body.id) { setUsername(''); setOpenId(body.id) }
      else setMsg(ERRORS[body.error] ?? 'تعذّر إرسال التحدي.')
    } catch { setMsg('تعذّر الاتصال بالخادم.') }
    setBusy(false)
  }

  const row = (b: Brief) => <li key={b.id}>
    <button type="button" onClick={() => setOpenId(b.id)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#0d1429] p-3 text-right transition hover:border-[#869cf5]/50">
      <Swords className="size-5 shrink-0 text-[#a6baff]" />
      <span className="min-w-0 flex-1 truncate text-sm font-semibold">{b.host.displayName} ضد {b.guest.displayName}</span>
      <span className="shrink-0 text-[11px] text-slate-400">{PHASE[b.phase] ?? b.phase} · {b.rounds}×{b.roundSeconds / 60}د</span>
    </button>
  </li>

  return <>
    {error && <div role="alert" className="rounded-2xl border border-rose-300/30 p-5 text-sm">خدمة الجولات غير متاحة حاليًا.</div>}
    {data?.mine.length ? <section><h2 className="mb-2 text-sm font-black">جولاتك ودعواتك</h2><ul className="flex flex-col gap-2">{data.mine.map(row)}</ul></section> : null}
    {data?.signedIn ? <form onSubmit={create} className="flex flex-col gap-3 rounded-[28px] border border-[#7b91ee]/25 bg-gradient-to-b from-[#162448] to-[#0b1021] p-5">
      <h2 className="flex items-center gap-2 font-black"><Medal className="size-5 text-[#afc1ff]" />تحدٍّ جديد</h2>
      <label className="text-xs text-slate-300">اسم المستخدم للمنافس
        <input value={username} onChange={e => setUsername(e.target.value)} required dir="ltr" placeholder="@username" maxLength={31}
          className="mt-1 w-full rounded-xl border border-white/15 bg-black/30 px-3 py-2.5 text-sm text-white placeholder:text-slate-600" />
      </label>
      <fieldset><legend className="mb-2 text-xs text-slate-300">عدد الجولات</legend><div className="grid grid-cols-2 gap-2">
        {([3, 5] as const).map(v => <button key={v} type="button" aria-pressed={rounds === v} onClick={() => setRounds(v)} className={cn('rounded-xl border p-2.5 text-sm', rounds === v ? 'border-[#abbcff] bg-[#526cd4]/30' : 'border-white/10')}>{v} جولات</button>)}
      </div></fieldset>
      <fieldset><legend className="mb-2 text-xs text-slate-300">مدة الجولة</legend><div className="grid grid-cols-3 gap-2">
        {([60, 120, 180] as const).map(v => <button key={v} type="button" aria-pressed={roundSeconds === v} onClick={() => setRoundSeconds(v)} className={cn('rounded-xl border p-2.5 text-sm', roundSeconds === v ? 'border-[#abbcff] bg-[#526cd4]/30' : 'border-white/10')}>{v / 60} د</button>)}
      </div></fieldset>
      <button type="submit" disabled={busy} className="flex items-center justify-center gap-2 rounded-2xl bg-[#a8baff] py-3 font-black text-[#07112b] disabled:opacity-50">
        {busy ? <Loader2 className="size-4 animate-spin" /> : <Swords className="size-4" />}إرسال التحدي
      </button>
      {msg && <p role="alert" className="text-xs text-rose-200">{msg}</p>}
      <p className="text-[11px] leading-5 text-slate-400">تصلح الدعوة لمدة دقيقتين. عند القبول تبدأ عدًّا تنازليًا من 5 ثوانٍ.</p>
    </form> : data && <p className="rounded-xl border border-white/10 bg-black/25 p-4 text-xs text-slate-400">سجّل الدخول لإرسال تحدٍّ أو التصويت.</p>}
    <section>
      <h2 className="mb-2 text-sm font-black">جولات جارية الآن</h2>
      {!data ? <div className="h-16 animate-pulse rounded-2xl bg-white/10" role="status" aria-label="جارٍ التحميل" /> :
        data.live.length ? <ul className="flex flex-col gap-2">{data.live.map(row)}</ul> :
          <p className="rounded-2xl border border-white/10 bg-white/[.04] p-6 text-center text-xs text-slate-400">لا توجد جولات جارية. أرسل تحديًا لتبدأ أول جولة.</p>}
    </section>
  </>
}
