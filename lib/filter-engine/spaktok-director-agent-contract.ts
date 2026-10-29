import {z} from 'zod'
import {DIRECTOR_TARGETS,type DirectorTarget} from './spaktok-ai-director'

export const AGENT_ACTIONS=[
 'inspect_asset','generate_relief','generate_3d_gpu','recolor_asset',
 'dispatch_asset','finish',
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
 gold:/ذهبي|ذهبية|gold|golden/i,
 silver:/فضي|فضية|silver/i,
 red:/احمر|أحمر|حمراء|red/i,
 blue:/ازرق|أزرق|زرقاء|blue/i,
 green:/اخضر|أخضر|خضراء|green/i,
 purple:/بنفسجي|بنفسجية|أرجواني|purple|violet/i,
 black:/اسود|أسود|سوداء|black/i,
 white:/ابيض|أبيض|بيضاء|white/i,
}
const MATERIAL_EDIT=/غيّر|غير|بدّل|بدل|لوّن|لون|اجعل|خليه|خلّي|حوّل|حول|paint|recolor|make|color|colour|material|خامة/i
export const requiresRelief=(prompt:string)=>/\b2[.,]?5d\b|بارز|relief|heightfield|نحت سطحي/i.test(prompt)
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
  if(request.workingSource!=='glb'||!step.color||
      !MATERIAL_EDIT.test(request.prompt)||
      !COLOR_TESTS[step.color].test(request.prompt))
   return {ok:false,reason:'unapproved_material_change'}
 }
 if(['inspect_asset','dispatch_asset'].includes(step.action)&&
   request.workingSource!=='glb')
  return {ok:false,reason:'glb_required'}
 if(step.action==='dispatch_asset'&&
  /(?:جميع|كل|كافة)\s+(?:الأقسام|الاقسام)|all\s+studios/i.test(request.prompt)&&
  step.targets.length!==DIRECTOR_TARGETS.length)
  return {ok:false,reason:'all_studios_requested'}
 if(step.action==='inspect_asset'){
  const lastChange=request.steps.reduce((index,event,i)=>
   ['generate_relief','generate_3d_gpu','recolor_asset'].includes(event.action)&&event.ok?i:index,-1)
  if(request.steps.slice(lastChange+1).some(event=>event.action==='inspect_asset'&&event.ok))
   return {ok:false,reason:'already_inspected_unchanged_asset'}
 }
 if(request.steps.some(x=>x.action==='dispatch_asset'&&x.ok)&&
    step.action!=='finish')
  return {ok:false,reason:'dispatch_already_complete'}
 if(step.action==='finish'&&request.steps.length===0&&
   request.workingSource!=='none')
  return {ok:false,reason:'cannot_claim_result_without_tool'}
 return {ok:true,reason:'ok'}
}
