import type {StudioGlbAudit} from './reality-production-glb-audit'
import {
 DIRECTOR_TARGETS,type DirectorTarget,
} from './spaktok-ai-director'
import {
 RODIN_HEAD_CALIBRATED_SHA256,RODIN_HEAD_PREVIEW_HEIGHT_M,
} from './rodin-owner-head'

/** A small, safe, versioned build manifest. Contains NO image or GLB bytes,
 * access tokens, signed URLs or authorization to publish. The real asset
 * remains in the creator's browser, keyed by its SHA-256 fingerprint.
 */
export const STUDIO_FANOUT_MANIFEST_VERSION=1 as const
export const STUDIO_FANOUT_MAX_JSON_BYTES=24*1024
export type StudioOutputState='private-preview'|'needs-optimization'
export type StudioOutputProfile=Readonly<{
 target:DirectorTarget
 destination:string
 state:StudioOutputState
 visualScale:'auto-fit-preview'
 anchor:'head'|'nose_bridge'|'object-center'|'ground'
 rigNeeded:boolean
 collisionNeeded:boolean
 animationNeeded:boolean
 cameraTrackingNeeded:boolean
 blockers:readonly string[]
 published:false
}>
export type StudioFanoutManifest=Readonly<{
 format:'SpaktokStudioFanout';version:1;createdAt:string
 source:Readonly<{
  fileName:string;sha256:string;bytes:number
  triangles:number;textureImages:number;morphTargets:number
  animations:number;skins:number
  uv:boolean;normals:boolean;pbr:boolean
 }>
 project:Readonly<{
  description:string
  rights:'original'|'licensed'
  rightsAttested:boolean
  outputTargets:readonly DirectorTarget[]
  gpuJobsUsed:0|1
  sourceEngine:'existing-glb'|'ai-360-gpu'|'browser-2.5d'
 }>
 calibration:Readonly<{
  verified:false
  upAxis:'+Y (GLB convention)'
  forwardAxis:'unverified'
  actualScaleMetersPerUnit:null
  optionalReferenceHeadHeightMeters:number|null
 }>
 outputs:readonly StudioOutputProfile[]
 review:Readonly<{
  androidHardwareTested:false
  rightsReviewedByModerator:false
  liveApproved:false
  giftMonetizationApproved:false
  worldPublished:false
  publicReleaseApproved:false
 }>
}>
const DESTINATIONS:Readonly<Record<DirectorTarget,string>>={
 avatar:'/avatar-studio',
 live:'/avatar-studio',
 filter:'/reality-studio',
 gift:'/gift-studio',
 world:'/spaktok-world',
}
const safeFile=(s:string)=>/^[^\\/\x00-\x1f]{1,120}\.glb$/i.test(s)
const validHash=(s:string)=>/^[a-f0-9]{64}$/.test(s)
const validIso=(s:string)=>!Number.isNaN(Date.parse(s))&&
 /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/.test(s)
export function createStudioFanoutManifest(input:Readonly<{
 fileName:string;sha256:string;bytes:number;audit:StudioGlbAudit
 description:string;rights:'original'|'licensed'
 targets:readonly DirectorTarget[]
 gpuJobsUsed?:0|1;createdAt?:string
 sourceEngine?:'existing-glb'|'ai-360-gpu'|'browser-2.5d'
}>):StudioFanoutManifest{
 if(!safeFile(input.fileName)||!validHash(input.sha256)||
  !Number.isSafeInteger(input.bytes)||input.bytes<28||
  input.bytes>35*1024*1024||
  !input.audit.valid||!input.audit.selfContained||
  !Number.isSafeInteger(input.audit.triangles)||
  input.audit.triangles<1||input.audit.triangles>2_000_000)
  throw Error('studio_fanout_source_invalid')
 const targets=Array.from(new Set(input.targets))
 if(!targets.length||targets.length>DIRECTOR_TARGETS.length||
  !targets.every(target=>DIRECTOR_TARGETS.includes(target)))
  throw Error('studio_fanout_targets_invalid')
 if(input.description.length>1000||
  !['original','licensed'].includes(input.rights))
  throw Error('studio_fanout_project_invalid')
 const mobileBlocked=input.bytes>15*1024*1024||
  input.audit.triangles>150000||input.audit.textures>12||
  !input.audit.hasUV||!input.audit.hasNormals||
  !input.audit.hasPBR
 const technicalReasons=[
  ...(input.bytes>15*1024*1024?['over_15mb_delivery_limit']:[]),
  ...(input.audit.triangles>150000?['mobile_triangle_limit']:[]),
  ...(input.audit.textures>12?['mobile_texture_limit']:[]),
  ...(!input.audit.hasUV?['missing_uv']:[]),
  ...(!input.audit.hasNormals?['missing_normals']:[]),
  ...(!input.audit.hasPBR?['missing_pbr']:[]),
 ]
 const outputs:StudioOutputProfile[]=targets.map(target=>{
  const blockers=[...technicalReasons]
  const avatar=target==='avatar'||target==='live'
  if(input.sourceEngine==='browser-2.5d')
   blockers.push('local_relief_is_not_a_full_360_reconstruction')
  if(avatar)blockers.push(
   input.audit.rigTargets?'face_rig_visual_qa_required':'face_morph_targets_missing')
  if(target==='live')blockers.push('camera_tracking_and_agora_not_verified')
  if(target==='filter')blockers.push('face_anchor_and_occlusion_not_calibrated')
  if(target==='gift')blockers.push('gift_effect_animation_and_payment_review_required')
  if(target==='world')blockers.push('collision_scale_and_lod_not_verified')
  blockers.push('real_android_fps_and_thermal_not_verified')
  blockers.push('human_rights_and_publication_review_required')
  return {
   target,destination:DESTINATIONS[target],
   state:mobileBlocked?'needs-optimization':'private-preview',
   visualScale:'auto-fit-preview',
   anchor:avatar?'head':target==='filter'?'nose_bridge':
    target==='world'?'ground':'object-center',
   rigNeeded:avatar,collisionNeeded:target==='world',
   animationNeeded:target==='gift',
   cameraTrackingNeeded:target==='filter'||target==='live',
   blockers,published:false,
  }
 })
 const manifest:StudioFanoutManifest={
  format:'SpaktokStudioFanout',version:1,
  createdAt:input.createdAt??new Date().toISOString(),
  source:{
   fileName:input.fileName,sha256:input.sha256,bytes:input.bytes,
   triangles:input.audit.triangles,
   textureImages:input.audit.textures,
   morphTargets:input.audit.rigTargets,
   animations:input.audit.animations,skins:input.audit.skins,
   uv:input.audit.hasUV,normals:input.audit.hasNormals,
   pbr:input.audit.hasPBR,
  },
  project:{
   description:input.description.trim(),
   rights:input.rights,rightsAttested:true,
   outputTargets:targets,gpuJobsUsed:input.gpuJobsUsed??0,
   sourceEngine:input.sourceEngine??'existing-glb',
  },
  calibration:{
   verified:false,
   upAxis:'+Y (GLB convention)',forwardAxis:'unverified',
   actualScaleMetersPerUnit:null,
   optionalReferenceHeadHeightMeters:
    input.sha256===RODIN_HEAD_CALIBRATED_SHA256?
     RODIN_HEAD_PREVIEW_HEIGHT_M:null,
  },
  outputs,
  review:{
   androidHardwareTested:false,rightsReviewedByModerator:false,
   liveApproved:false,giftMonetizationApproved:false,
   worldPublished:false,publicReleaseApproved:false,
  },
 }
 assertStudioFanoutManifest(manifest)
 return manifest
}
export function assertStudioFanoutManifest(value:unknown):
 asserts value is StudioFanoutManifest{
 if(!value||typeof value!=='object'||Array.isArray(value))
  throw Error('studio_fanout_manifest_invalid')
 const v=value as StudioFanoutManifest
 if(v.format!=='SpaktokStudioFanout'||v.version!==1||
  typeof v.createdAt!=='string'||!validIso(v.createdAt)||
  !v.source||!safeFile(v.source.fileName)||
  !validHash(v.source.sha256)||
  !Number.isSafeInteger(v.source.bytes)||
  v.source.bytes<28||v.source.bytes>35*1024*1024||
  !v.project||v.project.rightsAttested!==true||
  !['original','licensed'].includes(v.project.rights)||
  typeof v.project.description!=='string'||
  v.project.description.length>1000||
  !['existing-glb','ai-360-gpu','browser-2.5d'].includes(
   v.project.sourceEngine)||
  !Array.isArray(v.project.outputTargets)||
  !Array.isArray(v.outputs)||v.outputs.length<1||
  v.outputs.length>DIRECTOR_TARGETS.length||
  v.outputs.length!==v.project.outputTargets.length||
  !v.project.outputTargets.every(
   t=>DIRECTOR_TARGETS.includes(t))||
  new Set(v.project.outputTargets).size!==v.outputs.length)
  throw Error('studio_fanout_manifest_invalid')
 for(let i=0;i<v.outputs.length;i++){
  // Array.isArray narrows a readonly tuple/array to any[] in TS.
  // Reassert the already validated schema before indexed access.
  const out=v.outputs[i] as StudioOutputProfile
  if(!out||!DIRECTOR_TARGETS.includes(out.target)||
   out.target!==v.project.outputTargets[i]||
   out.destination!==DESTINATIONS[out.target]||
   !['private-preview','needs-optimization'].includes(out.state)||
   out.published!==false||!Array.isArray(out.blockers)||
   !out.blockers.includes('human_rights_and_publication_review_required'))
   throw Error('studio_fanout_output_invalid')
 }
 if(v.review?.publicReleaseApproved!==false||
  v.review?.androidHardwareTested!==false||
  v.review?.liveApproved!==false||
  v.review?.worldPublished!==false||
  v.review?.giftMonetizationApproved!==false||
  v.calibration?.verified!==false||
  v.calibration.actualScaleMetersPerUnit!==null)
  throw Error('studio_fanout_publication_forbidden')
 if(new TextEncoder().encode(JSON.stringify(value)).length>
  STUDIO_FANOUT_MAX_JSON_BYTES)
  throw Error('studio_fanout_manifest_too_large')
}
