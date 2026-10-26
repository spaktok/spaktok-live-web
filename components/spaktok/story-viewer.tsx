'use client'

import {useEffect,useRef,useState} from 'react'
import {ChevronLeft,ChevronRight,Pause,Play,Share2,Volume2,VolumeX,X,Clock3} from 'lucide-react'
import type {Story} from '@/lib/types'

interface Props {initialStoryId:string;onClose:()=>void}
type WireStory=Omit<Story,'createdAt'|'expiresAt'|'user'> & {
  createdAt:string;expiresAt:string;user:Omit<Story['user'],'createdAt'> & {createdAt:string}
}
const formatDate=(value:Date)=>Number.isFinite(value.getTime())?
  new Intl.DateTimeFormat('ar',{day:'numeric',month:'short',hour:'2-digit',minute:'2-digit'}).format(value):''

export function StoryViewer({initialStoryId,onClose}:Props){
  const [stories,setStories]=useState<Story[]>([])
  const [index,setIndex]=useState(0)
  const [loading,setLoading]=useState(true)
  const [failed,setFailed]=useState(false)
  const [progress,setProgress]=useState(0)
  const [paused,setPaused]=useState(false)
  const [muted,setMuted]=useState(true)
  const [notice,setNotice]=useState('')
  const videoRef=useRef<HTMLVideoElement|null>(null)
  const elapsedRef=useRef(0)
  const holdTimer=useRef<ReturnType<typeof setTimeout>|null>(null)
  const heldRef=useRef(false)

  useEffect(()=>{
    const controller=new AbortController()
    setLoading(true);setFailed(false)
    fetch('/api/native/stories',{cache:'no-store',signal:controller.signal})
      .then(async r=>{if(!r.ok)throw Error('stories_unavailable');return r.json() as Promise<{stories?:WireStory[]}>})
      .then(({stories:rows})=>{
        if(controller.signal.aborted)return
        const mapped=(rows||[]).map(r=>({
          ...r,
          createdAt:new Date(r.createdAt),expiresAt:new Date(r.expiresAt),
          user:{...r.user,createdAt:new Date(r.user.createdAt)},
        })) as Story[]
        setStories(mapped)
        setIndex(Math.max(0,mapped.findIndex(x=>x.id===initialStoryId)))
      })
      .catch(()=>{if(!controller.signal.aborted)setFailed(true)})
      .finally(()=>{if(!controller.signal.aborted)setLoading(false)})
    return()=>controller.abort()
  },[initialStoryId])

  const current=stories[index]
  const isVideo=current?.mediaType==='video'
  const isValid=current&&current.expiresAt.getTime()>Date.now()

  const next=()=>{
    if(index+1<stories.length)setIndex(i=>i+1)
    else onClose()
  }
  const previous=()=>{
    if(index>0)setIndex(i=>i-1)
    else {setProgress(0);elapsedRef.current=0;if(videoRef.current)videoRef.current.currentTime=0}
  }

  useEffect(()=>{
    setProgress(0);elapsedRef.current=0;setPaused(false);setNotice('')
  },[index])

  useEffect(()=>{
    const video=videoRef.current
    if(!video||!isVideo)return
    video.muted=muted
    if(paused||document.hidden)video.pause()
    else video.play().catch(()=>setNotice('اضغط على الفيديو لتشغيله'))
  },[paused,muted,index,isVideo])

  useEffect(()=>{
    if(!current||isVideo||paused)return
    let raf=0,last=performance.now(),lastPaint=0
    const duration=Math.max(3,Math.min(30,current.duration||5))*1000
    const tick=(now:number)=>{
      const dt=Math.max(0,Math.min(now-last,150))
      last=now
      if(!document.hidden)elapsedRef.current=Math.min(duration,elapsedRef.current+dt)
      if(now-lastPaint>50){setProgress(100*elapsedRef.current/duration);lastPaint=now}
      if(elapsedRef.current>=duration){next();return}
      raf=requestAnimationFrame(tick)
    }
    raf=requestAnimationFrame(tick)
    return()=>cancelAnimationFrame(raf)
  },[current,isVideo,paused,index,onClose])

  useEffect(()=>{
    if(!current||!stories[index+1]||stories[index+1].mediaType==='video')return
    // Warm just the next image, never the entire story feed.
    const img=new Image()
    img.src=stories[index+1].mediaUrl
  },[stories,index,current])

  useEffect(()=>()=>{if(holdTimer.current)clearTimeout(holdTimer.current)},[])

  const startHold=()=>{
    heldRef.current=false
    if(holdTimer.current)clearTimeout(holdTimer.current)
    holdTimer.current=setTimeout(()=>{heldRef.current=true;setPaused(true)},250)
  }
  const endHold=(event:React.PointerEvent<HTMLDivElement>)=>{
    if(holdTimer.current){clearTimeout(holdTimer.current);holdTimer.current=null}
    if(heldRef.current){heldRef.current=false;setPaused(false);return}
    const bounds=event.currentTarget.getBoundingClientRect()
    const ratio=(event.clientX-bounds.left)/Math.max(1,bounds.width)
    if(ratio<0.32)previous()
    else if(ratio>0.68)next()
    else setPaused(p=>!p)
  }
  const share=async()=>{
    if(!current)return
    const link=new URL('/',window.location.origin)
    link.searchParams.set('story',current.id)
    try{
      if(navigator.share)await navigator.share({title:'SpakTok Story',url:link.toString()})
      else if(navigator.clipboard)await navigator.clipboard.writeText(link.toString())
      else throw Error('share_unavailable')
      setNotice('تمت مشاركة رابط القصة')
    }catch{setNotice('تعذرت المشاركة')}
  }

  if(loading)return <main role="status" className="fixed inset-0 z-[70] flex items-center justify-center bg-[#060a14] text-sm text-white/65">جارٍ تحميل القصة…</main>
  if(failed||!current||!isValid)return <main className="fixed inset-0 z-[70] flex flex-col items-center justify-center gap-3 bg-[#060a14] p-6 text-white">
    <Clock3 className="size-9 text-[#90aaff]"/>
    <h2 className="text-lg font-bold">القصة غير متاحة</h2>
    <p className="text-sm text-white/50">قد تكون انتهت مدتها أو أُزيلت.</p>
    <button onClick={onClose} className="rounded-xl bg-white px-5 py-2 text-sm font-bold text-black">إغلاق</button>
  </main>

  return (
    <main className="fixed inset-0 z-[70] flex items-center justify-center bg-[#030509]" aria-label="عارض قصص SpakTok" dir="rtl">
      <div className="relative h-dvh w-full max-w-[min(100vw,calc(100dvh*9/16))] overflow-hidden bg-[#101628]">
        <div className="absolute inset-0 touch-pan-y" onPointerDown={startHold} onPointerUp={endHold}
          onPointerCancel={()=>{if(holdTimer.current)clearTimeout(holdTimer.current);setPaused(false)}}>
          {isVideo?
            <video key={current.id} ref={videoRef} src={current.mediaUrl} playsInline muted={muted}
              autoPlay preload="metadata" className="size-full object-cover"
              onEnded={next}
              onTimeUpdate={e=>{
                const v=e.currentTarget
                if(v.duration>0)setProgress(Math.max(0,Math.min(100,v.currentTime/v.duration*100)))
              }}
              onError={()=>setNotice('تعذّر تشغيل هذا الفيديو')}/>:
            <img key={current.id} src={current.mediaUrl} alt={'قصة '+current.user.displayName}
              decoding="async" className="size-full object-cover"/>}
          <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/65 via-transparent to-black/75"/>
        </div>
        <div className="absolute inset-x-0 top-0 z-10 px-3 pt-[max(1rem,env(safe-area-inset-top))]">
          <div className="mb-4 flex gap-1" aria-label="تقدم عرض القصص">{stories.map((r,i)=>(
            <div key={r.id} className="h-[3px] flex-1 overflow-hidden rounded-full bg-white/30">
              <div className="h-full rounded-full bg-white" style={{width:i<index?'100%':i===index?progress+'%':'0%'}}/>
            </div>
          ))}</div>
          <div className="flex items-center justify-between gap-3">
            <div className="flex min-w-0 items-center gap-2.5">
              <span className="flex size-10 shrink-0 items-center justify-center overflow-hidden rounded-full border border-white/60 bg-[#4264b0] text-white">
                {current.user.avatar?<img src={current.user.avatar} alt="" className="size-full object-cover"/>:current.user.displayName.slice(0,1)}
              </span>
              <div className="min-w-0"><p className="truncate text-sm font-bold text-white">{current.user.displayName}</p><p className="text-[11px] text-white/65">{formatDate(current.createdAt)}</p></div>
            </div>
            <div className="flex shrink-0 gap-1.5">
              <button onClick={()=>setPaused(p=>!p)} aria-label={paused?'تشغيل القصة':'إيقاف القصة مؤقتًا'} className="spak-icon-control text-white">{paused?<Play className="size-4"/>:<Pause className="size-4"/>}</button>
              {isVideo&&<button onClick={()=>setMuted(m=>!m)} aria-label={muted?'تشغيل الصوت':'كتم الصوت'} className="spak-icon-control text-white">{muted?<VolumeX className="size-4"/>:<Volume2 className="size-4"/>}</button>}
              <button onClick={onClose} aria-label="إغلاق القصة" className="spak-icon-control text-white"><X className="size-4"/></button>
            </div>
          </div>
        </div>
        <button onClick={previous} disabled={index===0} aria-label="القصة السابقة"
          className="absolute right-2 top-1/2 z-10 rounded-full bg-black/35 p-2 text-white disabled:opacity-25"><ChevronRight className="size-5"/></button>
        <button onClick={next} aria-label="القصة التالية"
          className="absolute left-2 top-1/2 z-10 rounded-full bg-black/35 p-2 text-white"><ChevronLeft className="size-5"/></button>
        <div className="absolute inset-x-0 bottom-0 z-10 px-5 pb-[max(1.5rem,env(safe-area-inset-bottom))]">
          {notice&&<p role="status" className="mb-3 rounded-xl bg-black/70 p-2 text-center text-xs text-white/80">{notice}</p>}
          <div className="flex items-center justify-between gap-3 rounded-2xl border border-white/15 bg-black/45 px-4 py-3 backdrop-blur-xl">
            <span className="text-xs text-white/65">الردود والتفاعلات قريبًا</span>
            <button onClick={()=>void share()} className="flex items-center gap-2 text-sm font-bold text-[#bfccff]"><Share2 className="size-4"/>مشاركة</button>
          </div>
        </div>
      </div>
    </main>
  )
}
