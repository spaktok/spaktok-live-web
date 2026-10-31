'use client'
import {useEffect,useState} from 'react'
import {
 ArrowRight,BarChart3,Crown,Eye,Heart,Medal,Radio,RefreshCcw,
 ShieldCheck,Smartphone,Users,Video,WifiOff,
} from 'lucide-react'
import {cn} from '@/lib/utils'
import {SpaktokPkArena} from '@/components/spaktok/spaktok-pk-arena'

type Tab='live'|'ranking'|'battle'
type Period='week'|'month'|'all'
type RankedCreator={
 rank:number;id:string;username:string;displayName:string;
 avatar:string;verified:boolean;posts:number;likes:number;views:number
}
type Ranking={
 creators:RankedCreator[];rankingType:string;isLiveGiftRanking:boolean
}
interface Props{
 onOpenLivePreview:()=>void
 onUserClick:(id:string)=>void
}
const count=(value:number)=>new Intl.NumberFormat('ar',{
 notation:'compact',maximumFractionDigits:1,
}).format(value)

export function SpaktokLiveHub({onOpenLivePreview,onUserClick}:Props){
 const [tab,setTab]=useState<Tab>('live')
 const [period,setPeriod]=useState<Period>('week')
 const [ranking,setRanking]=useState<Ranking|null>(null)
 const [loading,setLoading]=useState(false)
 const [error,setError]=useState(false)
 const [retry,setRetry]=useState(0)
 useEffect(()=>{
  if(tab!=='ranking')return
  const controller=new AbortController()
  setLoading(true);setError(false)
  fetch('/api/rankings?period='+period,{
   cache:'no-store',signal:controller.signal,
  }).then(async r=>{
   if(!r.ok)throw Error('ranking_unavailable')
   return r.json() as Promise<Ranking>
  }).then(data=>{
   if(!controller.signal.aborted){
    if(data.rankingType!=='published-video-engagement'||
     data.isLiveGiftRanking!==false||!Array.isArray(data.creators))
     throw Error('unexpected_ranking')
    setRanking(data)
   }
  }).catch(()=>{
   if(!controller.signal.aborted)setError(true)
  }).finally(()=>{
   if(!controller.signal.aborted)setLoading(false)
  })
  return()=>controller.abort()
 },[tab,period,retry])
 return <section className="spak-live-hub relative flex h-full min-h-0 flex-col overflow-y-auto bg-[#050915] pb-32 text-white" dir="rtl">
  <header className="sticky top-0 z-20 border-b border-white/10 bg-[#060c1b]/90 px-5 pb-4 pt-[max(1.2rem,env(safe-area-inset-top))] backdrop-blur-xl">
   <div className="mx-auto flex max-w-3xl items-center justify-between gap-3">
    <div>
     <div className="flex items-center gap-2 text-[10px] font-bold tracking-[.2em] text-[#8fafff]"><Radio className="size-3.5"/>SPAKTOK · LIVE ARENA</div>
     <h1 className="mt-2 text-2xl font-black">ساحة المبدعين</h1>
     <p className="mt-1 text-xs text-slate-400">تجربة أصلية للبث والجولات وترتيب المبدعين</p>
    </div>
    <div className="flex items-center gap-2 rounded-full border border-amber-300/25 bg-amber-300/10 px-3 py-2 text-[11px] text-amber-100" role="status">
     <WifiOff className="size-4"/>البث العام غير متاح
    </div>
   </div>
   <div className="mx-auto mt-5 grid max-w-3xl grid-cols-3 gap-2" role="tablist" aria-label="أقسام ساحة المبدعين">
    {([
     {id:'live',label:'البث',icon:Video},
     {id:'ranking',label:'توب رانك',icon:Crown},
     {id:'battle',label:'الجولات',icon:Medal},
    ] as const).map(item=>{
     const Icon=item.icon
     return <button key={item.id} type="button" role="tab" aria-selected={tab===item.id}
      onClick={()=>setTab(item.id)}
      className={cn('flex items-center justify-center gap-2 rounded-2xl border px-3 py-3 text-xs font-bold transition focus-visible:outline-2 focus-visible:outline-[#9db7ff]',
       tab===item.id?'border-[#a9bcff]/60 bg-[#5275f7]/25 text-white':'border-white/10 bg-white/[.03] text-slate-400 hover:border-white/30')}>
      <Icon className="size-4"/>{item.label}
     </button>
    })}
   </div>
  </header>
  <div className="mx-auto w-full max-w-3xl space-y-5 px-5 py-6">
   {tab==='live'&&<>
    <article className="relative overflow-hidden rounded-[28px] border border-[#7f9eff]/25 bg-gradient-to-br from-[#1a2c67] via-[#101a38] to-[#070c1c] p-6 shadow-[0_18px_65px_rgba(0,0,0,.35)]">
     <div className="pointer-events-none absolute -left-10 -top-14 size-56 rounded-full bg-[#4465e7]/20 blur-3xl"/>
     <div className="relative">
      <span className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-[10px] font-bold tracking-wider"><ShieldCheck className="size-3.5"/>PREVIEW · خاص</span>
      <h2 className="mt-5 text-2xl font-black leading-snug">استديو البث من Spaktok</h2>
      <p className="mt-3 max-w-sm text-sm leading-7 text-slate-300">جرّب الكاميرا والفلاتر والشكل البصري للايف على جهازك. لن يبدأ بث حقيقي، ولن تُرسل هدايا أو عملات حتى نربط خدمة البث والمحاسبة الآمنة.</p>
      <button type="button" onClick={onOpenLivePreview}
       className="mt-5 flex items-center gap-2 rounded-2xl bg-[#a8baff] px-5 py-3 text-sm font-black text-[#07112b] transition hover:bg-white focus-visible:outline-2 focus-visible:outline-white">
       <Video className="size-4"/>فتح معاينة اللايف<ArrowRight className="size-4 rotate-180"/>
      </button>
     </div>
    </article>
    <div className="grid gap-3 sm:grid-cols-2">
     <button type="button" onClick={()=>setTab('battle')} className="rounded-3xl border border-white/10 bg-white/[.035] p-5 text-right transition hover:border-[#9db7ff]/40">
      <Users className="mb-4 size-7 text-[#a6baff]"/><h3 className="font-bold">جولات PK</h3>
      <p className="mt-2 text-xs leading-6 text-slate-400">تحدٍّ بموافقة الطرفين، والساعة والنقاط يحسبها الخادم. تصويت مجاني بلا عملات.</p>
      <span className="mt-3 block text-xs text-[#a8bcff]">فتح الجولات ←</span>
     </button>
     <button type="button" onClick={()=>setTab('ranking')} className="rounded-3xl border border-white/10 bg-white/[.035] p-5 text-right transition hover:border-[#9db7ff]/40">
      <BarChart3 className="mb-4 size-7 text-[#a6baff]"/><h3 className="font-bold">توب رانك حقيقي</h3>
      <p className="mt-2 text-xs leading-6 text-slate-400">ترتيب يستند إلى مشاهدات وإعجابات المقاطع المنشورة فعليًا.</p>
      <span className="mt-3 block text-xs text-[#a8bcff]">عرض ترتيب المبدعين ←</span>
     </button>
    </div>
    <p className="rounded-xl border border-white/10 bg-black/25 p-4 text-xs leading-6 text-slate-400">لا نعرض بثوثًا تجريبية كمحتوى حي. ستظهر الغرف النشطة هنا فقط بعد وجود حضور بث حقيقي وتكامل الوسائط والتحقق من الأهلية.</p>
   </>}
   {tab==='ranking'&&<>
    <div className="flex flex-wrap items-center justify-between gap-3">
     <div><h2 className="text-lg font-black">ترتيب المبدعين</h2><p className="mt-1 text-xs text-slate-400">إعجابات المقاطع المنشورة أولاً، ثم المشاهدات. ليس ترتيب الهدايا.</p></div>
     <button type="button" aria-label="تحديث الترتيب" onClick={()=>setRetry(n=>n+1)} className="rounded-xl border border-white/20 p-2"><RefreshCcw className="size-4"/></button>
    </div>
    <div className="flex flex-wrap gap-2">
     {([{id:'week',label:'7 أيام'},{id:'month',label:'30 يومًا'},{id:'all',label:'كل الوقت'}] as const).map(p=><button type="button" key={p.id} onClick={()=>setPeriod(p.id)}
      aria-pressed={period===p.id} className={cn('rounded-full border px-4 py-2 text-xs font-semibold',
      period===p.id?'border-[#a5baff]/60 bg-[#617cff]/25':'border-white/15 bg-white/[.03]')}>{p.label}</button>)}
    </div>
    {loading?<div className="space-y-3" role="status" aria-label="جارٍ تحميل الترتيب">{[1,2,3].map(i=><div key={i} className="h-20 animate-pulse rounded-2xl bg-white/10"/>)}</div>:
    error?<div role="alert" className="rounded-2xl border border-rose-300/30 p-5 text-sm">تعذّر تحميل ترتيب المبدعين من الخادم. <button type="button" className="underline" onClick={()=>setRetry(n=>n+1)}>إعادة المحاولة</button></div>:
    !ranking?.creators.length?<div className="rounded-3xl border border-white/10 bg-white/[.04] p-9 text-center"><Crown className="mx-auto mb-3 size-10 text-[#9bb4ff]"/><h3 className="font-bold">لا توجد نتائج منشورة في هذه الفترة</h3><p className="mt-3 text-xs text-slate-400">يبدأ الترتيب بعد نشر مقاطع حقيقية والحصول على تفاعل فعلي.</p></div>:
    <ol className="space-y-2">
     {ranking.creators.map(person=><li key={person.id}>
      <button type="button" onClick={()=>onUserClick(person.id)} className="flex w-full items-center gap-3 rounded-2xl border border-white/10 bg-[#0d1429] p-3 text-right transition hover:border-[#869cf5]/50">
       <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-xl font-black',person.rank<=3?'bg-[#8eacff]/25 text-[#bad0ff]':'bg-white/5 text-slate-400')}>{person.rank}</span>
       {person.avatar?<img src={person.avatar} alt="" className="size-12 shrink-0 rounded-2xl object-cover"/>:
        <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-[#304784] font-bold">{person.displayName.slice(0,1)}</span>}
       <span className="min-w-0 flex-1"><span className="block truncate text-sm font-semibold">{person.displayName} {person.verified&&<span title="موثق" className="text-[#91b5ff]">✓</span>}</span>
       <span className="block truncate text-[11px] text-slate-500">@{person.username} · {person.posts} مقطع</span></span>
       <span className="text-left text-[11px] text-slate-300"><span className="flex items-center gap-1"><Heart className="size-3.5"/>{count(person.likes)}</span><span className="mt-1 flex items-center gap-1"><Eye className="size-3.5"/>{count(person.views)}</span></span>
      </button>
     </li>)}
    </ol>}
   </>}
   {tab==='battle'&&<>
    <SpaktokPkArena/>
    <button type="button" onClick={onOpenLivePreview} className="flex w-full items-center justify-center gap-2 rounded-2xl bg-[#a8baff] px-5 py-3 font-bold text-[#09152c]"><Smartphone className="size-4"/>معاينة الكاميرا قبل الجولة</button>
   </>}
  </div>
 </section>
}
