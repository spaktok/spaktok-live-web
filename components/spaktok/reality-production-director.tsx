'use client'
import {useEffect,useMemo,useState} from 'react'
import type {Dispatch,SetStateAction} from 'react'
import {
 reviewStudioProduction,validateStudioProductionPackage,
 STUDIO_ANCHORS,STUDIO_ASSET_TYPES,STUDIO_MOUNTS,
 type StudioProductionPackage,type StudioStageId,
} from '@/lib/filter-engine/reality-production-pipeline'
import {auditStudioGlbBytes} from '@/lib/filter-engine/reality-production-glb-audit'
import {saveLocalStudioGlb,REALITY_HANDOFF_MAX_BYTES} from '@/lib/filter-engine/reality-local-asset-handoff'
import RealityRodinHandoff from './reality-rodin-handoff'

const stages:Readonly<Record<StudioStageId,string>>={
 source:'الأصل',
 rights:'الحقوق',
 geometry:'الشبكة',
 materials:'الخامات',
 rig:'التحريك',
 placement:'التثبيت',
 'device-qa':'اختبار الهاتف',
 release:'المراجعة والنشر',
}
const errors:Readonly<Record<string,string>>={
 missing_source_file:'لم يتم اختيار صورة أو مجسم',
 rights_permission_required:'يلزم الإقرار بحقوق الاستخدام والإثبات عند الترخيص',
 requires_validated_self_contained_glb:'يلزم ملف GLB صحيح ومضمّن الموارد',
 pbr_uv_normals_not_verified:'الخامة وUV وNormals لم تُفحص كاملة',
 rig_or_expressions_not_verified:'ملف الوجه يحتاج Morph Targets وتجربة تعابير فعلية',
 device_attachment_not_verified:'موضع التثبيت يحتاج معايرة على الكاميرا',
 physical_device_quality_not_verified:'يلزم فحص الأداء والصورة على الهاتف',
 server_review_and_distribution_not_implemented:'النشر يحتاج خدمة مراجعة وموافقة منفصلة',
}
const download=(data:object,name:string)=>{
 const blob=new Blob([JSON.stringify(data,null,2)],{type:'application/json'})
 const url=URL.createObjectURL(blob)
 const link=document.createElement('a');link.href=url;link.download=name;link.click()
 window.setTimeout(()=>URL.revokeObjectURL(url),1500)
}
export default function RealityProductionDirector({
 file,project,setProject,
}:{
 file:File|null
 project:StudioProductionPackage
 setProject:Dispatch<SetStateAction<StudioProductionPackage>>
}){
 const [auditStatus,setAuditStatus]=useState('')
 const [handoffStatus,setHandoffStatus]=useState('')
 const review=useMemo(()=>{
  try{return reviewStudioProduction(project)}
  catch{return null}
 },[project])
 const patch=(part:Partial<StudioProductionPackage>)=>
  setProject(p=>({...p,...part}))
 const test=(key:keyof StudioProductionPackage['tests'],value:boolean)=>
  setProject(p=>({...p,tests:{...p.tests,[key]:value}}))
 useEffect(()=>{
  let cancelled=false
  if(!file||!/\.glb$/i.test(file.name))return
  setAuditStatus('جارٍ تحليل شبكة المجسم وخاماته…')
  file.arrayBuffer().then(bytes=>{
   const result=auditStudioGlbBytes(bytes)
   if(cancelled)return
   setProject(previous=>({
    ...previous,
    metrics:{
     triangleCount:result.triangles,materialCount:result.materials,
     uvReady:result.hasUV,normalReady:result.hasNormals,
     pbrReady:result.hasPBR,textureCount:result.textures,
     rigTargets:result.rigTargets,animationCount:result.animations,
     selfContained:result.selfContained,validated:result.valid,
    },
    quality:result.valid?'technical-preview':'reference-only',
   }))
   setAuditStatus(`مثلثات حقيقية: ${result.triangles.toLocaleString('en-US')} · خامات: ${result.materials} · Morph Targets: ${result.rigTargets} · ${result.valid?'GLB سليم بنيويًا':'هناك مشاكل في الملف'}${result.warnings.length?' · تحذيرات: '+result.warnings.join('، '):''}`)
  }).catch(error=>{
   if(cancelled)return
   setAuditStatus('تعذر فحص GLB: '+String(error))
   setProject(p=>({...p,metrics:{...p.metrics,validated:false}}))
  })
  return()=>{cancelled=true}
 },[file,setProject])
 const exportDraft=()=>{
  try{
   validateStudioProductionPackage(project)
   if(!review?.mayExportCandidate){
    setHandoffStatus('يجب تأكيد الحقوق ومراجعة الأصل قبل تصدير مسودة إنتاج.')
    return
   }
   download({...project,review,disclaimer:'Draft only: no asset bytes, publishing or redistribution'},
    'spaktok-'+project.title.toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'').slice(0,45)+'.production.json')
   setHandoffStatus('تم تنزيل مسودة المشروع؛ لم تُرفع الصور أو المجسمات إلى أي خادم.')
  }catch(error){setHandoffStatus('لا يمكن تصدير المشروع: '+String(error))}
 }
 const sendToAvatar=async()=>{
  if(!file||!review?.mayExportCandidate||
   project.sourceFormat!=='glb'||!project.metrics.validated||
   file.size>REALITY_HANDOFF_MAX_BYTES){
   setHandoffStatus('يلزم GLB صالح لا يتجاوز 15MB ومصرّح باستخدامه.')
   return
  }
  setHandoffStatus('التحضير لتسليم GLB داخل هذا المتصفح…')
  try{
   await saveLocalStudioGlb(file.name,await file.arrayBuffer())
   window.location.assign('/avatar-studio')
  }catch(error){setHandoffStatus('تعذّر التسليم المحلي: '+String(error))}
 }
 return <section id="production-director" dir="rtl"
  className="mx-auto mb-7 max-w-7xl space-y-5 rounded-2xl border border-cyan-400/30 bg-[#101b2d] p-4 text-white shadow-xl sm:p-6">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <p className="text-xs font-bold text-cyan-200">SpakTok Studio • Production Director V1</p>
    <h2 className="mt-1 text-xl font-bold">خط الإنتاج الموحد: من الصورة إلى المجسم ثم الكاميرا واللايف والفيديو</h2>
    <p className="mt-2 max-w-3xl text-xs leading-6 text-slate-300">
     سير واحد ينسّق المحررات الموجودة. الصورة تتحول مبدئيًا إلى وجه قياسي بخامة أمامية،
     أما بناء رأس دقيق وشعر وظهر ومجسم متحرك فعلي فيحتاج نحتًا وRig ومراجعة إضافية.
    </p>
   </div>
   <p className="rounded-xl bg-slate-950 px-4 py-2 text-xs font-semibold text-cyan-200">
    {review?.completeness??0}% من مراحل المراجعة الفنية
   </p>
  </div>
  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
   {review?.steps.map((step,i)=><div key={step.id}
    className={'rounded-xl border p-2 text-xs '+(step.status==='ready'?
     'border-emerald-600/50 bg-emerald-900/15':
     step.status==='blocked'?'border-amber-500/30 bg-amber-900/15':'border-slate-600 bg-slate-950/60')}>
    <p className="font-semibold">{i+1}. {stages[step.id]}</p>
    <p className="mt-1 text-[11px] text-slate-300">{step.status==='ready'?'جاهز للفحص التالي':step.issues.map(e=>errors[e]??e).join('، ')}</p>
   </div>)}
  </div>
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
   <label className="block text-xs font-semibold">اسم الحزمة
    <input value={project.title} maxLength={120} onChange={e=>patch({title:e.target.value})}
     className="mt-2 w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-sm"/>
   </label>
   <label className="block text-xs font-semibold">نوع الأصل
    <select value={project.assetType}
     onChange={e=>patch({assetType:e.target.value as StudioProductionPackage['assetType']})}
     className="mt-2 w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-sm">
     {STUDIO_ASSET_TYPES.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
    </select>
   </label>
   <label className="block text-xs font-semibold">حقوق استخدام الصورة والمجسم
    <select value={project.rights}
     onChange={e=>patch({rights:e.target.value as StudioProductionPackage['rights']})}
     className="mt-2 w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-sm">
     <option value="unverified">غير مؤكدة — يمنع تصدير الحزمة</option>
     <option value="original">من إنشائي وأملك حقوق استخدامه</option>
     <option value="licensed">لدي إذن أو ترخيص مناسب</option>
    </select>
   </label>
   <label className="block text-xs font-semibold">موضع المجسم
    <select value={project.mount}
     onChange={e=>{
      const next=e.target.value as StudioProductionPackage['mount']
      patch({mount:next,anchor:next==='screen'||next==='body'?null:'nose_bridge'})
     }}
     className="mt-2 w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-sm">
     {STUDIO_MOUNTS.map(t=><option key={t.value} value={t.value}>{t.label}</option>)}
    </select>
   </label>
   <label className="block text-xs font-semibold">نقطة الارتباط
    <select value={project.anchor??''} disabled={project.mount==='screen'||project.mount==='body'}
     onChange={e=>patch({anchor:e.target.value as StudioProductionPackage['anchor']})}
     className="mt-2 w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-sm disabled:opacity-40">
     {project.anchor===null&&<option value="">غير مرتبط بنقطة وجه</option>}
     {STUDIO_ANCHORS.map(anchor=><option key={anchor} value={anchor}>{anchor}</option>)}
    </select>
   </label>
   <label className="block text-xs font-semibold">إثبات الترخيص (عند استخدام أصل مرخّص)
    <input value={project.rightsEvidence} maxLength={800}
     onChange={e=>patch({rightsEvidence:e.target.value})}
     placeholder="اسم الرخصة أو المرجع القانوني، لا تدخل كلمات مرور أو بيانات شخصية"
     className="mt-2 w-full rounded-lg border border-white/20 bg-slate-950 p-2 text-sm"/>
   </label>
  </div>
  <label className="flex items-start gap-2 text-xs leading-6 text-slate-200">
   <input type="checkbox" checked={project.tests.sourceReviewed}
    onChange={e=>test('sourceReviewed',e.target.checked)} className="mt-1"/>
   راجعت مصدر الصورة أو المجسم وأملك صلاحية استخدامها تجاريًا. تغيير ألوان صورة محمية لا يلغي حقوقها.
  </label>
  {file&&<p className="rounded-lg bg-slate-950 p-3 text-xs text-cyan-100">
   الملف الحالي: {file.name} · {(file.size/1024/1024).toFixed(2)} MB · {auditStatus||'يمكنك فحص المصدر في المحرر أدناه'}
  </p>}
  <div className="grid gap-2 sm:grid-cols-2">
   <label className="flex items-center gap-2 text-xs">
    <input type="checkbox" checked={project.tests.animationVerified}
     onChange={e=>test('animationVerified',e.target.checked)}/>
    تحققت من تعابير الوجه على نموذج حقيقي
   </label>
   <label className="flex items-center gap-2 text-xs">
    <input type="checkbox" checked={project.tests.mobileVisualApproved}
     onChange={e=>test('mobileVisualApproved',e.target.checked)}/>
    تحققت بصريًا من المطابقة على هاتف فعلي
   </label>
   <label className="flex items-center gap-2 text-xs">
    <input type="checkbox" checked={project.tests.deviceFpsVerified}
     onChange={e=>test('deviceFpsVerified',e.target.checked)}/>
    تحققت من FPS والحرارة أثناء المعاينة
   </label>
  </div>
  <RealityRodinHandoff project={project} sourceFile={file}/>
  <div className="flex flex-wrap gap-2">
   <button type="button" onClick={exportDraft} disabled={!review?.mayExportCandidate}
    className="rounded-lg bg-cyan-400 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-40">
    تصدير مسودة خط الإنتاج JSON
   </button>
   <button type="button" onClick={sendToAvatar}
    disabled={!file||project.sourceFormat!=='glb'||!review?.mayExportCandidate||!project.metrics.validated||file.size>REALITY_HANDOFF_MAX_BYTES}
    className="rounded-lg bg-indigo-600 px-4 py-2 text-xs font-bold text-white disabled:opacity-40">
    نقل GLB محليًا إلى Avatar Studio
   </button>
   <a href="/live-studio-preview" className="rounded-lg border border-slate-600 px-4 py-2 text-xs">فحص الكاميرا واللايف</a>
   <a href="/video-studio" className="rounded-lg border border-slate-600 px-4 py-2 text-xs">فحص الفيديو</a>
  </div>
  {handoffStatus&&<p role="status" className="text-xs leading-6 text-cyan-200">{handoffStatus}</p>}
  <p className="text-[11px] leading-6 text-amber-200">
   الاعتماد النهائي غير متاح تلقائيًا؛ فحص GLB البنيوي لا يثبت الجمال أو أمان الحقوق أو جودة الحركة.
   لا تُرفع ملفاتك عند التسليم المحلي بين هذه الصفحات، لكن التخزين المحلي غير مشفّر ويجب إزالته على الأجهزة المشتركة.
  </p>
 </section>
}
