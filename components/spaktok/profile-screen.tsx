'use client'
import {useEffect,useState} from 'react'
import {ArrowLeft,Bookmark,Check,ChevronRight,Edit3,Eye,Grid3X3,Heart,Play,Settings,Share2,UserPlus,X,RefreshCw,Clapperboard} from 'lucide-react'
import {useAuth} from '@/hooks/use-auth'
import {cn} from '@/lib/utils'

interface Profile {
 id:string;username:string;displayName:string;avatar:string;bio:string;isVerified:boolean;
 followers:number;following:number;likes:number;isFollowing:boolean;createdAt:string
}
interface Clip {id:string;thumbnailUrl:string;caption:string;views:number}
interface Stats {views:number;likes:number;videoCount:number}
interface PrivateDraft {id:string;state:string;createdAt:string;bytes:number}
interface Props {userId?:string;isOwnProfile?:boolean;onSettingsClick?:()=>void;onBack?:()=>void;onVideoClick?:(id:string)=>void}

const compact=(n:number)=>new Intl.NumberFormat('ar',{notation:'compact',maximumFractionDigits:1}).format(n)
export function ProfileScreen({userId,isOwnProfile=true,onSettingsClick,onBack,onVideoClick}:Props){
 const {user:authenticated}=useAuth()
 const id=userId||authenticated?.id
 const [profile,setProfile]=useState<Profile|null>(null)
 const [stats,setStats]=useState<Stats>({views:0,likes:0,videoCount:0})
 const [videos,setVideos]=useState<Clip[]>([])
 const [tab,setTab]=useState<'videos'|'saved'|'liked'>('videos')
 const [loading,setLoading]=useState(true)
 const [error,setError]=useState(false)
 const [revision,setRevision]=useState(0)
 const [editing,setEditing]=useState(false)
 const [displayName,setDisplayName]=useState('')
 const [bio,setBio]=useState('')
 const [busy,setBusy]=useState(false)
 const [feedback,setFeedback]=useState<string|null>(null)
 const [drafts,setDrafts]=useState<PrivateDraft[]>([])

 useEffect(()=>{
  if(!id)return
  const c=new AbortController()
  setLoading(true);setError(false)
  fetch(`/api/native/profile?id=${encodeURIComponent(id)}&view=${isOwnProfile?tab:'videos'}`,{
    cache:'no-store',signal:c.signal,
  }).then(async r=>{
    if(!r.ok)throw Error('profile_unavailable')
    return r.json() as Promise<{profile:Profile;videos:Clip[];stats:Stats}>
  }).then(data=>{
    if(c.signal.aborted)return
    setProfile(data.profile);setStats(data.stats);setVideos(data.videos||[])
    setDisplayName(data.profile.displayName);setBio(data.profile.bio||'')
  }).catch(()=>{if(!c.signal.aborted)setError(true)})
    .finally(()=>{if(!c.signal.aborted)setLoading(false)})
  return ()=>c.abort()
 },[id,tab,isOwnProfile,revision])

 const save=async()=>{
  if(!profile||busy)return
  const name=displayName.trim(),description=bio.trim()
  if(name.length<2||name.length>50||description.length>160){
    setFeedback('الاسم بين حرفين و50 حرفًا، والنبذة حتى 160 حرفًا.')
    return
  }
  setBusy(true);setFeedback(null)
  try{
   const r=await fetch('/api/native/profile',{
     method:'PATCH',headers:{'Content-Type':'application/json'},
     body:JSON.stringify({displayName:name,bio:description}),
   })
   if(!r.ok)throw Error('save_failed')
   setProfile(p=>p?{...p,displayName:name,bio:description}:p)
   setEditing(false);setFeedback('تم حفظ التعديلات.')
  }catch{setFeedback('تعذّر حفظ التغييرات. أعد المحاولة.')}
  finally{setBusy(false)}
 }
 const follow=async()=>{
  if(!profile||busy)return
  setBusy(true)
  const next=!profile.isFollowing
  try{
   const r=await fetch('/api/follows',{
    method:'POST',headers:{'Content-Type':'application/json'},
    body:JSON.stringify({followingId:profile.id,following:next}),
   })
   if(!r.ok)throw Error('follow_failed')
   setProfile(p=>p?{...p,isFollowing:next,followers:Math.max(0,p.followers+(next?1:-1))}:p)
  }catch{setFeedback('لم نتمكن من تحديث المتابعة. حاول مجددًا.')}
  finally{setBusy(false)}
 }
 useEffect(()=>{
  if(!isOwnProfile||!authenticated)return
  const controller=new AbortController()
  fetch('/api/videos/upload/status',{cache:'no-store',signal:controller.signal})
    .then(async r=>r.ok?r.json():{items:[]})
    .then((data:{items?:PrivateDraft[]})=>{if(!controller.signal.aborted)setDrafts(data.items||[])})
    .catch(()=>{})
  return ()=>controller.abort()
 },[authenticated?.id,isOwnProfile,revision])

 const share=async()=>{
  if(!profile)return
  const url=new URL(window.location.origin)
  url.searchParams.set('user',profile.id)
  try{
    if(navigator.share)await navigator.share({title:profile.displayName,url:url.toString()})
    else if(navigator.clipboard)await navigator.clipboard.writeText(url.toString())
    setFeedback('تمت مشاركة رابط الملف.')
  }catch{setFeedback('تعذّرت المشاركة.')}
 }
 return (
  <div className="spak-discover min-h-dvh pb-28 text-white" dir="rtl">
   <header className="sticky top-0 z-20 border-b border-white/[.08] bg-[#070b18]/90 px-4 pb-3 pt-[max(1rem,env(safe-area-inset-top))] backdrop-blur-2xl">
    <div className="mx-auto flex max-w-2xl items-center justify-between">
     <div className="flex items-center gap-3">
      {onBack&&<button onClick={onBack} className="spak-icon-control" aria-label="العودة"><ChevronRight className="size-5"/></button>}
      <div><p className="text-[10px] font-bold tracking-[.2em] text-[#8ea8fc]">CREATOR SPACE</p><h1 className="text-lg font-bold">{profile?.username||'الملف الشخصي'}</h1></div>
     </div>
     <div className="flex gap-2">
      <button onClick={()=>void share()} className="spak-icon-control" aria-label="مشاركة الملف"><Share2 className="size-4.5"/></button>
      {isOwnProfile&&<button onClick={onSettingsClick} className="spak-icon-control" aria-label="الإعدادات"><Settings className="size-4.5"/></button>}
     </div>
    </div>
   </header>
   {loading?(
     <div className="mx-auto max-w-xl space-y-4 px-5 py-10" role="status">
       <div className="mx-auto size-28 animate-pulse rounded-[34px] bg-white/[.08]"/>
       <div className="mx-auto h-7 w-36 animate-pulse rounded-lg bg-white/[.07]"/>
       <div className="h-36 animate-pulse rounded-3xl bg-white/[.05]"/>
     </div>
   ):error||!profile?(
     <div className="spak-empty-shell mx-5 mt-10"><p className="text-sm">تعذّر تحميل الملف الشخصي.</p>
       <button className="spak-primary-button mt-4" onClick={()=>setRevision(n=>n+1)}><RefreshCw className="mr-2 inline size-4"/>إعادة المحاولة</button>
     </div>
   ):(
    <main className="mx-auto max-w-2xl">
     <section className="spak-profile-hero relative overflow-hidden px-5 pb-6 pt-9 text-center">
      <div className="spak-profile-glow pointer-events-none absolute inset-0" aria-hidden="true"/>
      <div className="relative">
       <div className="mx-auto flex size-24 items-center justify-center overflow-hidden rounded-[30px] border border-[#b2c3ff]/35 bg-gradient-to-br from-[#4b70e7] via-[#26387b] to-[#09182c] shadow-[0_14px_44px_rgba(55,98,232,.28)]">
        {profile.avatar?<img src={profile.avatar} alt="" className="size-full object-cover"/>:<span className="text-4xl font-bold">{profile.displayName.slice(0,1).toUpperCase()}</span>}
       </div>
       <h2 className="mt-4 text-2xl font-extrabold tracking-tight">{profile.displayName}</h2>
       <p className="mt-1 text-sm text-[#a4b9fb]" dir="ltr">@{profile.username}</p>
       {profile.bio?<p className="mx-auto mt-4 max-w-sm text-sm leading-7 text-white/65">{profile.bio}</p>:
         isOwnProfile?<p className="mt-4 text-sm text-white/45">أضف نبذة تعرّف الناس بإبداعك.</p>:null}
       <div className="mx-auto mt-6 grid max-w-sm grid-cols-3 gap-3 rounded-[22px] border border-white/10 bg-white/[.045] px-3 py-4">
        {([{num:profile.followers,label:'متابع'},{num:profile.following,label:'يتابع'},{num:stats.likes,label:'إعجاب'}]).map(item=>
          <div key={item.label}><p className="text-xl font-bold">{compact(item.num)}</p><p className="mt-1 text-[11px] text-white/45">{item.label}</p></div>)}
       </div>
       <div className="mx-auto mt-5 flex max-w-sm gap-2.5">
        {isOwnProfile?(
         <button className="spak-primary-button flex-1" onClick={()=>{setFeedback(null);setEditing(true)}}><Edit3 className="ml-2 inline size-4"/>تعديل الملف الشخصي</button>
        ):(
         <button className={cn('flex-1 rounded-2xl px-5 py-3 text-sm font-bold transition',profile.isFollowing?'border border-white/20 bg-white/10':'bg-[#84a1ff] text-[#0d1732]')} disabled={busy} onClick={()=>void follow()}>
           {profile.isFollowing?<Check className="ml-2 inline size-4"/>:<UserPlus className="ml-2 inline size-4"/>}{profile.isFollowing?'متابَع':'متابعة'}
         </button>
        )}
        <button onClick={()=>void share()} className="spak-icon-control h-12 w-12" aria-label="مشاركة الملف"><Share2 className="size-5"/></button>
       </div>
      </div>
     </section>
     {feedback&&<p role="status" className="mx-5 mb-4 rounded-xl border border-[#85a5ff]/25 bg-[#688afd]/10 px-3 py-2 text-center text-xs text-[#c0ceff]">{feedback}</p>}
     {isOwnProfile&&(
      <div className="mx-5 mb-6 flex items-center justify-between rounded-[22px] border border-white/[.08] bg-white/[.035] p-4">
       <div><p className="text-[10px] font-bold tracking-[.15em] text-[#92acff]">CREATOR INSIGHTS</p>
         <p className="mt-1 text-sm font-semibold">إحصائيات المحتوى المنشور</p>
       </div>
       <div className="flex gap-5 text-left">
        <div><p className="text-lg font-bold">{compact(stats.videoCount)}</p><p className="text-[10px] text-white/45">فيديو</p></div>
        <div><p className="text-lg font-bold">{compact(stats.views)}</p><p className="text-[10px] text-white/45">مشاهدة</p></div>
       </div>
      </div>
     )}
     {isOwnProfile&&drafts.length>0&&(
      <section className="mx-5 mb-6 rounded-3xl border border-[#819fff]/20 bg-[#243b75]/10 p-4">
       <div className="mb-3 flex items-center justify-between"><h3 className="text-sm font-bold">مسودات الفيديو الخاصة</h3>
        <span className="rounded-full bg-[#97b1ff]/15 px-2.5 py-1 text-[10px] text-[#afc5ff]">غير منشورة</span></div>
       <div className="space-y-2">{drafts.slice(0,5).map(d=><div key={d.id} className="flex items-center justify-between rounded-xl border border-white/[.06] bg-white/[.04] px-3 py-2.5">
        <div><p className="text-xs text-white/85">{d.state==='private_review'?'قيد المراجعة':d.state==='issued'?'لم يكتمل الرفع':'تعذّر الرفع'}</p>
        <p className="mt-1 text-[10px] text-white/40">{new Date(d.createdAt).toLocaleDateString('ar')}</p></div>
        <span className="text-[10px] text-white/45">{(d.bytes/1048576).toFixed(1)} MB</span>
       </div>)}</div><p className="mt-3 text-[11px] text-white/40">هذه ملفات خاصة، ولن تُنشر دون مراجعة.</p>
      </section>
     )}
     <div className="sticky top-[60px] z-10 border-y border-white/[.08] bg-[#090d1a]/95 px-5 backdrop-blur-xl">
      <div className="grid grid-cols-3 gap-2">
       {([{id:'videos',icon:Grid3X3,label:'فيديوهاتي'},{id:'saved',icon:Bookmark,label:'المحفوظات'},{id:'liked',icon:Heart,label:'الإعجابات'}] as const)
        .filter(item=>isOwnProfile||item.id==='videos').map(item=><button key={item.id}
          className={cn('flex items-center justify-center gap-2 border-b-2 py-4 text-xs font-bold',tab===item.id?'border-[#9cb3ff] text-white':'border-transparent text-white/45')}
          onClick={()=>setTab(item.id)} aria-pressed={tab===item.id}>
          <item.icon className="size-4"/>{item.label}
        </button>)}
      </div>
     </div>
     <div className="px-3 py-4">
      {videos.length?(
       <div className="grid grid-cols-3 gap-1.5">
        {videos.map(video=><button key={video.id} type="button" onClick={()=>onVideoClick?.(video.id)}
          className="relative aspect-[3/4] overflow-hidden rounded-xl bg-[#17203c]" aria-label={'عرض فيديو '+video.caption}>
          {video.thumbnailUrl?<img loading="lazy" src={video.thumbnailUrl} alt="" className="size-full object-cover"/>:<Clapperboard className="absolute left-1/2 top-1/2 size-8 -translate-x-1/2 -translate-y-1/2 text-[#7b94df]"/>}
          <div className="absolute inset-0 bg-gradient-to-t from-black/65 to-transparent"/>
          <span className="absolute bottom-2 right-2 flex items-center gap-1 text-[10px]"><Eye className="size-3"/>{compact(video.views)}</span>
        </button>)}
       </div>
      ):(
       <div className="spak-empty-shell">
        {tab==='saved'?<Bookmark className="mx-auto mb-3 size-9 text-[#92aaff]"/>:
          tab==='liked'?<Heart className="mx-auto mb-3 size-9 text-[#92aaff]"/>:
            <Clapperboard className="mx-auto mb-3 size-9 text-[#92aaff]"/>}
        <p className="text-base font-semibold">{tab==='saved'?'لا توجد فيديوهات محفوظة':tab==='liked'?'لم تُعجب بفيديوهات بعد':'لا توجد فيديوهات منشورة'}</p>
        <p className="mt-2 text-xs leading-6 text-white/45">سيظهر المحتوى الحقيقي هنا عند توفره.</p>
       </div>
      )}
     </div>
    </main>
   )}
   {editing&&profile&&(
    <div className="fixed inset-0 z-[80] flex items-end justify-center bg-black/70 px-3 pb-[max(1rem,env(safe-area-inset-bottom))] backdrop-blur-sm" role="dialog" aria-modal="true" aria-label="تعديل الملف الشخصي">
     <form className="w-full max-w-lg rounded-[28px] border border-white/15 bg-[#121a2e] p-6" onSubmit={e=>{e.preventDefault();void save()}}>
      <div className="mb-6 flex items-center justify-between"><h2 className="text-lg font-bold">تعديل الملف</h2><button type="button" onClick={()=>setEditing(false)} aria-label="إغلاق"><X className="size-5"/></button></div>
      <label className="mb-4 block text-sm text-white/65">الاسم الظاهر
       <input className="mt-2 w-full rounded-xl border border-white/10 bg-white/[.06] px-4 py-3 text-white outline-none focus:border-[#96b1ff]" value={displayName} maxLength={50} onChange={e=>setDisplayName(e.target.value)} required minLength={2}/>
      </label>
      <label className="mb-5 block text-sm text-white/65">نبذة عنك
       <textarea className="mt-2 min-h-28 w-full resize-none rounded-xl border border-white/10 bg-white/[.06] px-4 py-3 text-white outline-none focus:border-[#96b1ff]" value={bio} maxLength={160} onChange={e=>setBio(e.target.value)}/>
       <span className="mt-1 block text-left text-[11px] text-white/40">{bio.length}/160</span>
      </label>
      {feedback&&<p role="alert" className="mb-3 text-sm text-amber-200">{feedback}</p>}
      <button type="submit" disabled={busy} className="spak-primary-button w-full">{busy?'جارٍ الحفظ…':'حفظ التغييرات'}</button>
     </form>
    </div>
   )}
  </div>
 )
}
