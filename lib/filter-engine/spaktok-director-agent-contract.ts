import {z} from 'zod'
import {DIRECTOR_TARGETS,detectDirectorTargets,type DirectorTarget} from './spaktok-ai-director'

export const AGENT_ACTIONS=[
 'inspect_asset','generate_relief','generate_3d_gpu','recolor_asset',
 'dispatch_asset','present_asset','finish',
] as const
export const AGENT_STYLES=[
 'gold','silver','red','blue','green','purple','black','white',
] as const
export const agentStepSchema=z.object({
 action:z.enum(AGENT_ACTIONS),
 targets:z.array(z.enum(DIRECTOR_TARGETS)).max(6),
 color:z.enum(AGENT_STYLES).nullable(),
 message:z.string().max(500),
}).strict()
export type AgentStep=z.infer<typeof agentStepSchema>
export type AgentEvent=Readonly<{
 action:AgentStep['action']
 ok:boolean
 detail:string
}>
export const agentRequestSchema=z.object({
 prompt:z.string().trim().min(2).max(1000),
 originalSource:z.enum(['image','glb','none']),
 workingSource:z.enum(['image','glb','none']),
 history:z.array(z.object({
  role:z.enum(['user','assistant']),
  text:z.string().max(350),
 }).strict()).max(8),
 steps:z.array(z.object({
  action:z.enum(AGENT_ACTIONS),
  ok:z.boolean(),
  detail:z.string().max(300),
 }).strict()).max(6),
 imagePreview:z.string().max(230000).nullable(),
}).strict()
export type AgentRequest=z.infer<typeof agentRequestSchema>
const COLOR_TESTS:Readonly<Record<typeof AGENT_STYLES[number],RegExp>>={
 gold:/ذهبي|ذهبية|gold|golden|vergold/i,
 silver:/فضي|فضية|silver|silber/i,
 red:/احمر|أحمر|حمراء|\bred\b|\brot(?:e|en|es|em|er)?\b/i,
 blue:/ازرق|أزرق|زرقاء|\bblue\b|\bblau(?:e|en|es|em|er)?\b/i,
 green:/اخضر|أخضر|خضراء|green|grün|gruen/i,
 purple:/بنفسجي|بنفسجية|أرجواني|purple|violet|violett|lila/i,
 black:/اسود|أسود|سوداء|black|schwarz/i,
 white:/ابيض|أبيض|بيضاء|white|weiß|weiss/i,
}
const MATERIAL_EDIT=/غيّر|غير|بدّل|بدل|لوّن|لون|اجعل|خليه|خلّي|حوّل|حول|paint|recolor|make|color|colour|material|خامة|färb|faerb|ändere|aendere|farbe|mach(?:e)?|kolorier|tön/i
/** Ask once instead of guessing an unsupported or ambiguous color.
 * The current material engine supports ONE solid PBR color per command.
 */
export function creatorClarification(prompt:string):string|null{
 if(!MATERIAL_EDIT.test(prompt))return null
 const colorSubject=/لون|خامة|paint|recolor|color|colour|material|färb|faerb|farbe|kolorier|tön/i
 const unsupported=/أصفر|اصفر|وردي|رمادي|برتقالي|yellow|pink|orange|grey|gray|grau|gelb|rosa/i
 const colors=Object.entries(COLOR_TESTS).filter(([,pattern])=>pattern.test(prompt))
 if(colors.length===0&&!colorSubject.test(prompt)&&!unsupported.test(prompt))
  return null
 if(colors.length===0)
  return 'أستطيع تعديل خامة المجسم، لكنك لم تحدد اللون. ما اللون المطلوب؟ يمكنك اختيار الذهبي أو الفضي أو الأحمر أو الأزرق أو الأخضر أو البنفسجي أو الأسود أو الأبيض.'
 if(colors.length>1)
  return 'وجدت أكثر من لون في طلبك. محرك الخامات الحالي يطبّق لونًا أساسيًا واحدًا لكل عملية. أي لون تريد تطبيقه أولًا؟'
 return null
}
export const requiresRelief=(prompt:string)=>/\b2[.,]?5d\b|بارز|relief|heightfield|نحت سطحي/i.test(prompt)
/** Deterministic creator intent is an AUTHORITATIVE routing constraint.
 * An LLM may hallucinate six copies of Gifts for "all studios".
 * Never allow a hallucinated/duplicated specialist selection to publish
 * or silently omit a department the creator named explicitly.
 * The LLM still makes its own NEXT TOOL selection after observations.
 */
export function normalizeAgentDecision(step:AgentStep,prompt:string):AgentStep{
 const explicit=detectDirectorTargets(prompt)
 const unique=[...new Set(step.targets)]
 // Creator exclusions override even an earlier "جميع الأقسام" instruction.
 // This avoids copying a private source into an explicitly excluded studio.
 const excluded=new Set<DirectorTarget>()
 const normalized=prompt.normalize('NFKC')
 const exclusions=/(?:بدون|ما عدا|عدا|إلا|الا|except|without|außer|ausser|ohne)\s+([^،,.؛\n]{1,75})/gi
 for(const match of normalized.matchAll(exclusions)){
  // A contrastive clause ("بدون اللايف لكن في العالم") is not an exclusion.
  const clause=match[1].split(/\s+(?:لكن|ولكن|بل|instead|however|aber|sondern)\s+/i)[0]
  for(const target of detectDirectorTargets(clause))excluded.add(target)
 }
 const selected=explicit.length?[...explicit]:unique
 // No specialist was requested for a result-only operation. The neutral
 // World mesh preview profile is an INTERNAL manifest placeholder only:
 // present_asset NEVER persists or hands off anything to World/Live.
 const localOnly=step.action==='present_asset'&&explicit.length===0
 return {...step,
  targets:localOnly?['world']:selected.filter(target=>!excluded.has(target)),
  color:step.action==='recolor_asset'?step.color:null,
 }
}
/** Proof-driven execution state. Model messages and user-supplied success
 * strings are NOT proof; these are intended only to gate the browser executor.
 * Actual GLB inspections, SHA256 and exported files are verified in the
 * browser before a successful observation is generated.
 */
export function requiredAgentAction(request:AgentRequest):AgentStep['action']{
 const history=request.steps
 const succeeded=(action:AgentStep['action'])=>history.some(
  x=>x.action===action&&x.ok)
 const hasFailure=history.some(x=>!x.ok)
 // Never ask the model to retry a failed tool, particularly a paid GPU.
 if(hasFailure||succeeded('dispatch_asset')||succeeded('present_asset'))return 'finish'
 if(request.workingSource==='none')return 'finish'
 if(request.workingSource==='image')
  return requiresRelief(request.prompt)?'generate_relief':'generate_3d_gpu'
 const materialRequested=MATERIAL_EDIT.test(request.prompt)&&
  Object.values(COLOR_TESTS).some(test=>test.test(request.prompt))
 if(materialRequested&&!succeeded('recolor_asset'))return 'recolor_asset'
 const lastChange=history.reduce((index,event,i)=>
  event.ok&&['generate_relief','generate_3d_gpu','recolor_asset'].includes(event.action)?i:index,-1)
 const inspected=history.slice(lastChange+1).some(
  event=>event.action==='inspect_asset'&&event.ok)
 if(!inspected)return 'inspect_asset'
 // An inspect-only request must not silently fan out a creator's file.
 const explicitDelivery=/(?:أرسل|ارسل|وزع|جهز|جهّز|توزيع|send|dispatch|deliver|an\s+(?:alle|die)|verteile|sende|schicke)/i.test(request.prompt)
 const inspectionOnly=/^(?:افحص|افحصي|تحقق|فحص|check|inspect|prüf|ueberprüf|überprüf)/i.test(request.prompt.trim())&&
  !explicitDelivery
 const wantsDelivery=explicitDelivery||
  (!inspectionOnly&&detectDirectorTargets(request.prompt).length>0)
 const changed=history.some(event=>event.ok&&
  ['generate_relief','generate_3d_gpu','recolor_asset'].includes(event.action))
 return wantsDelivery?'dispatch_asset':changed?'present_asset':'finish'
}
export const agentAllowedTargets=(targets:readonly DirectorTarget[]) =>
 targets.length>0&&targets.length<=6&&
 new Set(targets).size===targets.length&&
 targets.every(t=>DIRECTOR_TARGETS.includes(t))
/** Defense-in-depth: the language model cannot invoke arbitrary code, choose
 * unmentioned colors, silently downgrade full-3D to 2.5D or publish. */
export function validateAgentStep(step:AgentStep,request:AgentRequest):
 {ok:boolean;reason:string}{
 if(!agentAllowedTargets(step.targets))return {ok:false,reason:'invalid_target_set'}
 if(step.action==='generate_relief'&&
  (request.workingSource!=='image'||!requiresRelief(request.prompt)))
  return {ok:false,reason:'relief_not_explicitly_requested'}
 if(step.action==='generate_3d_gpu'&&
  (request.workingSource!=='image'||requiresRelief(request.prompt)||
   request.steps.some(s=>s.action==='generate_3d_gpu')))
  return {ok:false,reason:'paid_gpu_cannot_repeat'}
 if(step.action==='recolor_asset'){
  if(request.steps.some(event=>event.action==='recolor_asset'&&event.ok))
   return {ok:false,reason:'material_already_changed'}
  if(request.workingSource!=='glb'||!step.color||
      !MATERIAL_EDIT.test(request.prompt)||
      !COLOR_TESTS[step.color].test(request.prompt))
   return {ok:false,reason:'unapproved_material_change'}
 }
 if(['inspect_asset','dispatch_asset','present_asset'].includes(step.action)&&
   request.workingSource!=='glb')
  return {ok:false,reason:'glb_required'}
 if(step.action==='dispatch_asset'&&
   request.steps.some(event=>event.action==='recolor_asset'&&!event.ok))
  return {ok:false,reason:'requested_recolor_failed_no_silent_fallback'}
 if(step.action==='dispatch_asset'){
  const expected=normalizeAgentDecision(step,request.prompt).targets
  const matches=step.targets.length===expected.length&&
   step.targets.every((target,i)=>target===expected[i])
  if(!matches)return {ok:false,reason:
   /(?:جميع|كل|كافة)\s+(?:الأقسام|الاقسام)|all\s+studios/i.test(request.prompt)?
    'all_studios_requested':'creator_destinations_mismatch'}
 }
 if(step.action==='inspect_asset'){
  const lastChange=request.steps.reduce((index,event,i)=>
   ['generate_relief','generate_3d_gpu','recolor_asset'].includes(event.action)&&event.ok?i:index,-1)
  if(request.steps.slice(lastChange+1).some(event=>event.action==='inspect_asset'&&event.ok))
   return {ok:false,reason:'already_inspected_unchanged_asset'}
 }
 if(step.action==='present_asset'&&
   request.steps.some(x=>x.action==='present_asset'&&x.ok))
  return {ok:false,reason:'local_preview_already_shown'}
 if(request.steps.some(x=>['dispatch_asset','present_asset'].includes(x.action)&&x.ok)&&
    step.action!=='finish')
  return {ok:false,reason:'dispatch_already_complete'}
 if(step.action==='finish'&&request.steps.some(event=>
   ['generate_relief','generate_3d_gpu','recolor_asset'].includes(event.action)&&event.ok)&&
   !request.steps.some(event=>
    ['dispatch_asset','present_asset'].includes(event.action)&&event.ok))
  return {ok:false,reason:'generated_file_must_be_delivered'}
 if(step.action==='finish'&&
   /(?:أرسل|ارسل|وزع|جهز|جهّز|توزيع|send|dispatch|deliver)/i.test(request.prompt)&&
   request.workingSource==='glb'&&
   !request.steps.some(event=>event.action==='dispatch_asset'&&event.ok))
  return {ok:false,reason:'requested_distribution_not_done'}
 if(step.action==='finish'&&request.steps.length===0&&
   request.workingSource!=='none')
  return {ok:false,reason:'cannot_claim_result_without_tool'}
 const required=requiredAgentAction(request)
 if(step.action!==required)
  return {ok:false,reason:'required_next_action_'+required}
 return {ok:true,reason:'ok'}
}
