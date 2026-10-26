'use client'

import {useEffect,useRef,useState} from 'react'
import {Download,Smile,Type,X,Upload,ExternalLink,ImagePlus} from 'lucide-react'
import {MAX_VECTOR_BYTES,validateSelfContainedSvg,vectorLayout} from '@/lib/vector/safe-svg'

interface Props {imageUrl:string;onBack:()=>void}
const STICKERS=['','❤️','✨','🔥','🌸','⭐','🌈','🦋','🎉','💫']
const COLORS=['#ffffff','#ffe4ba','#ffd4e1','#a8c6ff','#c4ffda','#101010']
const PREVIEW_COLORS:Record<string,string>={'#ffffff':'أبيض','#ffe4ba':'ذهبي','#ffd4e1':'وردي','#a8c6ff':'أزرق','#c4ffda':'أخضر','#101010':'داكن'}

const loadImage=(url:string)=>new Promise<HTMLImageElement>((resolve,reject)=>{
 const image=new window.Image()
 image.onload=()=>resolve(image)
 image.onerror=()=>reject(new Error('photo_unavailable'))
 image.src=url
})
type VectorOverlay={url:string;name:string}
const renderImage=async(input:{imageUrl:string;text:string;sticker:string;color:string;vertical:number;fontSize:number;
 vector:VectorOverlay|null;vectorX:number;vectorY:number;vectorSize:number}):Promise<Blob>=>{
 const image=await loadImage(input.imageUrl)
 const canvas=document.createElement('canvas')
 canvas.width=720;canvas.height=1280
 const ctx=canvas.getContext('2d')
 if(!ctx)throw new Error('canvas_unavailable')
 const s=Math.max(canvas.width/image.naturalWidth,canvas.height/image.naturalHeight)
 const w=image.naturalWidth*s,h=image.naturalHeight*s
 ctx.drawImage(image,(canvas.width-w)/2,(canvas.height-h)/2,w,h)
 if(input.vector){
   const art=await loadImage(input.vector.url)
   if(!art.naturalWidth||!art.naturalHeight)throw new Error('vector_rasterization_failed')
   const placement=vectorLayout(input.vectorX,input.vectorY,input.vectorSize,
     canvas.width,canvas.height,art.naturalWidth/art.naturalHeight)
   ctx.drawImage(art,placement.left,placement.top,placement.width,placement.height)
 }
 if(input.sticker){
   ctx.textAlign='center';ctx.textBaseline='middle';ctx.font='120px system-ui, sans-serif'
   ctx.fillText(input.sticker,canvas.width*0.78,canvas.height*0.22)
 }
 if(input.text.trim()){
   const size=Math.max(26,Math.min(72,input.fontSize))
   ctx.font=`900 ${size}px system-ui, sans-serif`
   ctx.textAlign='center';ctx.textBaseline='middle'
   ctx.fillStyle=input.color
   ctx.strokeStyle='rgba(0,0,0,0.8)'
   ctx.lineWidth=Math.max(3,size*0.11)
   ctx.lineJoin='round'
   ctx.direction='rtl'
   const words=input.text.trim().split(/\s+/)
   const lines:string[]=[];let current=''
   for(const word of words){
     const candidate=current?current+' '+word:word
     if(ctx.measureText(candidate).width>canvas.width*0.84 && current){
       lines.push(current);current=word
     }else current=candidate
   }
   if(current)lines.push(current)
   const chunks=lines.slice(0,5)
   const lineHeight=size*1.26
   const centerY=canvas.height*(input.vertical/100)
   for(let i=0;i<chunks.length;i++){
     const y=centerY+(i-(chunks.length-1)/2)*lineHeight
     ctx.strokeText(chunks[i],canvas.width/2,y,canvas.width*.86)
     ctx.fillText(chunks[i],canvas.width/2,y,canvas.width*.86)
   }
 }
 return new Promise((resolve,reject)=>canvas.toBlob(blob=>blob?resolve(blob):reject(new Error('export_failed')),'image/jpeg',0.91))
}

export function StoryComposer({imageUrl,onBack}:Props){
 const [text,setText]=useState('')
 const [sticker,setSticker]=useState('✨')
 const [color,setColor]=useState('#ffffff')
 const [vertical,setVertical]=useState(55)
 const [fontSize,setFontSize]=useState(48)
 const [saving,setSaving]=useState(false)
 const [error,setError]=useState<string|null>(null)
 const [vector,setVector]=useState<VectorOverlay|null>(null)
 const [vectorX,setVectorX]=useState(50)
 const [vectorY,setVectorY]=useState(38)
 const [vectorSize,setVectorSize]=useState(42)
 const fileInputRef=useRef<HTMLInputElement>(null)
 const vectorRef=useRef<VectorOverlay|null>(null)
 useEffect(()=>()=>{if(vectorRef.current)URL.revokeObjectURL(vectorRef.current.url)},[])
 const importVector=async(file:File|undefined)=>{
  if(!file)return
  setError(null)
  if(file.size>MAX_VECTOR_BYTES||!file.name.toLowerCase().endsWith('.svg')){
   setError('اختر ملف SVG أصليًا لا يتجاوز 1.5 ميغابايت.')
   return
  }
  try{
   const text=await file.text()
   validateSelfContainedSvg(text)
   const blob=new Blob([text],{type:'image/svg+xml'})
   const url=URL.createObjectURL(blob)
   await loadImage(url).catch(err=>{URL.revokeObjectURL(url);throw err})
   const next={name:file.name,url}
   if(vectorRef.current)URL.revokeObjectURL(vectorRef.current.url)
   vectorRef.current=next
   setVector(next)
  }catch{
   setError('تعذر استيراد SVG. يجب أن يكون الملف صالحًا ولا يحتوي على سكربتات أو روابط خارجية.')
  }finally{
   if(fileInputRef.current)fileInputRef.current.value=''
  }
 }


 const save=async()=>{
  if(saving)return
  setSaving(true);setError(null)
  try{
   const blob=await renderImage({imageUrl,text,sticker,color,vertical,fontSize,vector,vectorX,vectorY,vectorSize})
   const url=URL.createObjectURL(blob)
   const a=document.createElement('a')
   a.href=url;a.download='spaktok-story-'+Date.now()+'.jpg'
   document.body.appendChild(a);a.click();a.remove()
   window.setTimeout(()=>URL.revokeObjectURL(url),15000)
  }catch{setError('لم نتمكن من حفظ القصة. حاول مجددًا.')}
  finally{setSaving(false)}
 }

 return(
  <section className="absolute inset-0 z-20 overflow-hidden bg-[#070b19] text-white" dir="rtl" aria-label="محرر قصص SpakTok">
   <div className="absolute inset-0">
     <img src={imageUrl} alt="معاينة القصة" className="size-full object-cover"/>
     <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-black/25 via-transparent to-black/50"/>
     {vector&&<img src={vector.url} alt={'رسم متجهي '+vector.name}
       className="pointer-events-none absolute -translate-x-1/2 -translate-y-1/2 object-contain drop-shadow-xl"
       style={{left:vectorX+'%',top:vectorY+'%',width:vectorSize+'%',maxHeight:'55%'}}/>}
     {!!sticker&&<span aria-hidden="true" className="absolute left-[12%] top-[15%] select-none text-[60px] drop-shadow-xl">{sticker}</span>}
     {text.trim()&&<div className="pointer-events-none absolute left-1/2 w-[85%] -translate-x-1/2 -translate-y-1/2 whitespace-pre-line break-words text-center font-black leading-tight"
       style={{top:vertical+'%',fontSize:Math.min(32,fontSize/2)+'px',color,textShadow:'0 2px 4px #000, 0 0 12px #000a'}}>{text}</div>}
   </div>
   <header className="absolute inset-x-0 top-0 z-10 flex items-center justify-between p-4 pt-[max(1rem,env(safe-area-inset-top))]">
     <button type="button" onClick={onBack} aria-label="إغلاق المحرر" className="spak-icon-control bg-black/60"><X className="size-5"/></button>
     <div className="rounded-full border border-white/15 bg-black/60 px-4 py-2 text-xs font-bold">STORY STUDIO</div>
     <div className="w-10"/>
   </header>
   <div className="absolute inset-x-0 bottom-0 z-10 max-h-[62%] overflow-y-auto rounded-t-[30px] border-t border-white/15 bg-[#080d20]/90 p-4 pb-[max(1.2rem,env(safe-area-inset-bottom))] backdrop-blur-2xl">
     <div className="mb-4 flex items-center gap-2 text-sm font-bold text-[#c8d5ff]"><Type className="size-4"/>أضف نصًا إلى قصتك</div>
     <input value={text} onChange={e=>setText(e.target.value)} maxLength={100} dir="auto" placeholder="اكتب رسالة قصيرة..." className="mb-4 w-full rounded-xl border border-white/15 bg-white/10 px-3 py-3 text-sm outline-none focus:border-[#96aeff]"/>
     <p className="mb-2 text-xs text-white/60">اللون</p>
     <div className="mb-4 flex gap-2">{COLORS.map(c=><button type="button" key={c} onClick={()=>setColor(c)} aria-label={PREVIEW_COLORS[c]}
       aria-pressed={color===c} className="size-9 rounded-full border-2" style={{backgroundColor:c,borderColor:color===c?'#fff':'transparent'}} />)}</div>
     <div className="mb-4 grid grid-cols-2 gap-4">
       <label className="text-xs text-white/60">حجم النص
         <input type="range" className="mt-2 w-full" min={26} max={72} value={fontSize} onChange={e=>setFontSize(Number(e.target.value))}/>
       </label>
       <label className="text-xs text-white/60">موضع النص
         <input type="range" className="mt-2 w-full" min={26} max={76} value={vertical} onChange={e=>setVertical(Number(e.target.value))}/>
       </label>
     </div>
     <div className="mb-2 flex items-center gap-2 text-xs text-white/60"><Smile className="size-4"/>ملصقات</div>
     <div className="mb-4 flex gap-2 overflow-x-auto pb-2">{STICKERS.map((s,i)=><button key={i} type="button" aria-label={s?'ملصق '+s:'دون ملصق'} onClick={()=>setSticker(s)}
       aria-pressed={sticker===s} className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/10 text-2xl aria-pressed:border-[#a6bcff]">{s||<X className="size-4"/>}</button>)}</div>
     <div className="mb-4 rounded-2xl border border-[#a9bcff]/20 bg-[#4562a0]/10 p-3">
       <div className="mb-2 flex items-center justify-between gap-2">
         <span className="flex items-center gap-2 text-xs font-bold text-[#c8d5ff]">
           <ImagePlus className="size-4"/> رسومات LottieFiles الأصلية
         </span>
         <a href="https://lottiefiles.com/ai-vector-generator" target="_blank" rel="noopener noreferrer"
           className="flex items-center gap-1 text-[11px] font-semibold text-[#abc6ff]">
           إنشاء SVG في LottieFiles <ExternalLink className="size-3"/>
         </a>
       </div>
       <input ref={fileInputRef} type="file" accept=".svg,image/svg+xml"
         onChange={event=>void importVector(event.target.files?.[0])}
         className="hidden" aria-label="اختيار ملف SVG من LottieFiles"/>
       <button type="button" onClick={()=>fileInputRef.current?.click()}
         className="flex w-full items-center justify-center gap-2 rounded-xl border border-white/15 bg-white/10 px-3 py-2.5 text-xs font-semibold text-white">
         <Upload className="size-4"/> استيراد ملف SVG دون تغيير تصميمه
       </button>
       {vector&&<div className="mt-3 space-y-2">
         <div className="flex items-center justify-between text-[11px] text-white/75">
           <span className="max-w-[70%] truncate" dir="auto">{vector.name}</span>
           <button type="button" onClick={()=>{
             if(vectorRef.current)URL.revokeObjectURL(vectorRef.current.url)
             vectorRef.current=null;setVector(null)
           }} className="rounded-full border border-white/20 px-2 py-1">إزالة</button>
         </div>
         <label className="flex items-center gap-2 text-[11px] text-white/70">الحجم
           <input type="range" min={10} max={75} value={vectorSize}
             onChange={e=>setVectorSize(Number(e.target.value))} className="min-w-0 flex-1"/>
         </label>
         <label className="flex items-center gap-2 text-[11px] text-white/70">أفقيًا
           <input type="range" min={15} max={85} value={vectorX}
             onChange={e=>setVectorX(Number(e.target.value))} className="min-w-0 flex-1"/>
         </label>
         <label className="flex items-center gap-2 text-[11px] text-white/70">عموديًا
           <input type="range" min={15} max={80} value={vectorY}
             onChange={e=>setVectorY(Number(e.target.value))} className="min-w-0 flex-1"/>
         </label>
       </div>}
       <p className="mt-2 text-[10px] leading-4 text-white/50">
         صدّر SVG من موقع LottieFiles ثم استورده هنا. يبقى الملف على هاتفك،
         ويُدمج الرسم في الصورة المحفوظة. لا يُشغّل هذا محرّك توليد LottieFiles داخل التطبيق.
       </p>
     </div>
     {error&&<p className="mb-3 text-xs text-red-200" role="alert">{error}</p>}
     <button type="button" onClick={()=>void save()} disabled={saving} className="spak-primary-button w-full">
       <Download className="ml-2 size-4"/>{saving?'جارٍ تجهيز الصورة...':'حفظ القصة المصممة'}
     </button>
     <p className="mt-3 text-center text-[11px] text-white/45">الحفظ على جهازك فقط. النشر المباشر للقصص لم يُفعّل بعد.</p>
   </div>
  </section>
 )
}
