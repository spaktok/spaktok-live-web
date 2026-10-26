'use client'

import { useEffect, useState } from 'react'
import { Search, Compass, Sparkles, ArrowUpRight, Film, Users, Bell, ShoppingBag, Heart, Eye, UserPlus, Check, RefreshCw, Radio } from 'lucide-react'
import { cn } from '@/lib/utils'

type Creator = {
  id:string;username:string;displayName:string;avatar:string;bio:string;followers:number;
  isVerified:boolean;isFollowing:boolean
}
type Clip = {id:string;userId:string;username:string;thumbnailUrl:string;caption:string;
  views:number;likes:number;createdAt:string}
type SearchResponse={creators:Creator[];videos:Clip[];query:string}
interface Props {
  onUserClick:(id:string)=>void
  onVideoClick:(id:string)=>void
  onShopClick?:()=>void
  onNotificationsClick?:()=>void
}

const count=(n:number)=>new Intl.NumberFormat('ar',{notation:'compact',maximumFractionDigits:1}).format(n)
const avatarColors=['from-[#253b86] to-[#4766f5]','from-[#193b66] to-[#047c8c]','from-[#503281] to-[#bb588e]']
export function DiscoverScreen({onUserClick,onVideoClick,onShopClick,onNotificationsClick}:Props){
  const [search,setSearch]=useState('')
  const [mode,setMode]=useState<'all'|'people'|'videos'>('all')
  const [creators,setCreators]=useState<Creator[]>([])
  const [videos,setVideos]=useState<Clip[]>([])
  const [isLoading,setIsLoading]=useState(true)
  const [error,setError]=useState(false)
  const [revision,setRevision]=useState(0)
  const [actionStatus,setActionStatus]=useState<string|null>(null)
  const [busy,setBusy]=useState<string|null>(null)

  useEffect(()=>{
    const controller=new AbortController()
    const timer=window.setTimeout(async()=>{
      setIsLoading(true);setError(false)
      try{
        const response=await fetch('/api/native/discover?q='+encodeURIComponent(search.trim()),{
          cache:'no-store',signal:controller.signal,
        })
        if(!response.ok)throw new Error('discovery_unavailable')
        const data=await response.json() as SearchResponse
        if(!controller.signal.aborted){
          setCreators(data.creators);setVideos(data.videos)
        }
      }catch{
        if(!controller.signal.aborted)setError(true)
      }finally{if(!controller.signal.aborted)setIsLoading(false)}
    },search.trim()?260:0)
    return ()=>{controller.abort();window.clearTimeout(timer)}
  },[search,revision])

  const follow=async(person:Creator)=>{
    if(busy)return
    setBusy(person.id)
    try{
      const next=!person.isFollowing
      const response=await fetch('/api/follows',{
        method:'POST',headers:{'Content-Type':'application/json'},
        body:JSON.stringify({followingId:person.id,following:next}),
      })
      if(!response.ok)throw new Error('follow_failed')
      setCreators(items=>items.map(c=>c.id===person.id?{
        ...c,isFollowing:next,followers:Math.max(0,c.followers+(next?1:-1)),
      }:c))
    }catch{setActionStatus('تعذّر تحديث المتابعة. أعد المحاولة.')}
    finally{setBusy(null)}
  }

  return (
    <div className="spak-discover min-h-dvh pb-28 text-white" dir="rtl">
      <header className="sticky top-0 z-20 border-b border-white/[0.08] bg-[#080c19]/90 px-5 pb-4 pt-[max(1.2rem,env(safe-area-inset-top))] backdrop-blur-2xl">
        <div className="mx-auto max-w-3xl">
          <div className="mb-5 flex items-center justify-between gap-3">
            <div>
              <div className="mb-1 flex items-center gap-2 text-[10px] font-bold uppercase tracking-[0.24em] text-[#8ca8ff]">
                <Compass size={13}/> SPAKTOK • EXPLORE
              </div>
              <h1 className="text-[28px] font-extrabold tracking-tight">اكتشف عالمك<span className="text-[#7d9dff]">.</span></h1>
              <p className="mt-1 text-xs text-white/45">مبدعون حقيقيون، ومحتوى ينمو معك</p>
            </div>
            <div className="flex gap-2">
              {onNotificationsClick&&<button type="button" onClick={onNotificationsClick} aria-label="الإشعارات" className="spak-icon-control"><Bell className="size-5"/></button>}
              {onShopClick&&<button type="button" onClick={onShopClick} aria-label="المتجر" className="spak-icon-control"><ShoppingBag className="size-5"/></button>}
            </div>
          </div>
          <label className="spak-search-field flex h-13 items-center gap-3 px-4">
            <Search className="size-5 shrink-0 text-[#97b0ff]"/>
            <span className="sr-only">ابحث عن الفيديوهات والمبدعين</span>
            <input value={search} onChange={e=>setSearch(e.target.value)} maxLength={60} placeholder="ابحث عن فيديو أو مبدع..."
              className="w-full flex-1 bg-transparent text-sm text-white outline-none placeholder:text-white/35" autoComplete="off"/>
            {search&&<button type="button" onClick={()=>setSearch('')} className="rounded-full bg-white/10 px-2 py-1 text-[11px] text-white/65">مسح</button>}
          </label>
          <div className="mt-4 flex gap-2">
            {([{id:'all',label:'الكل'},{id:'videos',label:'الفيديوهات'},{id:'people',label:'المبدعون'}] as const).map(item=>(
              <button key={item.id} type="button" onClick={()=>setMode(item.id)}
                aria-pressed={mode===item.id}
                className={cn('rounded-full px-4 py-2 text-xs font-semibold transition-colors',
                  mode===item.id?'bg-white text-[#0c1530] shadow-[0_6px_24px_rgba(255,255,255,.12)]':'bg-white/[.07] text-white/60 hover:text-white')}>
                {item.label}
              </button>
            ))}
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-3xl space-y-8 px-5 py-6">
        {actionStatus&&<p role="status" className="rounded-xl border border-amber-400/30 bg-amber-400/10 px-4 py-3 text-sm text-amber-100">{actionStatus}</p>}
        {isLoading?(
          <div className="space-y-5" role="status" aria-label="تحميل المحتوى">
            <div className="h-20 animate-pulse rounded-3xl bg-white/[.07]"/>
            <div className="grid grid-cols-2 gap-3">{[0,1,2,3].map(i=><div key={i} className="aspect-[3/4] animate-pulse rounded-3xl bg-white/[.05]"/>)}</div>
          </div>
        ):error?(
          <div className="spak-empty-shell">
            <RefreshCw className="mx-auto mb-3 size-8 text-[#90aaff]"/>
            <h2 className="text-lg font-bold">تعذّر تحميل الاكتشاف</h2>
            <p className="mt-2 text-sm text-white/50">تأكد من الاتصال بالشبكة، ثم حاول مجددًا.</p>
            <button onClick={()=>setRevision(n=>n+1)} className="spak-primary-button mt-5">إعادة المحاولة</button>
          </div>
        ):(
          <>
            {mode!=='videos'&&(
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.16em] text-[#86a4fc]">CREATORS</p>
                    <h2 className="mt-1 text-lg font-bold">{search?'المبدعون المطابقون':'تعرّف على المبدعين'}</h2>
                  </div>
                  <span className="rounded-full bg-white/[.07] px-3 py-1 text-xs text-white/60">{creators.length}</span>
                </div>
                {creators.length?(
                  <div className="space-y-2.5">
                    {creators.map((person,i)=>(
                      <article key={person.id} className="spak-creator-card flex items-center gap-3 p-3">
                        <button onClick={()=>onUserClick(person.id)} className={cn('flex size-12 shrink-0 items-center justify-center overflow-hidden rounded-2xl bg-gradient-to-br',avatarColors[i%avatarColors.length])} aria-label={'فتح ملف '+person.username}>
                          {person.avatar?<img src={person.avatar} alt="" loading="lazy" className="size-full object-cover"/>:<span className="text-xl font-bold">{person.displayName.slice(0,1).toUpperCase()}</span>}
                        </button>
                        <button onClick={()=>onUserClick(person.id)} className="min-w-0 flex-1 text-right">
                          <p className="truncate text-sm font-bold">{person.displayName}</p>
                          <p className="mt-0.5 truncate text-xs text-white/45" dir="ltr">@{person.username}</p>
                          <p className="mt-1 truncate text-[11px] text-white/35">{count(person.followers)} متابع</p>
                        </button>
                        <button type="button" disabled={busy===person.id} onClick={()=>void follow(person)}
                          aria-label={person.isFollowing?'إلغاء متابعة '+person.username:'متابعة '+person.username}
                          className={cn('inline-flex min-w-[94px] items-center justify-center gap-1.5 rounded-xl px-3 py-2.5 text-xs font-semibold transition',
                            person.isFollowing?'border border-white/15 bg-white/[.06] text-white':'bg-[#7e9dff] text-[#08152f] hover:bg-[#aac0ff]')}>
                          {person.isFollowing?<Check className="size-3.5"/>:<UserPlus className="size-3.5"/>}
                          {person.isFollowing?'متابَع':'متابعة'}
                        </button>
                      </article>
                    ))}
                  </div>
                ):<div className="spak-empty-shell"><Users className="mx-auto mb-3 size-8 text-[#91aafb]"/><p className="font-semibold">لم نجد مبدعين بعد</p><p className="mt-2 text-xs text-white/45">سيظهر هنا أصحاب الحسابات الحقيقيون عند انضمامهم.</p></div>}
              </section>
            )}

            {mode!=='people'&&(
              <section>
                <div className="mb-4 flex items-center justify-between">
                  <div>
                    <p className="text-[10px] font-bold tracking-[0.16em] text-[#86a4fc]">WATCH</p>
                    <h2 className="mt-1 text-lg font-bold">{search?'نتائج الفيديو':'أحدث الفيديوهات'}</h2>
                  </div>
                  <span className="rounded-full bg-white/[.07] px-3 py-1 text-xs text-white/60">{videos.length}</span>
                </div>
                {videos.length?(
                  <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
                    {videos.map(video=>(
                      <button key={video.id} onClick={()=>onVideoClick(video.id)}
                        className="spak-clip-card group relative aspect-[3/4] overflow-hidden rounded-[22px] text-right">
                        {video.thumbnailUrl?
                          <img src={video.thumbnailUrl} alt="" loading="lazy" className="size-full object-cover transition duration-500 group-hover:scale-105"/>:
                          <div className="flex size-full items-center justify-center bg-gradient-to-br from-[#182a58] via-[#131e37] to-[#060913]"><Film className="size-12 text-[#7b97ed]/60"/></div>}
                        <div className="absolute inset-0 bg-gradient-to-t from-[#070b17] via-transparent to-transparent"/>
                        <div className="absolute inset-x-3 bottom-3">
                          <p className="line-clamp-2 text-xs font-semibold text-white">{video.caption||'فيديو جديد'}</p>
                          <div className="mt-2 flex items-center justify-between text-[11px] text-white/70">
                            <span dir="ltr" className="max-w-[70%] truncate">@{video.username}</span>
                            <span className="flex items-center gap-1"><Eye className="size-3"/>{count(video.views)}</span>
                          </div>
                        </div>
                        <ArrowUpRight className="absolute left-3 top-3 size-4 text-white/80"/>
                      </button>
                    ))}
                  </div>
                ):(
                  <div className="spak-empty-shell">
                    <Film className="mx-auto mb-3 size-9 text-[#8ba7ff]"/>
                    <p className="font-semibold">لا توجد فيديوهات منشورة بعد</p>
                    <p className="mt-2 text-xs leading-6 text-white/45">تظهر الفيديوهات هنا بعد رفعها ومراجعتها. لا نعرض مقاطع تجريبية كأنها من المستخدمين.</p>
                  </div>
                )}
              </section>
            )}
            {!creators.length&&!videos.length&&search&&<p className="text-center text-sm text-white/40">جرّب مصطلح بحث آخر</p>}
          </>
        )}
        <div className="flex items-center justify-center gap-2 pb-2 text-xs text-white/30"><Sparkles className="size-3.5"/> اكتشف محتوى حقيقيًا، بلا أرقام وهمية</div>
      </main>
    </div>
  )
}
