'use client'
import {ScanFace,ChevronDown,ChevronUp} from 'lucide-react'
import {faceFxCatalog,type FaceFxParams} from '@/lib/filter-engine/params'
import {cn} from '@/lib/utils'
export function FaceMaskTray({value,onChange,visible,onToggle}:{
 value:FaceFxParams;onChange:(value:FaceFxParams)=>void;visible:boolean;onToggle:()=>void
}){
 return <div className="pointer-events-none absolute inset-x-2 z-20 flex flex-col items-center gap-2"
   style={{bottom:'clamp(190px, 24dvh, 245px)'}} dir="rtl">
   {!visible?<button type="button" onClick={onToggle}
    className="pointer-events-auto flex items-center gap-2 rounded-full border border-[#a7c0ff]/35 bg-[#0d1837]/85 px-5 py-2.5 text-sm font-bold text-white shadow-xl backdrop-blur-md">
    <ScanFace className="size-5 text-[#9dbdff]"/> أقنعة الوجه <ChevronUp className="size-4"/></button>:
   <div className="pointer-events-auto w-full max-w-[480px] overflow-hidden rounded-[22px] border border-white/15 bg-[#0b1024]/70 p-2.5 shadow-xl backdrop-blur-md">
     <div className="mb-1.5 flex items-center justify-between gap-2 px-1">
       <span className="flex items-center gap-1.5 text-[11px] font-bold text-[#ccdaff]"><ScanFace className="size-4"/> أقنعة الوجه</span>
       <button type="button" onClick={onToggle} className="flex items-center gap-1 text-[11px] text-white/75" aria-label="إخفاء شريط الأقنعة">إخفاء <ChevronDown className="size-4"/></button>
     </div>
     <div className="flex snap-x snap-mandatory gap-2 overflow-x-auto pb-1 scrollbar-hide" role="group" aria-label="اختر قناع واقع معزز">
     {faceFxCatalog.map(mask=><button type="button" key={mask.id}
       className={cn('flex min-w-[58px] shrink-0 snap-start flex-col items-center gap-1 rounded-[15px] border px-1.5 py-1.5',
         value.id===mask.id?'border-[#aec4ff] bg-[#536cba]/50':'border-white/10 bg-white/[.06]')}
       onClick={()=>onChange({...value,id:mask.id,strength:Math.max(.85,value.strength)})}
       aria-label={'تفعيل '+mask.name} aria-pressed={value.id===mask.id}>
       <span className="text-[27px]" aria-hidden="true">{mask.icon}</span>
       <span className="max-w-[65px] truncate text-[9px] font-medium text-white/90">{mask.name}</span>
     </button>)}
     </div>
   </div>}
 </div>
}
