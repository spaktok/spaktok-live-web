'use client'

import {useEffect,useRef,useState} from 'react'

const MAX_UPLOAD=4*1024*1024
const MAX_RESULT=256*1024*1024
const POLL_MS=4000
const PROFILES={
 'studio-hd':{label:'Studio HD · 1024 · نسيج 2K',budgets:[50000,120000,200000,300000]},
 'studio-ultra':{label:'Studio Ultra · 1536 · نسيج 4K',budgets:[120000,200000,300000,500000]},
} as const
type Profile=keyof typeof PROFILES
type JobState='queued'|'running'|'succeeded'|'failed'|'expired'
interface JobView{state:JobState;queuePosition?:number;error?:string|null;bytes?:number|null;sha256?:string|null}

const STATE_AR:Record<JobState,string>={
 queued:'في الطابور',running:'يُولَّد على A100',succeeded:'اكتمل',
 failed:'فشل',expired:'انتهت صلاحية المهمة',
}
const sleep=(ms:number,signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
 const t=window.setTimeout(resolve,ms)
 signal.addEventListener('abort',()=>{window.clearTimeout(t);reject(Error('aborted'))},{once:true})
})

/** Shrinks oversize photos below the 4MB Vercel request cap, preserving the
 * longest edge up to 2048px (TRELLIS.2 conditions at 518-1024px anyway). */
async function fitForUpload(file:File):Promise<File>{
 if(file.size<=MAX_UPLOAD)return file
 const bitmap=await createImageBitmap(file)
 try{
  for(const edge of [2048,1600,1280]){
   const k=Math.min(1,edge/Math.max(bitmap.width,bitmap.height))
   const canvas=document.createElement('canvas')
   canvas.width=Math.round(bitmap.width*k);canvas.height=Math.round(bitmap.height*k)
   canvas.getContext('2d')?.drawImage(bitmap,0,0,canvas.width,canvas.height)
   const blob=await new Promise<Blob|null>(r=>canvas.toBlob(r,'image/webp',.92))
   if(blob&&blob.size<=MAX_UPLOAD)return new File([blob],'source.webp',{type:'image/webp'})
  }
 }finally{bitmap.close()}
 throw Error('forge_job_image_too_large')
}

async function sha256Hex(buffer:ArrayBuffer){
 const digest=await crypto.subtle.digest('SHA-256',buffer)
 return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('')
}

export default function SpaktokForgeStudioJob({
 source,rights,approved,disabled,onResult,
}:Readonly<{
 source:File|null
 rights:'original'|'licensed'
 approved:boolean
 disabled:boolean
 onResult:(file:File)=>void
}>){
 const [profile,setProfile]=useState<Profile>('studio-hd')
 const [budget,setBudget]=useState<number>(200000)
 const [consent,setConsent]=useState(false)
 const [job,setJob]=useState<JobView|null>(null)
 const [running,setRunning]=useState(false)
 const [note,setNote]=useState('')
 const abortRef=useRef<AbortController|null>(null)
 useEffect(()=>()=>abortRef.current?.abort(),[])

 const pickProfile=(next:Profile)=>{
  setProfile(next)
  const budgets:readonly number[]=PROFILES[next].budgets
  if(!budgets.includes(budget))setBudget(budgets[budgets.length-1])
 }

 const start=async()=>{
  if(!source||!approved||!consent||running||disabled)return
  const controller=new AbortController()
  abortRef.current?.abort();abortRef.current=controller
  setRunning(true);setJob(null);setNote('تجهيز الصورة وإرسال المهمة إلى A100…')
  try{
   const image=await fitForUpload(source)
   const form=new FormData()
   form.set('image',image);form.set('profile',profile);form.set('polyBudget',String(budget))
   form.set('rights',rights);form.set('approveCompute','yes');form.set('approveTransfer','yes')
   const submit=await fetch('/api/spaktok-forge/jobs',{
    method:'POST',body:form,cache:'no-store',signal:controller.signal,
   })
   const submitted=await submit.json().catch(()=>({}))
   if(!submit.ok||typeof submitted.handle!=='string')
    throw Error(String(submitted.error??'forge_job_submit_failed'))
   const handle:string=submitted.handle
   setJob(submitted.job);setNote('المهمة في الطابور. يمكنك ترك الصفحة مفتوحة أثناء التوليد.')

   for(;;){
    await sleep(POLL_MS,controller.signal)
    const r=await fetch('/api/spaktok-forge/jobs',{
     cache:'no-store',signal:controller.signal,
     headers:{'x-forge-job-handle':handle},
    })
    const data=await r.json().catch(()=>({}))
    if(!r.ok){
     if(r.status>=500)continue
     throw Error(String(data.error??'forge_job_status_failed'))
    }
    setJob(data.job)
    if(data.job.state==='failed')throw Error(String(data.job.error??'inference_exception'))
    if(data.job.state==='expired')throw Error('forge_job_expired')
    if(data.job.state!=='succeeded')continue
    if(typeof data.download?.url!=='string'||typeof data.download?.ticket!=='string')
     throw Error('forge_job_download_missing')
    setNote('تنزيل GLB مباشرة من A100 والتحقق من البصمة…')
    const g=await fetch(data.download.url,{
     cache:'no-store',redirect:'error',signal:controller.signal,
     headers:{authorization:'Bearer '+data.download.ticket},
    })
    if(!g.ok)throw Error('forge_job_download_failed')
    const bytes=await g.arrayBuffer()
    if(bytes.byteLength<20||bytes.byteLength>MAX_RESULT)throw Error('forge_job_result_size_invalid')
    if(new TextDecoder().decode(bytes.slice(0,4))!=='glTF')throw Error('forge_job_result_not_glb')
    if(data.job.sha256&&await sha256Hex(bytes)!==data.job.sha256)
     throw Error('forge_job_result_integrity_failed')
    onResult(new File([bytes],'spaktok-forge-'+profile+'.glb',{type:'model/gltf-binary'}))
    setNote('اكتمل: '+(bytes.byteLength/1024/1024).toFixed(1)+' MB · '+
     budget.toLocaleString()+' وجه كحد أقصى. راجع الجودة بصريًا قبل النشر.')
    return
   }
  }catch(error){
   if(controller.signal.aborted)return
   setNote('تعذّر إكمال المهمة: '+(error instanceof Error?error.message:String(error)))
  }finally{
   if(abortRef.current===controller){abortRef.current=null;setRunning(false)}
  }
 }

 const cancel=()=>{
  abortRef.current?.abort();abortRef.current=null;setRunning(false)
  setNote('توقفت المتابعة في المتصفح. المهمة على الـ GPU قد تكتمل لكنها تُحذف خلال ساعة.')
 }

 return <div className="mt-3 flex flex-col gap-2 rounded-lg border border-cyan-300/25 bg-slate-950/50 p-3">
  <p className="text-xs font-semibold text-cyan-200">Studio HD / Ultra · مهمة غير متزامنة على A100</p>
  <label className="flex flex-col gap-1 text-xs">الجودة
   <select value={profile} disabled={running}
    onChange={e=>pickProfile(e.target.value as Profile)}
    className="rounded-lg border border-white/20 bg-slate-950 p-2">
    {(Object.keys(PROFILES) as Profile[]).map(key=>
     <option key={key} value={key}>{PROFILES[key].label}</option>)}
   </select>
  </label>
  <label className="flex flex-col gap-1 text-xs">حد المضلعات
   <select value={budget} disabled={running}
    onChange={e=>setBudget(Number(e.target.value))}
    className="rounded-lg border border-white/20 bg-slate-950 p-2">
    {PROFILES[profile].budgets.map(b=><option key={b} value={b}>{b.toLocaleString()} وجه</option>)}
   </select>
  </label>
  <label className="flex gap-2 text-xs leading-5 text-amber-100">
   <input type="checkbox" checked={consent} disabled={running}
    onChange={e=>setConsent(e.target.checked)} className="mt-1"/>
   أوافق على استهلاك مهمة GPU ونقل صورتي إلى خادم المشغّل لتوليد عالي الدقة.
  </label>
  {running?
   <button type="button" onClick={cancel}
    className="rounded-lg border border-white/25 px-3 py-2 text-xs font-semibold">
    إيقاف المتابعة
   </button>:
   <button type="button" onClick={()=>void start()}
    disabled={!source||!approved||!consent||disabled}
    className="rounded-lg bg-cyan-400 px-3 py-3 text-xs font-bold text-slate-950 disabled:opacity-40">
    بدء توليد {profile==='studio-ultra'?'Ultra':'HD'}
   </button>}
  {job&&<p className="text-[11px] leading-5 text-cyan-100" aria-live="polite">
   الحالة: {STATE_AR[job.state]}
   {job.state==='queued'&&typeof job.queuePosition==='number'?' · الترتيب '+(job.queuePosition+1):''}
  </p>}
  {note&&<p className="text-[11px] leading-5 text-slate-300">{note}</p>}
 </div>
}
