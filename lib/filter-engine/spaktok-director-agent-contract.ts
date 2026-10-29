import {z} from 'zod'
import {DIRECTOR_TARGETS,type DirectorTarget} from './spaktok-ai-director'
import {detectDirectorMaterialStyle} from './spaktok-director-chat-material'

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
 steps:z.array(z.object({
  action:z.enum(AGENT_ACTIONS),
  ok:z.boolean(),
  detail:z.string().max(300),
 }).strict()).max(6),
 imagePreview:z.string().max(230000).nullable(),
}).strict()
export type AgentRequest=z.infer<typeof agentRequestSchema>
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
  (request.workingSource!=='image'||request.steps.some(s=>s.action==='generate_3d_gpu')))
  return {ok:false,reason:'paid_gpu_cannot_repeat'}
 if(step.action==='recolor_asset'){
  const requested=detectDirectorMaterialStyle(request.prompt)
  if(request.workingSource!=='glb'||!requested||
      step.color!==requested.id)
   return {ok:false,reason:'unapproved_material_change'}
 }
 if(['inspect_asset','dispatch_asset'].includes(step.action)&&
   request.workingSource!=='glb')
  return {ok:false,reason:'glb_required'}
 if(step.action==='finish'&&request.steps.length===0&&
   request.workingSource!=='none')
  return {ok:false,reason:'cannot_claim_result_without_tool'}
 return {ok:true,reason:'ok'}
}
