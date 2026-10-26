'use client'
import {useEffect,useMemo,useRef,useState} from 'react'
import {ChevronDown,ChevronUp,Heart,Search,ScanFace,X} from 'lucide-react'
import {faceFxCatalog,type FaceFxParams,type FaceFxId} from '@/lib/filter-engine/params'
import {cn} from '@/lib/utils'
import {getMakeupPalette,type MakeupLookId} from '@/lib/filter-engine/makeup3d'

type Category='makeup'|'3d'|'all'|'fashion'|'animal'|'fantasy'|'fun'|'reactive'|'saved'
const tabs:{id:Category;label:string}[]=[
 {id:'makeup',label:'مكياج 3D'},{id:'3d',label:'مجسمات 3D'},{id:'all',label:'الكل'},{id:'saved',label:'المفضلة'},{id:'reactive',label:'الذكية'},
 {id:'animal',label:'الحيوانات'},{id:'fashion',label:'المظهر'},
 {id:'fantasy',label:'الخيال'},{id:'fun',label:'المرح'},
]
const STORAGE_KEY='spaktok.face-ar.favorites.v1'


/** Scalable true SVG thumbnail (not a font emoji). The actual lens uses a
 * physically based 3D GLB/WebGL renderer inside the viewer's SVG surface. */
function RoyalCrownSvg(){
 return <svg viewBox="0 0 72 72" className="size-11" aria-hidden="true" xmlns="http://www.w3.org/2000/svg">
  <defs>
   <linearGradient id="spak-crown-svg-gold" x1="0" y1="0" x2=".85" y2="1">
    <stop stopColor="#fff6b9"/><stop offset=".30" stopColor="#e6ad56"/>
    <stop offset=".57" stopColor="#b46b39"/><stop offset=".82" stopColor="#ffdc8a"/>
    <stop offset="1" stopColor="#8f4e35"/>
   </linearGradient>
   <linearGradient id="spak-crown-svg-gem" x1="0" y1="0" x2="1" y2="1">
    <stop stopColor="#f9d2ff"/><stop offset=".22" stopColor="#00ecff"/>
    <stop offset=".46" stopColor="#9958f8"/><stop offset=".72" stopColor="#ff6aa7"/>
    <stop offset="1" stopColor="#ffe689"/>
   </linearGradient>
   <radialGradient id="spak-crown-svg-light">
    <stop stopColor="#fff" stopOpacity=".98"/><stop offset=".4" stopColor="#ffe6a0" stopOpacity=".75"/>
    <stop offset="1" stopColor="#ffe6a0" stopOpacity="0"/>
   </radialGradient>
  </defs>
  <path d="M6 49 L10 21 Q14 31 20 32 Q22 20 29 21 L36 7 L43 21 Q50 20 52 32 Q58 31 62 21 L66 49 Z"
   fill="url(#spak-crown-svg-gold)" stroke="#fff1a3" strokeWidth="1.3" strokeLinejoin="round"/>
  <path d="M8 48 Q17 35 24 42 Q18 27 26 25 Q36 37 36 39 Q36 37 46 25 Q54 27 48 42 Q55 35 64 48"
   stroke="#fee2a2" strokeWidth="2.5" fill="none" strokeLinecap="round"/>
  <path d="M10 49 Q36 56 62 49 L62 55 Q36 61 10 55 Z" fill="#bf8149" stroke="#ffdb91" strokeWidth="1.4"/>
  <path d="M36 20 L49 33 L43 49 L36 54 L29 49 L23 33 Z" fill="url(#spak-crown-svg-gem)"
   stroke="#ffeed7" strokeWidth="2" strokeLinejoin="round"/>
  <path d="M36 20 L36 54 L23 33 Z" fill="#fff" fillOpacity=".13"/>
  <path d="M36 20 L49 33 L36 40 L23 33 Z" fill="#fff" fillOpacity=".24"/>
  <path d="M23 33 L36 40 L29 49 Z M49 33 L36 40 L43 49 Z" fill="#431a97" fillOpacity=".30"/>
  {[[11,26],[20,34],[51,34],[61,26],[17,48],[55,48],[36,11],[18,54],[54,54]].map(([x,y],i)=>
   <g key={i}>
    <circle cx={x} cy={y} r={i===6?4.2:2.4} fill="#f2f9ff" stroke="#d7a870" strokeWidth="1"/>
    <path d={`M${x-1.1} ${y} L${x+1.2} ${y} M${x} ${y-1.2} L${x} ${y+1.2}`}
      stroke="#ffffff" strokeWidth=".55"/>
   </g>)}
  <circle cx="43" cy="25" r="9" fill="url(#spak-crown-svg-light)"/>
  <path d="M42 18 L42 29 M37 23 L47 23" stroke="#ffffff" strokeWidth="1.2" strokeLinecap="round"/>
 </svg>
}

function MakeupPreview({id}:{id:MakeupLookId}){
 const p=getMakeupPalette(id)
 return <svg viewBox="0 0 64 64" className="size-11" aria-hidden="true">
   <defs><linearGradient id={'skin-'+id} x1="0" x2="1" y1="0" y2="1">
     <stop stopColor="#eac5ac" offset="0"/><stop stopColor="#b8826f" offset="1"/>
   </linearGradient></defs>
   <ellipse cx="32" cy="32" rx="24" ry="29" fill={'url(#skin-'+id+')'}/>
   <ellipse cx="19" cy="35" rx="8" ry="4" fill={p.blush} opacity={p.coverage[4]*.8}/>
   <ellipse cx="45" cy="35" rx="8" ry="4" fill={p.blush} opacity={p.coverage[4]*.8}/>
   <path d="M13 25 Q20 17 27 25M37 25 Q44 17 51 25" fill="none"
    stroke={p.shadow} strokeWidth="5" strokeLinecap="round" opacity=".8"/>
   <path d="M14 25Q20 28 27 25M37 25Q44 28 50 25" fill="none"
    stroke={p.liner} strokeWidth="2" strokeLinecap="round"/>
   <path d="M23 46 Q28 40 32 44 Q36 40 41 46 Q33 53 23 46" fill={p.lip}/>
   <path d="M29 30Q32 34 35 30" stroke="#b7816a" strokeWidth="1" fill="none"/>
 </svg>
}

export function FaceMaskTray({value,onChange,visible,onToggle}:{
 value:FaceFxParams
 onChange:(value:FaceFxParams)=>void
 visible:boolean
 onToggle:()=>void
}){
 const [tab,setTab]=useState<Category>('makeup')
 const [search,setSearch]=useState('')
 const [showSearch,setShowSearch]=useState(false)
 const [showCustomMakeup,setShowCustomMakeup]=useState(false)
 const [favorites,setFavorites]=useState<FaceFxId[]>([])
 const [renderCount,setRenderCount]=useState(18)
 const listRef=useRef<HTMLDivElement|null>(null)
 useEffect(()=>{
  try{
   const stored=JSON.parse(localStorage.getItem(STORAGE_KEY)||'[]') as unknown
   if(Array.isArray(stored))setFavorites(stored.filter((id):id is FaceFxId=>
    typeof id==='string'&&faceFxCatalog.some(e=>e.id===id)).slice(0,100))
  }catch{}
 },[])
 const filtered=useMemo(()=>{
  const q=search.trim().toLocaleLowerCase('ar')
  return faceFxCatalog.filter(fx=>{
   if(tab==='saved'&&!favorites.includes(fx.id))return false
   if(tab!=='all'&&tab!=='saved'&&fx.group!==tab)return false
   return !q||fx.name.toLocaleLowerCase('ar').includes(q)||fx.id.includes(q)
  })
 },[search,tab,favorites])
 const visibleMasks=filtered.slice(0,renderCount)
 useEffect(()=>{setRenderCount(18);if(listRef.current)listRef.current.scrollLeft=0},[tab,search])
 const toggleFavorite=(id:FaceFxId)=>{
  const updated=favorites.includes(id)?favorites.filter(x=>x!==id):[id,...favorites]
  setFavorites(updated)
  try{localStorage.setItem(STORAGE_KEY,JSON.stringify(updated))}catch{}
 }
 const loadMore=()=>{
  const el=listRef.current
  if(!el)return
  if(Math.abs(el.scrollLeft)+el.clientWidth>=el.scrollWidth-230)
   setRenderCount(n=>Math.min(n+12,filtered.length))
 }
 return <div className="pointer-events-none absolute inset-x-2 z-20 flex flex-col items-center"
   style={{bottom:'clamp(186px,23dvh,235px)'}} dir="rtl">
   {!visible?(
    <button type="button" onClick={onToggle}
      className="pointer-events-auto flex items-center gap-2 rounded-full border border-[#adc4ff]/35 bg-[#0d1837]/85 px-4 py-2.5 text-sm font-bold text-white shadow-xl backdrop-blur-lg">
      <ScanFace className="size-5 text-[#a8c2ff]"/> مؤثرات الوجه
      <span className="rounded-full bg-white/10 px-2 py-0.5 text-[10px] text-white/70">{faceFxCatalog.length-1}</span>
      <ChevronUp className="size-4"/>
    </button>
   ):(
    <section className="pointer-events-auto w-full max-w-[540px] overflow-hidden rounded-[22px] border border-white/15 bg-[#0a1125]/80 px-2.5 pb-2.5 pt-2 shadow-[0_18px_45px_rgba(0,0,0,.35)] backdrop-blur-xl" aria-label="مكتبة أقنعة الوجه">
      <div className="flex items-center justify-between gap-2 px-1 pb-2">
        <div className="flex min-w-0 items-center gap-1.5">
          <ScanFace className="size-4 text-[#9bbaff]"/>
          <strong className="text-xs text-white">مؤثرات الوجه</strong>
          <span className="rounded-full bg-white/[.07] px-2 py-0.5 text-[10px] text-white/60">{faceFxCatalog.length-1}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          <button type="button" onClick={()=>setShowSearch(v=>!v)} aria-label="البحث في المؤثرات" className="rounded-full p-1.5 text-white/80 hover:bg-white/10"><Search className="size-4"/></button>
          <button type="button" onClick={onToggle} aria-label="إخفاء المؤثرات" className="flex items-center gap-1 rounded-full px-2 py-1.5 text-[11px] text-white/75 hover:bg-white/10">إخفاء<ChevronDown className="size-4"/></button>
        </div>
      </div>
      {showSearch&&(
        <label className="mb-2 flex items-center gap-2 rounded-xl border border-white/15 bg-black/30 px-3 py-1.5">
          <Search className="size-4 text-[#9bbaff]"/>
          <input autoFocus value={search} onChange={e=>setSearch(e.target.value)} placeholder="ابحث عن قناع، نظارات، حيوان..."
            className="w-full min-w-0 flex-1 bg-transparent text-xs text-white outline-none placeholder:text-white/40" maxLength={40}/>
          {search&&<button type="button" aria-label="مسح البحث" onClick={()=>setSearch('')}><X className="size-4"/></button>}
        </label>
      )}
      <div className="mb-2 flex gap-1.5 overflow-x-auto whitespace-nowrap scrollbar-hide" role="tablist" aria-label="تصنيفات مؤثرات الوجه">
        {tabs.map(item=><button key={item.id} type="button" role="tab" aria-selected={tab===item.id} onClick={()=>setTab(item.id)}
          className={cn('shrink-0 rounded-full border px-3 py-1.5 text-[11px] transition-colors',
            tab===item.id?'border-[#a6bcff]/60 bg-[#8b9fff]/25 font-bold text-white':'border-white/[.07] bg-white/[.04] text-white/65')}>
          {item.label}
        </button>)}
      </div>
      {visibleMasks.length?(
        <div ref={listRef} onScroll={loadMore}
          className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 scrollbar-hide"
          role="group" aria-label="اختيار مؤثر يتبع معالم الوجه">
          {visibleMasks.map(mask=>(
            <div key={mask.id} className={cn('relative flex min-w-[63px] max-w-[70px] shrink-0 snap-start flex-col items-center rounded-[14px] border px-1 pb-1 pt-1',
              value.id===mask.id?'border-[#abc3ff] bg-[#425cae]/55':'border-white/10 bg-white/[.05]')}>
              <button type="button" className="flex w-full flex-col items-center gap-1" onClick={()=>onChange({...value,id:mask.id,strength:Math.max(.85,value.strength)})}
                aria-label={'تفعيل '+mask.name} aria-pressed={value.id===mask.id}>
                <span className="flex size-10 items-center justify-center overflow-hidden rounded-xl bg-gradient-to-br from-[#34456f]/50 to-[#101626]/40 text-[26px]" aria-hidden="true">
                   {mask.id==='3d-gold-crown'?<RoyalCrownSvg/>:mask.group==='makeup'?<MakeupPreview id={mask.id as MakeupLookId}/>:mask.icon}
                 </span>
                <span className="h-7 w-full overflow-hidden text-center text-[9px] leading-[14px] text-white/85">{mask.name}</span>
              </button>
              {mask.id!=='none'&&<button type="button" aria-label={favorites.includes(mask.id)?'إزالة من المفضلة':'إضافة إلى المفضلة'} aria-pressed={favorites.includes(mask.id)}
                onClick={()=>toggleFavorite(mask.id)}
                className="absolute -left-0.5 -top-0.5 flex size-5 items-center justify-center rounded-full bg-[#0c1226] text-[#e8aec6]">
                <Heart className="size-3" fill={favorites.includes(mask.id)?'currentColor':'none'}/>
              </button>}
            </div>
          ))}
        </div>
      ):<div className="py-4 text-center text-xs text-white/60">{tab==='saved'?'لم تحفظ أي مؤثر بعد':'لا توجد مؤثرات مطابقة'}</div>}
      {value.id.startsWith('3d-makeup-')&&
        <label className="mt-2 flex items-center gap-2 border-t border-white/10 pt-2 text-[11px] text-white/75">
          <span className="shrink-0 font-semibold">قوة المكياج</span>
          <input type="range" min="0" max="1" step="0.05" value={value.strength}
            onChange={e=>onChange({...value,strength:Number(e.target.value)})}
            className="min-w-0 flex-1 accent-[#9cb9ff]" aria-label="تغيير قوة المكياج"/>
          <span className="w-9 text-left font-mono tabular-nums">{Math.round(value.strength*100)}%</span>
        </label>}

      {value.id.startsWith('3d-makeup-')&&
        <div className="mt-1">
          <button type="button" onClick={()=>setShowCustomMakeup(v=>!v)}
            className="w-full rounded-xl border border-[#b6c8ff]/15 bg-[#405897]/20 px-3 py-2 text-center text-[11px] font-semibold text-[#d5e0ff]"
            aria-expanded={showCustomMakeup}>
            {showCustomMakeup?'إخفاء تخصيص المكياج ↑':'تخصيص الشفاه والعينين والبلاشر ↓'}
          </button>
          {showCustomMakeup&&(
            <div className="mt-2 grid max-h-[26dvh] grid-cols-1 gap-2 overflow-y-auto rounded-xl border border-white/10 bg-[#091024]/80 p-2.5"
              aria-label="التحكم بمناطق المكياج الثلاثي">
              {([
                {key:'foundation',name:'توحيد البشرة'},{key:'lips',name:'أحمر الشفاه'},
                {key:'eyeshadow',name:'ظلال العين'},{key:'eyeliner',name:'الكحل'},
                {key:'blush',name:'البلاشر'},{key:'contour',name:'الكونتور'},
                {key:'highlight',name:'الإضاءة'},
              ] as const).map(zone=>(
                <label key={zone.key} className="flex items-center gap-2 text-[11px] text-white/85">
                  <span className="w-24 shrink-0">{zone.name}</span>
                  <input type="range" min="0" max="1" step=".05"
                    value={value.makeup?.[zone.key]??1}
                    onChange={event=>onChange({...value,makeup:{...value.makeup,[zone.key]:Number(event.target.value)}})}
                    className="min-w-0 flex-1 accent-[#b7c7ff]"/>
                  <span className="w-9 text-left font-mono tabular-nums">
                    {Math.round((value.makeup?.[zone.key]??1)*100)}%
                  </span>
                </label>
              ))}
            </div>
          )}
        </div>}
    </section>
   )}
 </div>
}
