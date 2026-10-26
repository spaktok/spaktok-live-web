'use client'
import {useEffect,useState} from 'react'
import {Bell,ChevronRight,Heart,MessageCircle,UserPlus,RefreshCw,Inbox} from 'lucide-react'
import {cn} from '@/lib/utils'

type Event={id:string;type:'follow'|'like'|'comment';createdAt:string;content:string;videoId:string|null;
  user:{id:string;username:string;displayName:string;avatar:string}}
export function NotificationsScreen({onBack}:{onBack?:()=>void}){
  const [items,setItems]=useState<Event[]>([])
  const [loading,setLoading]=useState(true)
  const [error,setError]=useState(false)
  const [retries,setRetries]=useState(0)
  const [filter,setFilter]=useState<'all'|'mentions'>('all')
  useEffect(()=>{
    const controller=new AbortController()
    const load=async()=>{
      setLoading(true);setError(false)
      try{
        const r=await fetch('/api/native/notifications',{cache:'no-store',signal:controller.signal})
        if(!r.ok)throw Error('notifications_unavailable')
        const payload=await r.json() as {items?:Event[]}
        if(!controller.signal.aborted)setItems(payload.items||[])
      }catch{if(!controller.signal.aborted)setError(true)}
      finally{if(!controller.signal.aborted)setLoading(false)}
    }
    void load()
    return ()=>controller.abort()
  },[retries])
  const icon=(type:Event['type'])=>type==='like'?<Heart className="size-4"/>:
    type==='comment'?<MessageCircle className="size-4"/>:<UserPlus className="size-4"/>
  const label=(event:Event)=>event.type==='like'?'أعجب بفيديوك':event.type==='comment'?'علّق على فيديوك':'بدأ بمتابعتك'
  const relative=(iso:string)=>{
    const seconds=Math.max(0,Math.floor((Date.now()-new Date(iso+'Z'.replace('ZZ','Z')).getTime())/1000))
    if(!Number.isFinite(seconds))return ''
    if(seconds<60)return 'الآن'
    if(seconds<3600)return 'قبل '+Math.floor(seconds/60)+' د'
    if(seconds<86400)return 'قبل '+Math.floor(seconds/3600)+' س'
    return new Date(iso).toLocaleDateString('ar')
  }
  return(
    <div className="spak-discover min-h-dvh pb-24 text-white" dir="rtl">
      <header className="sticky top-0 z-20 border-b border-white/10 bg-[#090e1e]/90 px-5 pb-5 pt-[max(1.25rem,env(safe-area-inset-top))] backdrop-blur-2xl">
        <div className="mx-auto flex max-w-2xl items-center gap-3">
          <button onClick={onBack} aria-label="العودة" className="spak-icon-control"><ChevronRight className="size-5"/></button>
          <div className="flex-1"><p className="text-[10px] font-bold tracking-[.18em] text-[#8caaff]">ACTIVITY</p><h1 className="text-2xl font-bold">الإشعارات</h1></div>
          <div className="spak-icon-control"><Bell className="size-5 text-[#97adff]"/></div>
        </div>
      </header>
      <main className="mx-auto max-w-2xl px-5 py-6">
        <div className="mb-5 flex items-center justify-between">
          <h2 className="text-base font-semibold">آخر التفاعلات</h2>
          <button onClick={()=>setRetries(n=>n+1)} aria-label="تحديث الإشعارات"
            className="inline-flex items-center gap-1.5 rounded-full bg-white/10 px-3 py-2 text-xs text-white/70"><RefreshCw className="size-3.5"/>تحديث</button>
        </div>
        {loading?<div className="space-y-3">{[1,2,3].map(i=><div key={i} className="h-20 animate-pulse rounded-2xl bg-white/[.06]"/>)}</div>:
        error?<div className="spak-empty-shell"><Inbox className="mx-auto mb-3 size-9 text-[#95aaff]"/><p>تعذّر تحميل الإشعارات</p><button className="spak-primary-button mt-4" onClick={()=>setRetries(n=>n+1)}>إعادة المحاولة</button></div>:
        !items.length?<div className="spak-empty-shell"><Bell className="mx-auto mb-4 size-9 text-[#95aaff]"/><h2 className="text-lg font-bold">لا توجد إشعارات بعد</h2><p className="mt-2 text-sm text-white/50">ستظهر المتابعات والإعجابات والتعليقات الحقيقية هنا.</p></div>:
        <div className="space-y-2.5">{items.map(event=>(
          <article key={event.id} className="spak-creator-card flex items-start gap-3 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-[#3553ae]/20 text-[#aac1ff]">{icon(event.type)}</span>
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-baseline gap-1.5">
                <span className="text-sm font-bold">{event.user.displayName}</span>
                <span className="text-xs text-white/60">{label(event)}</span>
              </div>
              {event.type==='comment'&&<p className="mt-2 line-clamp-2 rounded-lg bg-white/[.05] px-3 py-2 text-xs text-white/70">{event.content}</p>}
              <p className="mt-2 text-[11px] text-white/35">{relative(event.createdAt)}</p>
            </div>
          </article>
        ))}</div>}
      </main>
    </div>
  )
}
