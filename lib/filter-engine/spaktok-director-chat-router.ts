import {
 DIRECTOR_TARGETS,detectDirectorTargets,type DirectorTarget,
} from './spaktok-ai-director'

export type DirectorChatSource='image'|'glb'|'none'
export type DirectorChatExecution='existing-glb'|'gpu-360'|'local-relief'|'needs-file'|'needs-gpu'
export type DirectorChatIntent=Readonly<{
 targets:readonly DirectorTarget[]
 execution:DirectorChatExecution
 wants360:boolean
 isLocalRelief:boolean
 needsPaidCompute:boolean
 explanation:string
}>
const ALL='كل الأقسام'
const HUMAN=/شخص|شخصية|إنسان|انسان|بشر|رجل|امرأة|امراة|وجه|رأس|راس|portrait|face|character|human|person|body|girl|boy|man|woman/i
const PROP=/ديكور|شيء|عنصر|مجسم|أثاث|اثاث|سيارة|منزل|شجرة|تاج|كرسي|سلاح|وردة|object|prop|furniture|car|tree|room|scene|crown/i
const LOCAL=/\b2[.,]?5d\b|نحت بارز|بروز|مجسم بارز|سطح بارز|relief|heightfield|لوحة مجسمة/i
const FULL=/\b3d\b|\b360\b|ثلاثي الأبعاد|ثلاثية الأبعاد|ثلاثي الابعاد|دوران كامل|كل الاتجاهات|محيط كامل|avatar|افاتار|أفاتار|افتار|أفتار|متحرك|مجسم كامل|rodin|trellis/i
const NO_AUTO_PUBLISH=/نشر|انشر|publish|بث مباشر|أرسل للجمهور/i
/** Text-only intent routing. Not image understanding and not autonomous
 * mesh/rig/film editing. Safe fallback for when the LLM endpoint is offline.
 */
export function routeDirectorChat(
 prompt:string,source:DirectorChatSource,
):DirectorChatIntent{
 const text=prompt.normalize('NFKC').trim().slice(0,1000)
 const found=detectDirectorTargets(text)
 let targets:DirectorTarget[]
 if(found.length)targets=[...found]
 else if(HUMAN.test(text))targets=['avatar']
 else if(PROP.test(text))targets=['world']
 else targets=['world']
 // The prompt itself can explicitly demand "all departments", in which case
 // no AI model is needed and its routing cannot silently omit a department.
 if(text.includes(ALL)||/(?:all|every)\s+(?:studio|department|section)/i.test(text))
  targets=[...DIRECTOR_TARGETS]
 const isLocalRelief=LOCAL.test(text)
 const wants360=FULL.test(text)||(!isLocalRelief&&source==='image')
 const execution:DirectorChatExecution=source==='glb'?'existing-glb':
  source==='none'?'needs-file':isLocalRelief?'local-relief':'gpu-360'
 return {
  targets,execution,wants360,isLocalRelief,
  needsPaidCompute:execution==='gpu-360',
  explanation:source==='glb'?
   'سيُفحص GLB محليًا، ويُرسل الأصل نفسه لجميع المحركات المطلوبة دون GPU.':
   source==='none'?
   'أرفق صورة أو مجسم GLB حتى أتمكن من إنشاء نتيجة قابلة للتنزيل، وليس مجرد اقتراح.':
   isLocalRelief?
   'سيُنشأ مجسم بارز 2.5D محليًا دون خادم؛ ليس إعادة بناء حقيقية من 360 درجة.':
   'يتطلب بناء 3D كامل محرك GPU متصلًا وموافقتك على إرسال الصورة وتكلفة الحساب.',
 }
}
export function directorChatReplyForTargets(targets:readonly DirectorTarget[]):string{
 const labels:Record<DirectorTarget,string>={
  avatar:'الأفاتار',live:'اللايف',filter:'الفلاتر',gift:'الهدايا',
  world:'العالم',video:'الفيديو',
 }
 return targets.map(t=>labels[t]).join('، ')
}
export function explainUnfinishedSpecialists(target:DirectorTarget):string{
 const issues:Record<DirectorTarget,string>={
  avatar:'Rig وتعابير الوجه وتتبع الحركة لم تُنفّذ على هذا المجسم.',
  live:'المعاينة الخاصة جاهزة فقط؛ بث Agora وتتبع الوجه لم يُفعّلا.',
  filter:'ملف 3D قابل للفحص؛ تثبيت مرساة AR والتتبع/الإخفاء يحتاج محرك الكاميرا.',
  gift:'معاينة 3D فقط؛ الحركة والمؤثرات والتسعير لم تُعتمد.',
  world:'مسودة عالم خاصة؛ مقياس الأبعاد والتصادمات وLOD لم تُعتمد.',
  video:'عنصر 3D جاهز؛ يحتاج فيديو مصدر ومفاتيح حركة وتصدير نهائي.',
 }
 return issues[target]
}
/** Never infer image contents (human, prop, person identity) from a file name.
 * A text request may specify an intended use; image semantics remain unknown.
 */
export const DIRECTOR_CHAT_AUTO_PUBLISH=false
export function requiresSeparatePublishingReview(prompt:string):boolean{
 return NO_AUTO_PUBLISH.test(prompt)
}
