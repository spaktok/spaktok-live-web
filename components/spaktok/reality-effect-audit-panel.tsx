'use client'

import {useMemo,useState} from 'react'
import {
  REALITY_EFFECT_AUDIT,REALITY_AUDIT_FAMILIES,
  summarizeRealityAudit,
  type RealityAuditFamily,type RealityAuditCheck,type RealityAuditState,
} from '@/lib/filter-engine/reality-effect-audit'

const familyNames:Record<RealityAuditFamily,string>={
 'accessory-3d':'مجسمات 3D','makeup-3d':'مكياج 3D','face-morph':'نحت الوجه',
 'face-overlay':'أقنعة وملصقات الوجه','color-grade':'فلاتر الألوان',
 'post-process':'مؤثرات الفيديو','background':'الخلفيات','beauty':'تجميل الوجه',
}
const statusNames:Record<RealityAuditState,string>={
 disabled:'معطّل للحماية',prototype:'مجسم أولي', 'device-qa-required':'يلزم فحص الهاتف',
}
const qualityNames={
 'authored-glb':'ملف GLB حقيقي متاح',
 'tracked-mesh':'شبكة وجه متتبعة',
 'procedural-preview':'هندسة معاينة برمجية',
 'shader-only':'تأثير رسومي',
} as const
const checkNames:Record<RealityAuditCheck,string>={
 'manifest-invalid':'تصحيح تعريف المؤثر قبل تشغيله',
 'legacy-photo-overlay-disabled':'إبقاء قناع الصورة الخارجية القديم معطّلًا لحماية شكل وجه المستخدم',
 'original-3d-asset-needed':'إنشاء مجسم GLB أصلي احترافي مع خاماته ومفاصله عند الحاجة',
 'verify-asset-rights':'مراجعة حقوق استخدام وتوزيع المجسم والخامات',
 'head-pose-and-occlusion':'فحص تثبيت المجسم من كل الزوايا واحتجاب الوجه والشعر واليد',
 'face-region-and-skin-tone':'فحص حدود المكياج وحركة التعبيرات وتدرجات ألوان البشرة',
 'face-tracking-and-mirror':'فحص مواضع الوجه والمرآة الأمامية وفقدان التتبع',
 'face-warp-and-identity':'فحص نحت الملامح مع الحفاظ على صورة المستخدم الأصلية',
 'segmentation-boundaries':'فحص فصل الخلفية عند الشعر واليد والحركة',
 'color-and-gamma':'فحص دقة الألوان والإضاءة وتدرج Gamma',
 'post-fx-motion-and-latency':'فحص حركة التأثير وزمن الإطار واستهلاك GPU',
 'beauty-and-skin-tone':'فحص جماليات البشرة والملامح وتجنّب التشوه والتحيز',
 'recording-parity':'مطابقة صورة المعاينة مع الصورة والفيديو المسجلين',
 'real-device-performance':'قياس FPS والحرارة والذاكرة على أجهزة Android وiOS حقيقية',
}

export default function RealityEffectAuditPanel(){
 const [family,setFamily]=useState<'all'|RealityAuditFamily>('all')
 const [search,setSearch]=useState('')
 const [chosen,setChosen]=useState<string>('3d-lux-glasses')
 const overview=summarizeRealityAudit(REALITY_EFFECT_AUDIT)
 const list=useMemo(()=>REALITY_EFFECT_AUDIT.filter(effect=>
  (family==='all'||effect.family===family)&&
  (effect.name+' '+effect.id).toLocaleLowerCase().includes(search.trim().toLocaleLowerCase()),
 ),[family,search])
 const current=list.find(effect=>effect.id===chosen)??list[0]
 return (
  <section id="studio-all-effects-audit" dir="rtl"
   className="mx-auto mt-8 max-w-7xl rounded-2xl border border-slate-700 bg-slate-950 p-5 text-white">
   <div className="space-y-2">
    <p className="text-xs font-semibold uppercase tracking-widest text-cyan-300">SpakTok Reality · All Effects QA</p>
    <h2 className="text-2xl font-bold">فحص جميع مؤثرات Spaktok Studio</h2>
    <p className="text-sm leading-7 text-slate-300">تعرض هذه اللوحة سجل الكاميرا بأكمله وتُظهر حالة الأصل الرسومي والفحوص المتبقية لكل مؤثر. إنها خطة ضبط قابلة للتنفيذ وليست شهادة نجاح على هاتف حقيقي أو أداة نشر.</p>
   </div>
   <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
    {[
     {label:'مؤثر مسجّل',value:overview.total},
     {label:'يحتاج تجربة الجهاز',value:overview.needingDeviceQa},
     {label:'مجسمات أولية',value:overview.prototypes},
     {label:'معطّل للحماية',value:overview.disabled},
    ].map(item=><div key={item.label} className="rounded-xl border border-slate-700 bg-slate-900 p-3">
     <p className="text-2xl font-bold tabular-nums">{item.value}</p>
     <p className="mt-1 text-xs text-slate-400">{item.label}</p>
    </div>)}
   </div>
   <div className="mt-5 flex flex-wrap gap-2" role="group" aria-label="تصفية فئات المؤثرات">
    <button type="button" onClick={()=>setFamily('all')} aria-pressed={family==='all'}
     className={`rounded-full px-3 py-2 text-xs font-semibold ${family==='all'?'bg-cyan-500 text-slate-950':'bg-slate-800 text-slate-200'}`}>
     الجميع ({overview.total})
    </button>
    {REALITY_AUDIT_FAMILIES.map(kind=><button type="button" key={kind}
      onClick={()=>setFamily(kind)} aria-pressed={family===kind}
      className={`rounded-full px-3 py-2 text-xs font-semibold ${family===kind?'bg-cyan-500 text-slate-950':'bg-slate-800 text-slate-200'}`}>
      {familyNames[kind]} ({overview.families.find(item=>item.family===kind)?.count??0})
     </button>)}
   </div>
   <label className="mt-5 block text-xs font-semibold text-slate-300">
    البحث باسم المؤثر أو المعرّف
    <input type="search" value={search} onChange={event=>setSearch(event.target.value)}
     placeholder="مثال: نظارات أو makeup أو blur"
     className="mt-2 block w-full rounded-lg border border-slate-700 bg-slate-900 px-3 py-3 text-sm text-white"
    />
   </label>
   <div className="mt-4 grid gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.15fr)]">
    <div className="max-h-[460px] space-y-2 overflow-y-auto rounded-xl border border-slate-700 p-2" role="group" aria-label="سجل المؤثرات">
     {list.length===0&&<p className="p-3 text-sm text-slate-400">لا توجد نتائج مطابقة.</p>}
     {list.map(effect=><button type="button" key={effect.id} aria-pressed={current?.id===effect.id}
      onClick={()=>setChosen(effect.id)}
      className={`flex w-full items-center justify-between gap-3 rounded-lg px-3 py-3 text-right ${current?.id===effect.id?'bg-cyan-950 outline outline-1 outline-cyan-500':'bg-slate-900 hover:bg-slate-800'}`}>
       <span className="min-w-0"><span className="block text-sm font-semibold">{effect.name}</span>
        <span className="block truncate text-[11px] text-slate-400" dir="ltr">{effect.id}</span></span>
       <span className="shrink-0 text-[11px] text-slate-300">{statusNames[effect.state]}</span>
      </button>)}
    </div>
    <div className="rounded-xl border border-slate-700 bg-slate-900 p-4">
     {current?<div className="space-y-4">
      <div><p className="text-xs text-cyan-300">{familyNames[current.family]}</p>
       <h3 className="mt-1 text-xl font-bold">{current.name}</h3>
       <p className="mt-1 text-xs text-slate-400" dir="ltr">{current.id}</p>
      </div>
      <dl className="grid grid-cols-2 gap-3 text-xs">
       <div><dt className="text-slate-400">حالة التطوير</dt><dd className="mt-1 font-semibold">{statusNames[current.state]}</dd></div>
       <div><dt className="text-slate-400">نوع العرض</dt><dd className="mt-1 font-semibold">{qualityNames[current.quality]}</dd></div>
       <div><dt className="text-slate-400">تتبّع الحركة</dt><dd className="mt-1 font-semibold" dir="ltr">{current.tracking}</dd></div>
       <div><dt className="text-slate-400">نقطة التثبيت</dt><dd className="mt-1 font-semibold" dir="ltr">{current.anchor??'—'}</dd></div>
      </dl>
      {current.assetUri&&<p className="break-all rounded-lg bg-slate-950 p-3 text-xs text-slate-300" dir="ltr">{current.assetUri}</p>}
      <h4 className="text-sm font-bold">قائمة فحص هذا المؤثر</h4>
      <ul className="space-y-2">
       {current.checks.map(check=><li key={check} className="flex gap-2 text-sm leading-6 text-slate-300">
        <span aria-hidden="true" className="mt-2 size-1.5 shrink-0 rounded-full bg-amber-400"/>
        <span>{checkNames[check]}</span>
       </li>)}
      </ul>
      <p className="border-t border-slate-700 pt-3 text-xs leading-6 text-slate-400">
       هذه البنود مهام فحص غير مُعتمدة حتى نجرب الفلتر على الكاميرا الحقيقية ونراجع التسجيل. لا تُخزَّن صور الوجوه في هذه اللوحة.
      </p>
     </div>:<p className="text-sm text-slate-400">اختر مؤثرًا من النتائج لعرض فحوصه.</p>}
    </div>
   </div>
  </section>
 )
}
