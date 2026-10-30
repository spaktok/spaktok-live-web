import type {DirectorTarget} from './spaktok-ai-director'

/** Safe finite commands for GPU execution. Text is for routing departments;
 * TRELLIS.2 is image-conditioned, NOT text-conditioned. No shell commands.
 */
export type ForgeGpuProfile='mobile-preview'|'detail-preview'|'studio-hd'
export type ForgeGpuPlan=Readonly<{
 version:1
 task:'image-to-3d'
 engine:'trellis2'
 profile:ForgeGpuProfile
 destinations:readonly DirectorTarget[]
 publicRelease:false
}>
const allowed:ReadonlySet<DirectorTarget>=new Set([
 'avatar','live','filter','gift','world',
])
export function planForgeGpuGeneration(input:Readonly<{
 description:string
 targets:readonly DirectorTarget[]
 preferredProfile?:ForgeGpuProfile
}>):ForgeGpuPlan{
 if(input.description.length>1000||
  !input.targets.length||input.targets.length>5||
  !input.targets.every(t=>allowed.has(t)))
  throw Error('forge_gpu_plan_invalid')
 if(input.preferredProfile!==undefined&&
  !['mobile-preview','detail-preview','studio-hd'].includes(input.preferredProfile))
  throw Error('forge_gpu_plan_invalid_profile')
 const targets=[...new Set(input.targets)]
 // Prioritize mobile budgets for real-time face tracking and live use.
 const mobile=targets.some(t=>t==='avatar'||t==='live'||t==='filter')
 return {
  version:1,task:'image-to-3d',engine:'trellis2',
  profile:input.preferredProfile??(mobile?'mobile-preview':'detail-preview'),
  destinations:targets,publicRelease:false,
 }
}
