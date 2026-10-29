import type {StudioGlbAudit} from './reality-production-glb-audit'

/** AI Director V1 is an auditable deterministic ROUTER, not an LLM.
 * Text selects intended uses; it does not control the GPU 3D geometry yet.
 * Never describe an unrigged GLB as a camera-ready avatar.
 */
export const DIRECTOR_TARGETS=['avatar','live','filter','gift','world','video'] as const
export type DirectorTarget=typeof DIRECTOR_TARGETS[number]
export type DirectorStage='source'|'generation'|'geometry'|'rig'|'filter'|
 'gift-animation'|'world-placement'|'video-composition'|'mobile-qa'|'publish'
export type DirectorStageStatus='ready'|'requires-work'|'blocked'
export type DirectorStageCheck=Readonly<{
 id:DirectorStage;status:DirectorStageStatus;reason:string
}>
export type DirectorPlan=Readonly<{
 format:'SpaktokDirectorPlan';version:1
 description:string;targets:readonly DirectorTarget[]
 stages:readonly DirectorStageCheck[]
 estimatedGpuJobs:0|1
 uploadsSourceImage:boolean
 publication:'private-draft'
}>
const TARGET_SYNONYMS:Readonly<Record<DirectorTarget,RegExp>>={
 avatar:/\bavatar\b|افاتار|أفاتار|افتار|أفتار|اڤاتار/,
 live:/\blive\b|لايف|بث|مباشر/,
 filter:/\bfilter\b|فلاتر|فلتر|قناع|mask|\bar\b/,
 gift:/\bgift\b|هدي[ةه]|هدايا|هدية|جفت/,
 world:/\bworld\b|عالم|خريطة|بيئة افتراضي[ةه]/,
 video:/\bvideo\b|فيديو|مقاطع|ريلز|reels|clip/,
}
export function detectDirectorTargets(description:string):readonly DirectorTarget[]{
 const normalized=description.normalize('NFKC').toLowerCase()
 // A creator can ask the Director to route ONE asset to all existing
 // departments using natural Arabic or English without five checkboxes.
 if(/(?:جميع|كل|كافة)\s+(?:الأقسام|الاقسام|الاستوديوهات|الستوديوهات|المحركات|الاقسام الموجودة)|(?:all|every)\s+(?:studios|departments|targets|sections)/i.test(normalized))
  return DIRECTOR_TARGETS
 return DIRECTOR_TARGETS.filter(t=>TARGET_SYNONYMS[t].test(normalized))
}
export function planSpaktokDirector(input:Readonly<{
 description:string
 targets:readonly DirectorTarget[]
 source:'image'|'glb'|'none'
 rightsApproved:boolean
 gpuAvailable:boolean
 localReliefSelected?:boolean
 transferApproved?:boolean
 computeApproved?:boolean
}>):DirectorPlan{
 const targets=Array.from(new Set(input.targets)).filter(
  (t):t is DirectorTarget=>DIRECTOR_TARGETS.includes(t))
 if(!targets.length)targets.push(...detectDirectorTargets(input.description))
 const hasSource=input.source!=='none'
 const readySource=hasSource&&input.rightsApproved
 const needsGpu=input.source==='image'&&!input.localReliefSelected
 const imageNeedsGpu=needsGpu&&!input.gpuAvailable
 const paidConsented=input.transferApproved===true&&
  input.computeApproved===true
 const localRelief=input.source==='image'&&input.localReliefSelected===true
 const geometryReady=input.source==='glb'&&readySource
 const stages:DirectorStageCheck[]=[
  {id:'source',status:!hasSource?'blocked':input.rightsApproved?'ready':'blocked',
   reason:!hasSource?'image_or_glb_required':
    input.rightsApproved?'source_selected_with_rights_attestation':
    'creator_rights_confirmation_required'},
  {id:'generation',status:!readySource?'blocked':
   needsGpu?(input.gpuAvailable&&paidConsented?'ready':'blocked'):'ready',
   reason:!hasSource?'source_missing':
    !input.rightsApproved?'rights_unverified':
    needsGpu?(imageNeedsGpu?'licensed_gpu_not_configured':
     paidConsented?'one_approved_gpu_job':'explicit_image_transfer_and_gpu_consent_required'):
     localRelief?'browser_only_2_5d_relief_not_360':
     'reuse_existing_glb_zero_gpu'},
  {id:'geometry',status:geometryReady?'ready':'blocked',
   reason:geometryReady?'requires_actual_glb_audit':'awaiting_valid_glb'},
 ]
 if(targets.includes('avatar')||targets.includes('live'))
  stages.push({id:'rig',status:'requires-work',
   reason:'requires_authored_verified_morph_targets_and_skeleton_if_full_body'})
 if(targets.includes('filter'))
  stages.push({id:'filter',status:'requires-work',
   reason:'requires_face_anchor_occlusion_calibration_and_camera_qa'})
 if(targets.includes('gift'))
  stages.push({id:'gift-animation',status:'requires-work',
   reason:'requires_gift_animation_render_qa_and_monetization_review'})
 if(targets.includes('world'))
  stages.push({id:'world-placement',status:'requires-work',
   reason:'requires_scale_collision_lod_and_world_integration'})
 if(targets.includes('video'))
  stages.push({id:'video-composition',status:'requires-work',
   reason:'requires_creator_video_timeline_keyframes_and_export_qa'})
 stages.push({id:'mobile-qa',status:'requires-work',
  reason:'requires_android_fps_memory_thermal_checks'})
 stages.push({id:'publish',status:'blocked',
  reason:'explicit_creator_review_rights_and_approval_required'})
 return {
  format:'SpaktokDirectorPlan',version:1,
  description:input.description.trim().slice(0,1000),targets,stages,
  estimatedGpuJobs:needsGpu&&readySource&&input.gpuAvailable&&paidConsented?1:0,
  uploadsSourceImage:needsGpu&&readySource&&input.gpuAvailable&&paidConsented,
  publication:'private-draft',
 }
}
export type DirectorAssetQA=Readonly<{
 valid:boolean;previewReady:boolean;requiresOptimization:boolean
 rigReady:boolean;giftAnimated:boolean;worldReady:boolean
 canPublish:boolean;triangles:number;textureImages:number;morphs:number
 issues:readonly string[]
}>
export function evaluateDirectorAsset(
 audit:StudioGlbAudit,bytes:number,targets:readonly DirectorTarget[],
):DirectorAssetQA{
 const issues:string[]=[]
 const valid=audit.valid&&audit.selfContained&&audit.triangles>0
 if(!valid)issues.push('invalid_or_external_glb')
 if(bytes>15*1024*1024)issues.push('mobile_asset_over_15mb')
 if(audit.triangles>150000)issues.push('mobile_triangle_budget_review')
 if(audit.textures>12)issues.push('mobile_texture_budget_review')
 if(!audit.hasUV)issues.push('missing_uv')
 if(!audit.hasNormals)issues.push('missing_normals')
 if(!audit.hasPBR)issues.push('missing_pbr')
 if(!audit.textures)issues.push('no_embedded_texture_images')
 if((targets.includes('avatar')||targets.includes('live'))&&audit.rigTargets===0)
  issues.push('face_morph_targets_missing')
 if(targets.includes('live'))
  issues.push('real_time_tracking_unverified')
 if(targets.includes('filter'))
  issues.push('face_anchor_and_occlusion_unverified')
 if(targets.includes('gift')&&audit.animations===0)
  issues.push('gift_animation_missing')
 if(targets.includes('world'))
  issues.push('world_collision_and_scale_unverified')
 issues.push('real_android_fps_and_thermal_unverified')
 issues.push('rights_and_public_release_unapproved')
 const requiresOptimization=bytes>15*1024*1024||
  audit.triangles>150000||audit.textures>12
 return {
  valid,previewReady:valid&&!requiresOptimization,
  requiresOptimization,
  rigReady:false,giftAnimated:false,worldReady:false,canPublish:false,
  triangles:audit.triangles,textureImages:audit.textures,
  morphs:audit.rigTargets,issues:[...new Set(issues)],
 }
}
