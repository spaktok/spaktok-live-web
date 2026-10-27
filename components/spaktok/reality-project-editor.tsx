'use client'
import {useEffect,useState} from 'react'
import {
 createRealityProject,realityProjectReview,validateRealityProject,
 runRealityEvent,sampleRealityTrack,
 type RealityAction,type RealityEvent,type RealityProjectV2,
 type RealitySceneKind,
} from '@/lib/filter-engine/reality-studio-project'

const safeDownload=(obj:unknown,name:string)=>{
 const blob=new Blob([JSON.stringify(obj,null,2)],{type:'application/json'})
 const url=URL.createObjectURL(blob)
 const a=document.createElement('a')
 a.href=url;a.download=name;a.click()
 window.setTimeout(()=>URL.revokeObjectURL(url),2000)
}
const nodeLabels:Record<RealitySceneKind,string>={
 'camera':'Camera','face-tracker':'Face Tracker','hand-tracker':'Hand Tracker',
 'face-morph':'Face Morph','model-3d':'3D Model',
 'directional-light':'Directional Light','material':'PBR Material',
 'post-fx':'Post FX',
}
export default function RealityProjectEditor(){
 const [project,setProject]=useState<RealityProjectV2>(createRealityProject)
 const [selected,setSelected]=useState('face-morph')
 const [event,setEvent]=useState<RealityEvent>('smile')
 const [action,setAction]=useState<RealityAction>('rotate')
 const [seek,setSeek]=useState(500)
 const [message,setMessage]=useState('')
 useEffect(()=>{
  try{
   const value=localStorage.getItem('spaktok.reality.project.v2')
   if(!value)return
   const parsed=JSON.parse(value) as RealityProjectV2
   validateRealityProject(parsed)
   setProject(parsed)
  }catch{/* Corrupted projects must not disable editor. */}
 },[])
 useEffect(()=>{
  try{localStorage.setItem('spaktok.reality.project.v2',JSON.stringify(project))}
  catch{/* In private mode local save may be unavailable. */}
 },[project])
 const update=(patch:Partial<RealityProjectV2>)=>{
  setProject(prev=>({...prev,...patch,review:'draft'}))
 }
 const add=(kind:RealitySceneKind)=>{
  const nodeId='node-'+(1+Math.max(0,...project.nodes.map(n=>
   Number(n.id.match(/^node-(\d+)$/)?.[1]??0))))
  const parentId=kind==='model-3d'||kind==='face-morph'?'face-tracker':'camera'
  update({nodes:[...project.nodes,{
   id:nodeId,kind,name:nodeLabels[kind],parentId,enabled:true,
   position:[0,0,0],rotation:[0,0,0],scale:[1,1,1],
  }]})
  setSelected(nodeId)
 }
 const node=project.nodes.find(n=>n.id===selected)
 const changeNode=(next:Partial<NonNullable<typeof node>>)=>{
  update({nodes:project.nodes.map(n=>n.id===selected?{...n,...next}:n)})
 }
 const bind=()=>{
  try{
   const link={
    id:'event-'+(project.links.length+1),event,targetId:selected,
    action,amount:action==='rotate'?.35:1,durationMs:450,
   }
   update({links:[...project.links,link]})
   setMessage('تم إنشاء علاقة بين الحدث والمجسم داخل مشروع التأليف.')
  }catch(e){setMessage(String(e))}
 }
 const addTimeline=()=>{
  const targetId=node?.id??'face-morph'
  update({timeline:[...project.timeline,{
   targetId,property:'rotation-z',
   keyframes:[{timeMs:0,value:0},{timeMs:500,value:.45},{timeMs:1200,value:0}],
  }]})
 }
 const exportProject=()=>{
  try{
   validateRealityProject(project)
   const review=realityProjectReview(project)
   safeDownload({...project,checks:review},
    project.id+'-authoring-v2.json')
   setMessage('تم تصدير مسودة المشروع، ولم يُنشر أي ملف.')
  }catch(e){setMessage('لا يمكن تصدير المشروع: '+String(e))}
 }
 const readiness=(()=>{
  try{return realityProjectReview(project)}
  catch{return {canSubmit:false,warnings:['invalid_project'],published:false}}
 })()
 return <section dir="rtl" className="mx-auto mt-7 max-w-7xl space-y-4 rounded-2xl border border-indigo-400/25 bg-[#0c1425] p-4 text-white sm:p-6">
  <div className="flex flex-wrap items-center justify-between gap-3">
   <div>
    <h2 className="text-xl font-bold">Reality Creator · مشروعات ومشاهد وتفاعلات</h2>
    <p className="mt-1 text-xs leading-6 text-slate-300">
     محرر مشروع أولي مستقل عن تشغيل الكاميرا؛ يسمح بتجربة العقد والجدول الزمني
     وتصدير JSON قابل للتحرير. لا يتيح نشر مؤثرات عامة بعد.
    </p>
   </div>
   <button onClick={exportProject} type="button" className="rounded-lg bg-cyan-400 px-4 py-2 text-sm font-bold text-slate-950">
    تصدير المشروع v2
   </button>
  </div>
  <label className="block max-w-lg text-xs">اسم المشروع
   <input value={project.name} maxLength={90}
    onChange={e=>update({name:e.target.value})}
    className="mt-1 block w-full rounded-lg border border-slate-600 bg-slate-950 px-3 py-2 text-sm"/>
  </label>
  <div className="grid gap-4 lg:grid-cols-3">
   <section className="space-y-3 rounded-xl border border-slate-700 p-3">
    <h3 className="text-sm font-bold">Scene Hierarchy</h3>
    <div className="max-h-[270px] space-y-1 overflow-y-auto">
     {project.nodes.map(item=>
      <button type="button" key={item.id} onClick={()=>setSelected(item.id)}
       aria-pressed={selected===item.id}
       className={'block w-full rounded-lg px-2 py-2 text-right text-xs '+
        (selected===item.id?'bg-indigo-600':'bg-slate-800/80')}>
       <span>{item.parentId?'↳ ':''}{item.name}</span>
       <span className="ms-2 text-slate-400">({nodeLabels[item.kind]})</span>
      </button>
     )}
    </div>
    <div className="flex flex-wrap gap-2">
     <button onClick={()=>add('model-3d')} className="rounded bg-indigo-600 px-2 py-1.5 text-xs">+ مجسم 3D</button>
     <button onClick={()=>add('material')} className="rounded bg-indigo-600 px-2 py-1.5 text-xs">+ خامة</button>
     <button onClick={()=>add('post-fx')} className="rounded bg-indigo-600 px-2 py-1.5 text-xs">+ مؤثر</button>
    </div>
   </section>
   <section className="space-y-3 rounded-xl border border-slate-700 p-3">
    <h3 className="text-sm font-bold">Object Inspector</h3>
    {node&&<>
     <label className="block text-xs">اسم العنصر
      <input className="mt-1 w-full rounded bg-slate-900 p-2"
       value={node.name} onChange={e=>changeNode({name:e.target.value})}/></label>
     <label className="flex items-center gap-2 text-xs">
      <input type="checkbox" checked={node.enabled}
       onChange={e=>changeNode({enabled:e.target.checked})}/> إظهار العنصر
     </label>
     {(['position','rotation','scale'] as const).map(field=>
      <div key={field} className="space-y-1">
       <span className="text-xs text-slate-300">{field}</span>
       <div className="grid grid-cols-3 gap-1">
        {([0,1,2] as const).map(i=>
         <input key={i} aria-label={field+' '+i} type="number" step=".05"
          value={node[field][i]}
          onChange={e=>{
           const v=[...node[field]]
           v[i]=Number(e.target.value)
           changeNode({[field]:v})
          }}
          className="w-full rounded bg-slate-900 p-2 text-xs"/>
        )}
       </div>
      </div>
     )}
    </>}
   </section>
   <section className="space-y-3 rounded-xl border border-slate-700 p-3">
    <h3 className="text-sm font-bold">Event Graph + Animation</h3>
    <p className="text-xs text-slate-400">اختر الحدث والفعل والهدف المحدد في Hierarchy.</p>
    <div className="flex gap-2">
     <select value={event} onChange={e=>setEvent(e.target.value as RealityEvent)}
      className="min-w-0 flex-1 rounded bg-slate-900 p-2 text-xs">
      {(['smile','blink','hand-pinch','hand-release','head-turn'] as const).map(x=><option key={x}>{x}</option>)}
     </select>
     <select value={action} onChange={e=>setAction(e.target.value as RealityAction)}
      className="min-w-0 flex-1 rounded bg-slate-900 p-2 text-xs">
      {(['rotate','scale','show','hide'] as const).map(x=><option key={x}>{x}</option>)}
     </select>
    </div>
    <button type="button" onClick={bind} className="rounded bg-indigo-600 px-3 py-2 text-xs">+ ربط الحدث</button>
    <div className="max-h-24 overflow-y-auto text-xs text-slate-300">
     {project.links.map(x=><p key={x.id} className="border-b border-slate-800 py-1">{x.event} → {x.action} ({x.targetId})</p>)}
    </div>
    <button type="button" onClick={addTimeline} className="rounded bg-indigo-600 px-3 py-2 text-xs">+ حركة Keyframes</button>
    <input type="range" min="0" max="1200" step="50" value={seek}
     aria-label="Timeline preview"
     onChange={e=>setSeek(Number(e.target.value))} className="w-full accent-cyan-400"/>
    <p className="text-xs text-slate-400">
     Timeline {seek} ms • {project.timeline.length} مسارات •
     {project.timeline[0]?' قيمة '+sampleRealityTrack(project.timeline[0],seek).toFixed(2):' لا توجد حركة'}
    </p>
    {project.links.length>0&&<p className="text-xs text-cyan-200">أحداث الابتسام: {runRealityEvent(project,'smile').length}</p>}
   </section>
  </div>
  <div className="flex flex-wrap items-center gap-3 rounded-xl border border-slate-700 p-3">
   <label className="text-xs">حقوق الأصول
    <select value={project.rights} onChange={e=>update({rights:e.target.value as RealityProjectV2['rights']})}
     className="ms-2 rounded bg-slate-900 p-2">
     <option value="unverified">غير مؤكدة</option>
     <option value="original">أصل من إنشائي</option>
     <option value="licensed">لدي ترخيص</option>
    </select>
   </label>
   <span className="text-xs text-amber-200">
    {readiness.warnings.length?
     'غير جاهز للمراجعة: '+readiness.warnings.join(' · '):
     'مسودة قابلة للتقديم للمراجعة بعد اختبار الهاتف'}
   </span>
   <span className="text-xs text-slate-400">نشر عام: غير متاح في هذه النسخة</span>
  </div>
  {message&&<p className="text-xs text-cyan-200" role="status">{message}</p>}
 </section>
}
