import type {AgentEvent} from './spaktok-director-agent-contract'
import type {AgentAssetResult} from './spaktok-director-agent-client'

/** The model's freeform message is NOT evidence that tools ran. Generate
 * creator-visible completion exclusively from an actual audited GLB +
 * SHA256-bound private manifest and successful tool-event observations.
 * This module never promotes a private draft to a released asset.
 */
export function verifiedDirectorReply(
 result:AgentAssetResult|null,actions:readonly AgentEvent[],
):string{
 const failure=[...actions].reverse().find(x=>!x.ok)
 if(failure)return 'لم تكتمل المهمة. توقفت أداة '+failure.action+
  ' ولم أنفذ الإجراء التالي تلقائيًا. السبب: '+failure.detail+
  '. لا يوجد نشر عام ولا إعادة تشغيل مدفوعة.'
 const sent=actions.some(x=>x.action==='dispatch_asset'&&x.ok)
 const presented=actions.some(x=>x.action==='present_asset'&&x.ok)
 if(result){
  if((!sent&&!presented)||!result.manifest||!result.manifest.source.sha256||
   result.dispatch.publication!=='private-draft'||
   result.handoffStored!==sent)
   return 'لم يكتمل التحقق من نتيجة AI Director؛ لن أصف الملف بأنه جاهز للنشر.'
  const affected=result.dispatch.steps.map(s=>s.target).join('، ')
  const edited=actions.some(x=>x.action==='recolor_asset'&&x.ok)
  const generated=actions.some(x=>x.action==='generate_3d_gpu'&&x.ok)
  const relief=actions.some(x=>x.action==='generate_relief'&&x.ok)
  const operation=edited?'تعديل خامة ثلاثية الأبعاد':generated?
   'توليد 3D عبر GPU':relief?'إنشاء مجسم بارز 2.5D':
   'فحص ملف GLB موجود'
  return 'تحقق التنفيذ: '+operation+'؛ '+
   (sent?'تم فحص GLB وحفظ المسودة الخاصة لـ '+affected+'. ':
    'تم فحص GLB وإرجاع الملف داخل الدردشة فقط. لم يُوزَّع على أي قسم. ')+
   'المخرجات: '+result.qa.triangles+
   ' مثلث، '+(result.file.size/1048576).toFixed(2)+
   ' MiB، وبصمة SHA-256 مثبتة في خطة المشروع. '+
   'يمكنك تدوير الملف وتنزيله هنا. Rig والتحريك والتتبع واللايف '+
   'وتصادمات العالم وتصدير الفيديو لم تُنفَّذ بهذا الإجراء.'
 }
 const inspected=actions.some(x=>x.action==='inspect_asset'&&x.ok)
 if(inspected)return 'أكملت الفحص البنيوي للملف فقط. لا توجد '+
  'مسودة موزعة، ولم يُنشأ مجسم جديد أو يُنشر شيء.'
 return 'لم أنشئ أو أصدّر ملفًا. أرفق صورة أو GLB وحدد النتيجة المطلوبة.'
}
