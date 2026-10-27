/** Rodin is an optional OFFLINE authoring provider for SpakTok Studio.
 * This module only prepares a vendor-compatible form specification;
 * it NEVER uploads photos, bills credits or stores an API key.
 *
 * The server-only paid adapter is a separate integration and must remain
 * disabled until creator authentication, billing permission, D1 ownership,
 * R2 private storage and asset approval are available.
 */
import type {StudioAssetType,StudioUsageRights} from './reality-production-pipeline'

export const RODIN_WORKSPACE_URL='https://hyper3d.ai/workspace/rodin'
export const RODIN_DOCS_URL='https://docs.hyper3d.ai/en/api-specification/rodin-gen2-5'
export const RODIN_API_BASE='https://api.hyper3d.com/api/v2'
export type RodinTier='Gen-2.5-Low'|'Gen-2.5-Medium'|'Gen-2.5-High'
export type RodinMesh='Raw'|'Quad'
export type RodinQuality='extra-low'|'low'|'medium'|'high'
export type RodinTexture='PBR'|'Shaded'|'All'
export type RodinMode='avatar'|'face-mask'|'accessory'
export type RodinGenerationDraft=Readonly<{
 provider:'hyper3d-rodin'
 format:'SpakTokRodinDraft';version:1
 stage:'not-submitted';requiresExplicitUploadConsent:true
 rights:Exclude<StudioUsageRights,'unverified'>
 intent:RodinMode
 sourceFileNames:readonly string[]
 tier:RodinTier;mesh_mode:RodinMesh
 quality:RodinQuality;material:RodinTexture
 geometry_file_format:'glb'
 prompt:string
 qualityGate:readonly string[]
 /** Value is from provider docs, NOT a payment authorization or quote. */
 indicativeBaseCredits:0.5
}>
export const RODIN_STYLE_OPTIONS:ReadonlyArray<Readonly<{
 id:RodinMode;label:string;prompt:string;qa:readonly string[]
}>>=[
 {id:'avatar',label:'شخصية كاملة / أفاتار',
  prompt:'A separate, complete 3D stylized character with clean face geometry, premium physically based skin, distinct hair volume, complete rear and side head, neutral expression and realistic eye materials; preserve creative identity; suitable for subsequent rigging and mobile retopology.',
  qa:['Real 3D depth front, side and back','UV / PBR atlas and normals','Face expressions require separate blendshape rig','Phone LOD and visual match']},
 {id:'face-mask',label:'قناع وجه',
  prompt:'A clean self-contained 3D face shell in neutral expression, with smooth continuous UVs, physically based materials and stable facial symmetry; intended for precise retopology and head-mounted nonrigid face rigging.',
  qa:['Must be fitted to wearer facial landmarks','Require nonrigid deformation and occlusion','No fixed-face identity replacement without consent']},
 {id:'accessory',label:'تاج / شعر / نظارات / إكسسوار',
  prompt:'A production-quality mobile AR accessory with clean topology, baked normal detail, consistent PBR materials, transparent sections only where necessary and a stable head anchor.',
  qa:['Size and pivot validated','AR mount and face occlusion','Mobile triangle budget and draw calls']},
]
const validName=(s:string)=>s.length>=3&&s.length<=150&&
 !/[\u0000-\u001f/\\]/.test(s)
export function createRodinGenerationDraft(options:Readonly<{
 assetType:StudioAssetType;rights:StudioUsageRights
 filenames:readonly string[];tier:RodinTier;mesh:RodinMesh
 quality:RodinQuality;material:RodinTexture
}>):RodinGenerationDraft{
 if(options.rights==='unverified')throw Error('rodin_rights_not_verified')
 if(options.filenames.length<1||options.filenames.length>5||
  !options.filenames.every(validName))throw Error('rodin_invalid_reference_files')
 if(!['Gen-2.5-Low','Gen-2.5-Medium','Gen-2.5-High'].includes(options.tier)||
  !['Raw','Quad'].includes(options.mesh)||
  !['extra-low','low','medium','high'].includes(options.quality)||
  !['PBR','Shaded','All'].includes(options.material))
  throw Error('rodin_invalid_generation_options')
 const intent:RodinMode=options.assetType==='wearable'?'accessory':
  options.assetType==='full-avatar'?'avatar':
  options.assetType==='face-mask'?'face-mask':'avatar'
 const profile=RODIN_STYLE_OPTIONS.find(x=>x.id===intent)!
 return {
  provider:'hyper3d-rodin',format:'SpakTokRodinDraft',
  version:1,stage:'not-submitted',requiresExplicitUploadConsent:true,
  rights:options.rights,intent,
  sourceFileNames:[...options.filenames],
  tier:options.tier,mesh_mode:options.mesh,quality:options.quality,
  material:options.material,geometry_file_format:'glb',
  prompt:profile.prompt,qualityGate:profile.qa,
  indicativeBaseCredits:.5,
 }
}
/** Validate a provider job response without leaking upstream identifiers.
 * Status subscription keys are private; NEVER store them in public UI.
 */
export function parseRodinSubmission(value:unknown):Readonly<{
 uuid:string;subscriptionKey:string
}>{
 if(!value||typeof value!=='object')throw Error('rodin_submission_invalid')
 const v=value as Record<string,unknown>
 if(typeof v.error==='string'&&v.error.length)
  throw Error('rodin_provider_rejected')
 const jobs=v.jobs as Record<string,unknown>|null
 const id=v.uuid, key=jobs?.subscription_key
 const uuid=/^[\da-f]{8}-[\da-f]{4}-[\da-f]{4}-[\da-f]{4}-[\da-f]{12}$/i
 if(typeof id!=='string'||!uuid.test(id)||
  typeof key!=='string'||!key||key.length>1024)
  throw Error('rodin_submission_missing_identifiers')
 return {uuid:id,subscriptionKey:key}
}
export function evaluateRodinStatuses(value:unknown):'pending'|'complete'|'failed'{
 if(!value||typeof value!=='object')throw Error('rodin_status_invalid')
 const obj=value as Record<string,unknown>
 if(typeof obj.error==='string'&&obj.error.length)throw Error('rodin_provider_status_error')
 if(!Array.isArray(obj.jobs)||!obj.jobs.length)throw Error('rodin_status_no_jobs')
 const states=obj.jobs.map((j:unknown)=>{
  const status=(j&&typeof j==='object')?(j as Record<string,unknown>).status:null
  if(!['Waiting','Generating','Done','Failed'].includes(String(status)))
   throw Error('rodin_status_unknown')
  return status
 })
 if(states.includes('Failed'))return 'failed'
 return states.every(s=>s==='Done')?'complete':'pending'
}
