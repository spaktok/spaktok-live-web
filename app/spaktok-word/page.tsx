'use client'
import {useState,type ChangeEvent} from 'react'
import Link from 'next/link'
import RealityProductionDirector from '@/components/spaktok/reality-production-director'
import SpaktokForge from '@/components/spaktok/spaktok-forge'
import {
 createStudioProductionPackage,withStudioProductionSource,
} from '@/lib/filter-engine/reality-production-pipeline'

/** Dedicated Spaktok Word portal, sharing the SAME Production Director and
 * graph as /reality-studio. Files stay in the local browser memory.
 */
export default function SpaktokWordPage(){
 const [file,setFile]=useState<File|null>(null)
 const [project,setProject]=useState(createStudioProductionPackage)
 const [notice,setNotice]=useState('')
 const acceptGenerated=(asset:File)=>{
  // A provider result has DIFFERENT source provenance: never inherit the
  // portrait's original/licensed status or prior visual approval silently.
  setProject(previous=>withStudioProductionSource(previous,
   asset.name,asset.size,'glb'))
  setFile(asset)
  setNotice('وصل GLB إلى Spaktok Word وأصبح قيد فحص الشبكة والخامات. '+
   'أكّد حقوق المجسم الناتج مرة أخرى قبل أي تصدير أو مشاركة. '+
   'فحص الهاتف وRig ما زالا مطلوبين.')
 }
 const change=(event:ChangeEvent<HTMLInputElement>)=>{
  const next=event.target.files?.[0]
  event.target.value=''
  if(!next)return
  const image=/\.(png|jpe?g|webp)$/i.test(next.name)
  const obj=/\.obj$/i.test(next.name)
  const glb=/\.glb$/i.test(next.name)
  if(!image&&!glb&&!obj){setNotice('صيغة غير مدعومة. اختر PNG أو JPEG أو WEBP أو GLB أو OBJ.');return}
  if(next.size===0||next.size>(image?12:35)*1024*1024){
   setNotice('حجم غير مدعوم: الصور حتى 12MB، والمجسمات حتى 35MB.');return
  }
  try{
   const type=image?'image':obj?'obj':'glb'
   setProject(prev=>withStudioProductionSource(prev,next.name,next.size,type))
   setFile(next)
   setNotice('المصدر محلي. راجع الحقوق ثم شغّل الفحوص المتوازية من لوحة Spaktok Word.')
  }catch{
   setNotice('تعذّر فحص مواصفات الملف.')
  }
 }
 return <main dir="rtl" className="min-h-screen bg-[#080c16] px-4 py-8 text-white">
  <header className="mx-auto mb-6 max-w-7xl space-y-3">
   <p className="text-xs font-bold tracking-widest text-violet-300">SPAKTOK WORD • Unified Creative Production</p>
   <h1 className="text-3xl font-black sm:text-4xl">Spaktok Word — منصة الربط المتوازي</h1>
   <p className="max-w-3xl text-sm leading-7 text-slate-300">
    مركز موحد لإدارة إنتاج المجسمات: من الصورة إلى Rodin والشبكات والخامات والتحريك
    ثم الكاميرا والفيديو واللايف. جميع الفحوص المتاحة محليًا؛ الخدمات المدفوعة تحتاج
    موافقة وربطًا منفصلًا.
   </p>
   <div className="flex flex-wrap gap-2 text-xs">
    <Link href="/reality-studio" className="rounded-lg border border-white/20 px-3 py-2 text-cyan-200">
     العودة إلى Reality Studio
    </Link>
    <Link href="/avatar-studio" className="rounded-lg border border-white/20 px-3 py-2 text-cyan-200">
     Avatar Studio
    </Link>
   </div>
  </header>
  <section className="mx-auto mb-6 max-w-7xl rounded-2xl border border-violet-400/30 bg-[#10172a] p-5">
   <label className="block text-sm font-bold">1. أصل مشروع Spaktok Word
    <input type="file" accept=".png,.jpg,.jpeg,.webp,.glb,.obj"
     onChange={change} className="mt-3 block w-full rounded-xl border border-violet-400/30 bg-slate-950 p-3 text-xs text-white"/>
   </label>
   <p className="mt-2 text-xs leading-6 text-slate-300">
    الملف لا يُرفع تلقائيًا. عند استبدال الأصل تُعاد الحقوق ونتائج الفحص إلى وضع غير معتمد.
    لا ترفع مادة محمية إلا بعد التحقق من حقوق استخدامها.
   </p>
   {file&&<p className="mt-2 text-xs text-cyan-200">الملف: {file.name} — {(file.size/1024/1024).toFixed(2)} MB</p>}
   {notice&&<p role="status" className="mt-2 text-xs text-amber-100">{notice}</p>}
  </section>
  <SpaktokForge sourceFile={file} onGeneratedGlb={acceptGenerated}/>
  <RealityProductionDirector file={file} project={project} setProject={setProject} onGeneratedGlb={acceptGenerated}/>
 </main>
}
