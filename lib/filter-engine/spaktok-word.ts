import {
 reviewStudioProduction,type StudioProductionPackage,
} from './reality-production-pipeline'

/** Spaktok Word — control plane for the existing authoring toolchain.
 * Only verified local outputs are marked ready. Vendor GPU generation,
 * facial auto-rigging and public live publishing are NEVER impersonated.
 */
export const SPAKTOK_WORD_VERSION=1 as const
export type WordLaneId='source'|'rights'|'rodin'|'geometry'|'materials'|
 'facial-rig'|'placement'|'camera'|'video'|'live'|'release'
export type WordLaneStatus='ready'|'waiting'|'blocked'|'external'|'manual'
export type WordLane=Readonly<{
 id:WordLaneId;name:string
 status:WordLaneStatus
 reason:string
 dependencies:readonly WordLaneId[]
 href:string|null
}>
const order:readonly WordLaneId[]=[
 'source','rights','rodin','geometry','materials','facial-rig',
 'placement','camera','video','live','release',
]
export function buildSpaktokWordPlan(p:StudioProductionPackage):Readonly<{
 format:'SpaktokWordPlan';version:1;title:string
 lanes:readonly WordLane[];readyCount:number
 canPublish:false
}>{
 const review=reviewStudioProduction(p)
 const current=(id:string)=>review.steps.find(s=>s.id===id)?.status==='ready'
 const isGlb=p.sourceFormat==='glb'
 const isImage=p.sourceFormat==='image'
 const hasSource=current('source')
 const rights=current('rights')
 const geometry=current('geometry')
 const materials=current('materials')
 const rigNeeded=p.assetType==='face-mask'||p.assetType==='full-avatar'
 const rig=geometry&&(!rigNeeded||
   (p.metrics.rigTargets>=3&&p.tests.animationVerified))
 const canAttach=geometry&&current('placement')
 const cam=canAttach&&(!rigNeeded||rig)&&p.tests.mobileVisualApproved&&
  p.tests.deviceFpsVerified
 const vid=geometry&&materials&&p.tests.mobileVisualApproved&&
  p.tests.deviceFpsVerified
 const lane=(id:WordLaneId,name:string,status:WordLaneStatus,
  reason:string,dependencies:readonly WordLaneId[],href:string|null=null):WordLane=>
  ({id,name,status,reason,dependencies,href})
 const lanes:WordLane[]=[
  lane('source','مصدر المشروع',hasSource?'ready':'waiting',
   hasSource?'تم اختيار أصل محلي':'استورد صورة أو GLB أو OBJ',['rights'],'/reality-studio'),
  lane('rights','حقوق الاستخدام',rights?'ready':'blocked',
   rights?'تأكيد المراجعة مُسجّل؛ يلزم إثبات فعلي عند النشر':
   'حقوق المصدر غير مُتحقَّقة؛ التوليد والنشر مقيدان',[],'/reality-studio'),
  lane('rodin','توليد مجسم Rodin',!isImage?'manual':!rights?'blocked':'external',
   isImage&&rights?'تنسيق خارجي اختياري؛ لا يوجد طلب API أو دفع تلقائي':
   isImage?'لا يمكن إرسال الصورة قبل إثبات الحقوق':
   'لا حاجة للتوليد عندما يبدأ العمل بملف GLB صالح',
   ['source','rights'],'https://hyper3d.ai/workspace/rodin'),
  lane('geometry','شبكة المجسم والهندسة',geometry?'ready':'waiting',
   geometry?'GLB صالح للفحص البنيوي':
   isImage?'بانتظار مجسم GLB حقيقي من Rodin أو مزوّد آخر':
   'يلزم GLB مستقل وخالٍ من مراجع غير آمنة',
   ['source','rights'],'/reality-studio'),
  lane('materials','خامات PBR وUV',materials?'ready':'waiting',
   materials?'تم فحص بيانات PBR وUV وNormals بنيويًا':
   'الخامات والخرائط غير موثقة أو ما زال المجسم مفقودًا',
   ['geometry'],'/reality-studio'),
  lane('facial-rig','Rig وتحريك التعابير',rig?'ready':'manual',
   rig?'فحص بيانات التحريك الأساسية؛ جودة الحركة تتطلب معاينة':
   rigNeeded?'يحتاج Morph Targets مُختبرة للعين والفم والحاجبين':
   'تحريك الوجه اختياري لهذا النوع من المجسمات',
   ['geometry'],'/avatar-studio'),
  lane('placement','ربط المجسم ونقاط الوجه',canAttach?'ready':'waiting',
   canAttach?'نقطة التثبيت مُحددة بعد فحص الهندسة':
   'يجب معايرة الموضع وشبكة الوجه؛ ربط الجسم غير معتمد حاليًا',
   ['geometry'],'/live-studio-preview'),
  lane('camera','معاينة الكاميرا',cam?'ready':'manual',
   cam?'المراجعة على الهاتف مؤشَّر عليها؛ ليست شهادة جهاز مستقلة':
   'اختبر الحركة والالتصاق والأداء يدويًا على الهاتف',
   ['placement','facial-rig'],'/live-studio-preview'),
  lane('video','الفيديو المسجل',vid?'ready':'manual',
   vid?'مؤشرات المعاينة المحلية مكتملة؛ تحقق من التصدير':
   'يلزم اختبار المواد والتصدير والصوت وتطابق الإطارات',
   ['geometry','materials'],'/video-studio'),
  lane('live','بث المشاهدين', 'manual',
   'البث الفعلي عبر Agora/WebRTC لم يثبت بعد؛ الموجود معاينة محلية',
   ['camera','facial-rig'],'/live-studio-preview'),
  lane('release','اعتماد ونشر', 'blocked',
   'يتطلب مراجعة الحقوق والهوية والجودة وخدمة نشر وإلغاء وإصدار',
   ['rights','camera','video','live'],null),
 ]
 if(lanes.length!==order.length||lanes.some((l,i)=>l.id!==order[i]))
  throw Error('spaktok_word_invalid_graph')
 return {
  format:'SpaktokWordPlan',version:1,title:p.title,
  lanes,readyCount:lanes.filter(l=>l.status==='ready').length,
  canPublish:false,
 }
}
export type WordCheckKey='metadata'|'sha256'|'geometry'|'image'
export type WordCheckState='passed'|'failed'
export type WordLocalCheck=Readonly<{
 id:WordCheckKey;status:WordCheckState
 label:string;detail:string
}>
/** Truly concurrent independent async validation tasks, not GPU parallelism.
 * Each async job completes independently; a failure cannot falsely mark
 * another lane as successful. The runner deliberately has no network calls.
 */
export async function executeWordParallelChecks(
 jobs:ReadonlyArray<Readonly<{
  id:WordCheckKey;label:string;run:()=>Promise<string>
 }>>,
 onUpdate?:(result:WordLocalCheck)=>void,
):Promise<readonly WordLocalCheck[]>{
 if(new Set(jobs.map(j=>j.id)).size!==jobs.length)
  throw Error('spaktok_word_duplicate_job')
 const tasks=jobs.map(async j=>{
  try{
   const detail=await j.run()
   const result:WordLocalCheck={id:j.id,label:j.label,
    status:'passed',detail}
   onUpdate?.(result)
   return result
  }catch(error){
   const result:WordLocalCheck={id:j.id,label:j.label,
    status:'failed',
    detail:error instanceof Error?error.message:'فشل فحص محلي'}
   onUpdate?.(result)
   return result
  }
 })
 return Promise.all(tasks)
}
