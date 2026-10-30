/** Deterministic, auditable private director-to-department dispatch.
 * One generated GLB, many independent destination previews. This creates
 * instructions/hand-off tasks, NOT automatic rigging, physics or publication.
 */
import {DIRECTOR_TARGETS,type DirectorTarget} from './spaktok-ai-director'
import {
 assertStudioFanoutManifest,type StudioFanoutManifest,
} from './spaktok-studio-fanout'

export const DIRECTOR_DEPARTMENT_ROUTES:Readonly<Record<DirectorTarget,string>>={
 avatar:'/avatar-studio?from=ai-director',
 live:'/avatar-studio?from=ai-director',
 filter:'/reality-studio?from=ai-director',
 gift:'/gift-studio?from=ai-director',
 world:'/spaktok-world?from=ai-director',
 video:'/video-studio?from=ai-director',
}
export type DirectorDepartmentDispatch=Readonly<{
 target:DirectorTarget
 route:string
 status:'private-preview-staged'|'blocked-geometry'
 action:'open-local-preview'|'optimize-glb-first'
 requiresRig:boolean
 requiresAnimation:boolean
 requiresCameraTracking:boolean
 requiresWorldCollision:boolean
 blockers:readonly string[]
 published:false
}>
export type DirectorDispatch=Readonly<{
 format:'SpaktokDirectorDispatch';version:1
 sourceSha256:string
 sourceFileName:string
 gpuJobsUsed:0|1
 steps:readonly DirectorDepartmentDispatch[]
 publication:'private-draft'
 uploadToCloud:false
}>
export function createDirectorDispatch(
 manifest:StudioFanoutManifest,
):DirectorDispatch{
 assertStudioFanoutManifest(manifest)
 const steps:DirectorDepartmentDispatch[]=manifest.outputs.map(output=>{
  if(!DIRECTOR_TARGETS.includes(output.target))
   throw Error('director_dispatch_invalid_target')
  const ready=output.state==='private-preview'
  return {
   target:output.target,
   route:DIRECTOR_DEPARTMENT_ROUTES[output.target],
   status:ready?'private-preview-staged':'blocked-geometry',
   action:ready?'open-local-preview':'optimize-glb-first',
   requiresRig:output.rigNeeded,
   requiresAnimation:output.animationNeeded,
   requiresCameraTracking:output.cameraTrackingNeeded,
   requiresWorldCollision:output.collisionNeeded,
   blockers:[...output.blockers],
   published:false,
  }
 })
 if(!steps.length||new Set(steps.map(s=>s.target)).size!==steps.length)
  throw Error('director_dispatch_invalid_steps')
 return {
  format:'SpaktokDirectorDispatch',version:1,
  sourceSha256:manifest.source.sha256,
  sourceFileName:manifest.source.fileName,
  gpuJobsUsed:manifest.project.gpuJobsUsed,
  steps,publication:'private-draft',uploadToCloud:false,
 }
}
