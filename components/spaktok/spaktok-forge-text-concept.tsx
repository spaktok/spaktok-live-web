'use client'

import {useEffect,useRef,useState} from 'react'

const EXT:Record<string,string>={'image/png':'png','image/jpeg':'jpg','image/webp':'webp'}

export default function SpaktokForgeTextConcept({
 disabled,onConcept,
}:Readonly<{disabled:boolean;onConcept:(file:File)=>void}>){
 const [prompt,setPrompt]=useState('')
 const [busy,setBusy]=useState(false)
 const [note,setNote]=useState('')
 const [preview,setPreview]=useState<{url:string;file:File}|null>(null)
 const abortRef=useRef<AbortController|null>(null)
 useEffect(()=>()=>abortRef.current?.abort(),[])
 useEffect(()=>()=>{if(preview)URL.revokeObjectURL(preview.url)},[preview])

 const valid=prompt.trim().length>=3&&prompt.length<=600

 const generate=async()=>{
  if(!valid||busy||disabled)return
  const controller=new AbortController()
  abortRef.current?.abort();abortRef.current=controller
  setBusy(true);setNote('توليد صورة المفهوم عبر AI Gateway…')
  try{
   const r=await fetch('/api/spaktok-forge/text-image',{
    method:'POST',cache:'no-store',signal:controller.signal,
    headers:{'content-type':'application/json'},
    body:JSON.stringify({prompt}),
   })
   if(!r.ok){
    const data=await r.json().catch(()=>({}))
    throw Error(String(data.error??'forge_text_image_failed'))
   }
   const blob=await r.blob()
   const file=new File([blob],'spaktok-concept.'+(EXT[blob.type]??'png'),{type:blob.type||'image/png'})
   setPreview({url:URL.createObjectURL(file),file})
   setNote('راجع الصورة. إذا كانت مناسبة استخدمها مصدرًا للمجسم.')
  }catch(error){
   if(!controller.signal.aborted)
    setNote('تعذّر التوليد: '+(error instanceof Error?error.message:String(error)))
  }finally{
   if(abortRef.current===controller){abortRef.current=null;setBusy(false)}
  }
 }

 return <div className="flex flex-col gap-2 rounded-lg border border-white/15 bg-slate-950/50 p-3">
  <label htmlFor="forge-text-prompt" className="text-xs font-semibold">
   أو صف المجسم بالنص (Text-to-3D)
  </label>
  <textarea id="forge-text-prompt" value={prompt} maxLength={600} rows={3} disabled={busy}
   onChange={e=>setPrompt(e.target.value)}
   placeholder="مثال: خوذة فارس من الحديد المطروق مع ريشة حمراء"
   className="resize-none rounded-lg border border-white/20 bg-slate-950 p-2 text-sm leading-6"/>
  <button type="button" onClick={()=>void generate()} disabled={!valid||busy||disabled}
   className="rounded-lg border border-cyan-300/40 px-3 py-2 text-xs font-semibold text-cyan-100 disabled:opacity-40">
   {busy?'جارٍ التوليد…':'توليد صورة مفهوم'}
  </button>
  {preview&&<div className="flex flex-col gap-2">
   {/* eslint-disable-next-line @next/next/no-img-element */}
   <img src={preview.url} alt={'صورة مفهوم: '+prompt}
    className="aspect-square w-full rounded-lg border border-white/15 object-contain"/>
   <button type="button" disabled={busy||disabled}
    onClick={()=>{onConcept(preview.file);setNote('تم اعتماد الصورة مصدرًا. أكمل الموافقات ثم ابدأ التوليد.')}}
    className="rounded-lg bg-cyan-400 px-3 py-2 text-xs font-bold text-slate-950 disabled:opacity-40">
    استخدام هذه الصورة لتوليد المجسم
   </button>
  </div>}
  {note&&<p className="text-[11px] leading-5 text-slate-300" aria-live="polite">{note}</p>}
 </div>
}
