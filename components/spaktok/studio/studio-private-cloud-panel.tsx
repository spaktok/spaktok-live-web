'use client'
import {useCallback,useEffect,useState} from 'react'
import type {StudioFanoutManifest} from '@/lib/filter-engine/spaktok-studio-fanout'
import {DIRECTOR_TARGETS,type DirectorTarget} from '@/lib/filter-engine/spaktok-ai-director'
import {
 listPrivateCloudDrafts,uploadPrivateStudioDraft,downloadPrivateStudioDraft,
 deletePrivateStudioDraft,type PrivateCloudDraft,
} from '@/lib/filter-engine/spaktok-studio-private-cloud'

/** Explicit opt-in Cloudflare R2 persistence; NEVER silently sends creator
 * likenesses or files to a cloud backend. Local fanout works with R2 off.
 */
export default function StudioPrivateCloudPanel({
 asset,manifest,rightsApproved,onRestore,
}:Readonly<{
 asset:File|null
 manifest:StudioFanoutManifest|null
 rightsApproved:boolean
 onRestore:(file:File,targets:readonly DirectorTarget[])=>void
}>){
 const [configured,setConfigured]=useState(false)
 const [loading,setLoading]=useState(false)
 const [drafts,setDrafts]=useState<PrivateCloudDraft[]>([])
 const [consent,setConsent]=useState(false)
 const [status,setStatus]=useState('')
 const refresh=useCallback(async()=>{
  try{
   const records=await listPrivateCloudDrafts()
   setConfigured(records!==null)
   setDrafts(records??[])
  }catch(error){
   setConfigured(false)
   setStatus('يحتاج الحفظ السحابي إلى تسجيل الدخول وإعداد Worker خاص: '+String(error))
  }
 },[])
 useEffect(()=>{void refresh()},[refresh])
 useEffect(()=>{setConsent(false)},[asset])
 const upload=async()=>{
  if(!asset||!manifest||!rightsApproved||!consent||loading||!configured)return
  setLoading(true)
  try{
   const id=await uploadPrivateStudioDraft(asset,manifest)
   setConsent(false)
   setStatus('تم حفظ مسودة GLB على R2 الخاص وربطها بحسابك دون نشرها. رقم المهمة: '+id)
   await refresh()
  }catch(error){
   setStatus('لم يكتمل الحفظ السحابي: '+String(error)+
    '. لا تكرر الرفع تلقائيًا؛ قد تكون هناك حجز مهمة غير مؤكدة.')
  }finally{setLoading(false)}
 }
 const restore=async(draft:PrivateCloudDraft)=>{
  if(loading)return
  setLoading(true)
  try{
   const file=await downloadPrivateStudioDraft(draft.id,draft.sha256,draft.bytes)
   const targets=draft.targets.filter(
    (t):t is DirectorTarget=>DIRECTOR_TARGETS.includes(t as DirectorTarget))
   if(!targets.length)throw Error('studio_cloud_no_targets')
   onRestore(file,targets)
   setStatus('تم تنزيل GLB خاص ومطابقة SHA-256. أكّد حقوق المصدر ثم افحصه عبر AI Director لتوزيعه مجددًا.')
  }catch(error){setStatus('تعذرت استعادة المسودة: '+String(error))}
  finally{setLoading(false)}
 }
 const remove=async(draft:PrivateCloudDraft)=>{
  if(loading||!window.confirm('هل تريد حذف هذا المجسم نهائيًا من Cloudflare R2؟'))return
  setLoading(true)
  try{
   await deletePrivateStudioDraft(draft.id)
   await refresh()
   setStatus('حُذفت المسودة السحابية من R2 وسجل D1؛ ملفات جهازك لم تتغير.')
  }catch(error){setStatus('تعذّر حذف المسودة: '+String(error))}
  finally{setLoading(false)}
 }
 return <section dir="rtl" className="space-y-3 rounded-xl border border-cyan-300/20 bg-slate-950/50 p-3 text-xs">
  <div className="flex items-center justify-between gap-2">
   <h3 className="font-semibold text-cyan-200">Cloudflare R2 — مسودات 3D خاصة</h3>
   <button type="button" onClick={()=>void refresh()} disabled={loading}
    className="rounded-lg border border-white/20 px-2 py-1 disabled:opacity-50">
    تحديث الحالة
   </button>
  </div>
  <p className="leading-6 text-slate-300">
   {configured?
    'التخزين السحابي الخاص متصل بالإعدادات. نقل GLB يتطلب موافقتك المنفصلة، ولا ينشره للجمهور.':
    'التخزين السحابي لم يُفعّل بعد؛ يظل التوزيع المحلي بين الأقسام متاحًا لمدة 24 ساعة.'}
  </p>
  {configured&&asset&&manifest&&<div className="space-y-2">
   <label className="flex items-start gap-2">
    <input type="checkbox" checked={consent}
     onChange={e=>setConsent(e.target.checked)} className="mt-1"/>
    أوافق على حفظ هذا GLB في Cloudflare R2 الخاص بحسابي، للاستخدام في أجهزة أخرى.
   </label>
   <button type="button" onClick={()=>void upload()}
    disabled={loading||!consent||!rightsApproved||asset.size>15*1024*1024}
    className="rounded-lg bg-cyan-700 px-3 py-2 font-bold text-white disabled:opacity-40">
    حفظ GLB خاص على Cloudflare
   </button>
  </div>}
  {configured&&drafts.length>0&&<div className="space-y-2">
   <p className="font-semibold">آخر المسودات المحفوظة لحسابك</p>
   {drafts.map(draft=><div key={draft.id}
    className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-white/15 p-2">
    <span className="break-all text-slate-300">
     {draft.createdAt} · {(draft.bytes/1048576).toFixed(2)} MiB
    </span>
    <div className="flex gap-2">
     <button type="button" disabled={loading} onClick={()=>void restore(draft)}
      className="rounded border border-cyan-400/40 px-2 py-1 disabled:opacity-40">
      استعادة وفحص
     </button>
     <button type="button" disabled={loading} onClick={()=>void remove(draft)}
      className="rounded border border-rose-400/40 px-2 py-1 text-rose-300 disabled:opacity-40">
      حذف دائم
     </button>
    </div>
   </div>)}
  </div>}
  {status&&<p role="status" className="break-words text-amber-200">{status}</p>}
 </section>
}
