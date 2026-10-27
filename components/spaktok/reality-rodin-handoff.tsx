'use client'
import {useState} from 'react'
import {
 createRodinGenerationDraft,RODIN_WORKSPACE_URL,RODIN_DOCS_URL,
 type RodinTier,type RodinMesh,type RodinQuality,type RodinTexture,
} from '@/lib/filter-engine/reality-rodin-integration'
import type {StudioProductionPackage} from '@/lib/filter-engine/reality-production-pipeline'

/** Human-in-the-loop bridge for provider generation; no secrets, API uploads,
 * remote calls or payments are made by this component.
 */
export default function RealityRodinHandoff({
 project,sourceFile,
}:Readonly<{project:StudioProductionPackage;sourceFile:File|null}>){
 const [tier,setTier]=useState<RodinTier>('Gen-2.5-Medium')
 const [mesh,setMesh]=useState<RodinMesh>('Quad')
 const [quality,setQuality]=useState<RodinQuality>('medium')
 const [material,setMaterial]=useState<RodinTexture>('PBR')
 const [status,setStatus]=useState('')
 const [approved,setApproved]=useState(false)
 const eligible=project.rights!=='unverified'&&
  project.tests.sourceReviewed&&sourceFile!==null&&
  project.sourceFormat==='image'
 const makeDraft=()=>{
  try{
   if(!eligible||!approved)
    throw Error('يجب اختيار صورة تملك حقوقها والموافقة على إرسالها إلى Rodin يدويًا.')
   const draft=createRodinGenerationDraft({
    assetType:project.assetType,rights:project.rights,
    filenames:[sourceFile!.name],tier,mesh,quality,material,
   })
   const blob=new Blob([JSON.stringify(draft,null,2)],
    {type:'application/json'})
   const url=URL.createObjectURL(blob)
   const a=document.createElement('a')
   a.href=url;a.download='spaktok-rodin-generation-draft.json'
   a.click()
   setTimeout(()=>URL.revokeObjectURL(url),1000)
   setStatus('حُفظت إعدادات Rodin محليًا. لم تُرفع صورتك، ولم يبدأ توليد مدفوع.')
  }catch(e){setStatus(e instanceof Error?e.message:'تعذّر تجهيز الملف')}
 }
 return <section dir="rtl" className="space-y-3 rounded-xl border border-violet-400/35 bg-violet-950/20 p-4">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <p className="text-xs font-semibold text-violet-200">Optional external provider • Rodin Gen-2.5</p>
    <h3 className="mt-1 text-base font-bold">توليد مجسم حقيقي من الصورة باستخدام Hyper3D Rodin</h3>
   </div>
   <a href={RODIN_WORKSPACE_URL} target="_blank" rel="noopener noreferrer"
    className="rounded-lg border border-violet-300/40 bg-violet-800/30 px-3 py-2 text-xs font-semibold text-white">
    فتح Hyper3D Rodin
   </a>
  </div>
  <p className="text-xs leading-6 text-slate-300">
   Rodin مزود خارجي. نحضّر إعدادات التوليد في Spaktok فقط؛ ترفع الصورة إليه بنفسك بعد الموافقة
   على سياسة الخصوصية والتكلفة. بعد تنزيل GLB استورده هنا لفحص الشبكة وخامات PBR وتجهيز التحريك.
   لا يحتوي هذا المسار على مفتاح API ولا يرسل صورًا تلقائيًا.
  </p>
  <div className="grid gap-3 sm:grid-cols-2">
   <label className="text-xs text-slate-300">جودة النموذج
    <select value={tier} onChange={e=>setTier(e.target.value as RodinTier)}
     className="mt-1 block w-full rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-white">
     <option value="Gen-2.5-Low">Gen-2.5 Low</option>
     <option value="Gen-2.5-Medium">Gen-2.5 Medium</option>
     <option value="Gen-2.5-High">Gen-2.5 High</option>
    </select>
   </label>
   <label className="text-xs text-slate-300">هندسة الشبكة
    <select value={mesh} onChange={e=>setMesh(e.target.value as RodinMesh)}
     className="mt-1 block w-full rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-white">
     <option value="Quad">Quad — للتحرير وإعادة تشكيل الوجه</option>
     <option value="Raw">Raw — مثلثات تفصيلية</option>
    </select>
   </label>
   <label className="text-xs text-slate-300">عدد المضلعات المستهدف
    <select value={quality} onChange={e=>setQuality(e.target.value as RodinQuality)}
     className="mt-1 block w-full rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-white">
     <option value="extra-low">Extra Low</option>
     <option value="low">Low</option>
     <option value="medium">Medium</option>
     <option value="high">High</option>
    </select>
   </label>
   <label className="text-xs text-slate-300">الخامات
    <select value={material} onChange={e=>setMaterial(e.target.value as RodinTexture)}
     className="mt-1 block w-full rounded-lg border border-white/20 bg-slate-950 px-3 py-2 text-white">
     <option value="PBR">PBR — مواد فيزيائية</option>
     <option value="All">All — PBR + Shaded</option>
     <option value="Shaded">Shaded — لون مع إضاءة مدمجة</option>
    </select>
   </label>
  </div>
  <label className="flex items-start gap-2 text-xs leading-6 text-slate-300">
   <input type="checkbox" checked={approved} onChange={e=>setApproved(e.target.checked)} className="mt-1"/>
   أعلم أن إرسال الصور خارج Spaktok إلى Rodin يحدث فقط عندما أرفعها بنفسي هناك،
   ويتطلب مراجعة الحقوق والخصوصية وأسعار المزود أولًا.
  </label>
  <div className="flex flex-wrap items-center gap-3">
   <button type="button" disabled={!eligible||!approved} onClick={makeDraft}
    className="rounded-lg bg-violet-500 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">
    تنزيل إعدادات توليد Rodin (JSON)
   </button>
   <a href={RODIN_DOCS_URL} target="_blank" rel="noopener noreferrer"
    className="text-xs text-violet-200 underline">التوثيق الرسمي</a>
  </div>
  {!eligible&&<p className="text-xs text-amber-200">
   فعّل مصدر صورة مرخّصًا أو أصليًا من المحرر، وأكّد مراجعته قبل تحضير طلب التوليد.
  </p>}
  <p className="text-[11px] leading-5 text-slate-400">
   يولّد هذا المسار مجسمًا منفصلًا ولا يضمن إنشاء ARKit Blend Shapes للرمش والفم؛
   مطابقة الصور المرجعية، وفحص Rig، وتحسين المجسم للهاتف، مراحل إلزامية قبل اللايف.
  </p>
  {status&&<p role="status" className="text-xs text-cyan-100">{status}</p>}
 </section>
}
