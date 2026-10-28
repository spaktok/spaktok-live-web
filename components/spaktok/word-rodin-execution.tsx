'use client'
import {useEffect,useState} from 'react'
import type {StudioProductionPackage} from '@/lib/filter-engine/reality-production-pipeline'

type Config={configured:boolean;fixedCredits:number|null;model:string}
type Status={id:string;status:string;hasAsset?:boolean;error?:string|null}
export default function WordRodinExecution({
 project,file,
}:Readonly<{project:StudioProductionPackage;file:File|null}>){
 const [config,setConfig]=useState<Config|null>(null)
 const [sendConsent,setSendConsent]=useState(false)
 const [chargeConsent,setChargeConsent]=useState(false)
 const [job,setJob]=useState<Status|null>(null)
 const [busy,setBusy]=useState(false)
 const [message,setMessage]=useState('')
 const [idempotency,setIdempotency]=useState('')
 useEffect(()=>{
  let valid=true
  fetch('/api/spaktok-word/rodin?health=1',{cache:'no-store'})
   .then(x=>x.json()).then(x=>{if(valid)setConfig(x as Config)})
   .catch(()=>{if(valid)setConfig({configured:false,fixedCredits:null,model:'Gen-2.5-Medium'})})
  return()=>{valid=false}
 },[])
 useEffect(()=>{
  setSendConsent(false);setChargeConsent(false);setJob(null)
  setIdempotency(crypto.randomUUID().replace(/-/g,''))
  setMessage('')
 },[file])
 const permitted=file!==null&&project.sourceFormat==='image'&&
  (project.rights==='original'||project.rights==='licensed')&&
  project.tests.sourceReviewed&&
  (project.rights==='original'||project.rightsEvidence.trim().length>=12)
 const enabled=permitted&&config?.configured===true&&
  config.fixedCredits!==null&&sendConsent&&chargeConsent&&!busy&&!job
 const create=async()=>{
  if(!enabled||!file||!config?.fixedCredits)return
  setBusy(true);setMessage('إرسال مهمة واحدة مع الموافقات الحالية…')
  try{
   const form=new FormData()
   form.set('image',file)
   form.set('rights',project.rights)
   form.set('idempotency',idempotency)
   form.set('approvedCredits',String(config.fixedCredits))
   form.set('acceptTerms','yes')
   form.set('confirmCharge','yes')
   const r=await fetch('/api/spaktok-word/rodin',{
    method:'POST',body:form,credentials:'same-origin',
   })
   const payload=await r.json()
   if(!r.ok)throw Error(payload.error??'submission_error')
   setJob(payload as Status)
   setMessage('تم تسجيل المهمة على Cloudflare. ستُراجع النتيجة قبل أي نشر.')
  }catch(e){setMessage(e instanceof Error?e.message:'submission_unavailable')}
  finally{setBusy(false)}
 }
 const refresh=async()=>{
  if(!job)return
  setBusy(true)
  try{
   const r=await fetch('/api/spaktok-word/rodin?id='+encodeURIComponent(job.id),{
    cache:'no-store',credentials:'same-origin',
   })
   const data=await r.json()
   if(!r.ok)throw Error(data.error??'status_error')
   setJob(data as Status)
   setMessage(data.status==='needs_review'?
    'وصل GLB إلى التخزين الخاص. نزّله وافحص Geometry وPBR وRig في الاستوديو.':
    'حالة المهمة: '+data.status)
  }catch(e){setMessage(e instanceof Error?e.message:'status_unavailable')}
  finally{setBusy(false)}
 }
 return <div dir="rtl" className="space-y-3 rounded-xl border border-cyan-400/25 bg-slate-950/80 p-4 text-sm">
  <h4 className="font-bold text-cyan-100">Spaktok Word — توليد Rodin المباشر (Cloudflare)</h4>
  <p className="text-xs leading-6 text-slate-300">
   هذه هي بوابة التوليد الحقيقية، وليست تصدير JSON. تدعم صورة PNG/JPEG أصلية أو مرخّصة،
   ومهمة واحدة بعرض مسبق للتكلفة. مفاتيح المزود تبقى في Cloudflare فقط.
  </p>
  <p className="text-xs font-semibold text-amber-200">
   {config===null?'التحقق من إعداد الخادم…':
    config.configured?
     'البوابة مهيأة؛ الرصيد المعتمد لهذه المهمة: '+config.fixedCredits+' credits.':
     'البوابة المدفوعة غير مفعلة: يلزم مفتاح Rodin وخدمات D1/R2/Queue وعرض تكلفة معتمد.'}
  </p>
  {config?.configured&&<>
   <p className="text-xs text-slate-300">الإعداد المعتمد: Gen-2.5 Medium · Quad · PBR · GLB</p>
   <label className="flex items-start gap-2 text-xs leading-6 text-white/85">
    <input type="checkbox" checked={sendConsent}
     onChange={e=>setSendConsent(e.target.checked)} className="mt-1"/>
    أملك حقوق استخدام هذه الصورة وأوافق على نقلها إلى Hyper3D Rodin لمعالجتها خارجيًا.
   </label>
   <label className="flex items-start gap-2 text-xs leading-6 text-amber-100">
    <input type="checkbox" checked={chargeConsent}
     onChange={e=>setChargeConsent(e.target.checked)} className="mt-1"/>
    أوافق صراحة على استهلاك رصيد Rodin لهذه المهمة وفق التكلفة التي عرضها المشغّل،
    وقد راجعت أسعار المزود وشروطه ({config.fixedCredits} رصيد معتمد).
   </label>
   {!permitted&&<p className="text-xs text-rose-200">
    لا يمكن الإرسال قبل اختيار صورة وتأكيد حقوق استخدامها والمراجعة.
   </p>}
   {!job&&<button type="button" onClick={create} disabled={!enabled}
    className="rounded-lg bg-cyan-500 px-4 py-2 text-xs font-bold text-slate-950 disabled:opacity-40">
    {busy?'جارٍ الإرسال…':'إرسال مهمة Rodin المعتمدة'}
   </button>}
  </>}
  {job&&<div className="space-y-2 rounded-lg border border-white/15 p-3 text-xs">
   <p>معرّف المهمة: <code>{job.id}</code></p>
   <p>الحالة: <strong>{job.status}</strong></p>
   {job.error&&<p className="text-amber-200">رمز التنبيه: {job.error}</p>}
   <button type="button" disabled={busy} onClick={refresh}
    className="rounded-lg bg-white/15 px-3 py-2 font-semibold disabled:opacity-40">
    تحديث حالة المهمة
   </button>
   {job.hasAsset&&<a href={'/api/spaktok-word/rodin?id='+encodeURIComponent(job.id)+'&asset=1'}
    className="mr-2 inline-block rounded-lg bg-emerald-600 px-3 py-2 font-bold text-white">
    تنزيل GLB الخاص لإرساله إلى فحص الاستوديو
   </a>}
  </div>}
  {message&&<p role="status" className="text-xs text-cyan-200">{message}</p>}
 </div>
}
