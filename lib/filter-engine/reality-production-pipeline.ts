import type {RealityAnchor} from './reality-effect-manifest'

/** Single source of truth for the authoring → rigging → preview production
 * workflow. This is a *candidate package*, never a remote release token.
 */
export const STUDIO_PRODUCTION_VERSION=1 as const
export type StudioAssetType='portrait-reference'|'full-avatar'|'face-mask'|'wearable'|'body-prop'
export type StudioUsageRights='unverified'|'original'|'licensed'
export type StudioMount='face'|'head'|'body'|'screen'
export type StudioStageId='source'|'rights'|'geometry'|'materials'|'rig'|'placement'|'device-qa'|'release'
export type StudioQuality='reference-only'|'technical-preview'|'rigged-preview'|'device-verified'
export type StudioProductionPackage=Readonly<{
 format:'SpakTokProductionPackage';version:1
 title:string;assetType:StudioAssetType
 sourceFile:string|null;sourceBytes:number|null
 sourceFormat:'image'|'glb'|'obj'|'none'
 rights:StudioUsageRights;rightsEvidence:string
 mount:StudioMount;anchor:RealityAnchor|null
 targets:readonly ('camera'|'local-live-preview'|'recorded-video')[]
 metrics:Readonly<{
 triangleCount:number|null;materialCount:number|null
 uvReady:boolean;normalReady:boolean;pbrReady:boolean
 textureCount:number;rigTargets:number;animationCount:number
 selfContained:boolean;validated:boolean
 }>
 tests:Readonly<{
 sourceReviewed:boolean;animationVerified:boolean
 mobileVisualApproved:boolean;deviceFpsVerified:boolean
 }>
 quality:StudioQuality
 published:false
}>
export type StudioStageResult=Readonly<{
 id:StudioStageId;status:'ready'|'needs-work'|'blocked'
 issues:readonly string[]
}>
export type StudioReview=Readonly<{
 steps:readonly StudioStageResult[]
 completeness:number;mayExportCandidate:boolean
 mayRequestReview:boolean;mayPublish:false;warnings:readonly string[]
}>
export const STUDIO_ASSET_TYPES:ReadonlyArray<Readonly<{value:StudioAssetType;label:string}>>=[
 {value:'portrait-reference',label:'صورة مرجعية لوجه 3D'},
 {value:'full-avatar',label:'أفاتار كامل يتحرك بتعابير الوجه'},
 {value:'face-mask',label:'قناع وجه مندمج بشبكة الوجه'},
 {value:'wearable',label:'تاج، نظارات، شعر أو إكسسوار'},
 {value:'body-prop',label:'مجسم يُربط بالجسم أو اليد'},
]
export const STUDIO_MOUNTS:ReadonlyArray<Readonly<{value:StudioMount;label:string}>>=[
 {value:'face',label:'شبكة الوجه'},
 {value:'head',label:'الرأس'},
 {value:'body',label:'الجسم / اليد'},
 {value:'screen',label:'إطار الفيديو'},
]
export const STUDIO_ANCHORS:readonly RealityAnchor[]=[
 'eyes_center','forehead_center','head_top','nose_bridge','nose_tip',
 'left_temple','right_temple','left_ear','right_ear','upper_lip',
 'lower_lip','chin','jaw_left','jaw_right',
]
const validName=(s:string,max:number)=>s.length>0&&s.length<=max&&!/[\x00-\x1f]/.test(s)
export function createStudioProductionPackage():StudioProductionPackage{
 return {
  format:'SpakTokProductionPackage',version:1,title:'SpakTok New Effect',
  assetType:'face-mask',sourceFile:null,sourceBytes:null,sourceFormat:'none',
  rights:'unverified',rightsEvidence:'',
  mount:'face',anchor:'nose_bridge',
  targets:['camera','local-live-preview','recorded-video'],
  metrics:{
   triangleCount:null,materialCount:null,uvReady:false,normalReady:false,
   pbrReady:false,textureCount:0,rigTargets:0,animationCount:0,
   selfContained:false,validated:false,
  },
  tests:{sourceReviewed:false,animationVerified:false,mobileVisualApproved:false,
   deviceFpsVerified:false},
  quality:'reference-only',published:false,
 }
}
export function validateStudioProductionPackage(p:StudioProductionPackage):void{
 if(p.format!=='SpakTokProductionPackage'||p.version!==1||
  !validName(p.title,120)||!STUDIO_ASSET_TYPES.some(t=>t.value===p.assetType)||
  !STUDIO_MOUNTS.some(t=>t.value===p.mount)||
  !['none','image','glb','obj'].includes(p.sourceFormat)||
  !['original','licensed','unverified'].includes(p.rights)||
  (p.sourceFile!==null&&!validName(p.sourceFile,255))||
  (p.sourceBytes!==null&&(!Number.isSafeInteger(p.sourceBytes)||p.sourceBytes<1||p.sourceBytes>40*1024*1024))||
  (p.sourceFormat==='none')!==(p.sourceFile===null)||
  p.rightsEvidence.length>800||p.targets.length===0||
  new Set(p.targets).size!==p.targets.length||
  p.targets.some(x=>!['camera','local-live-preview','recorded-video'].includes(x))||
  (p.mount==='screen'&&p.anchor!==null)||
  (p.mount!=='screen'&&p.anchor!==null&&!STUDIO_ANCHORS.includes(p.anchor))||
  !['reference-only','technical-preview','rigged-preview','device-verified'].includes(p.quality)||
  p.published!==false)throw Error('studio_production_invalid_manifest')
 const m=p.metrics
 if(![m.textureCount,m.rigTargets,m.animationCount].every(n=>Number.isSafeInteger(n)&&n>=0&&n<=20000)||
  (m.triangleCount!==null&&(!Number.isSafeInteger(m.triangleCount)||m.triangleCount<0||m.triangleCount>5e7))||
  (m.materialCount!==null&&(!Number.isSafeInteger(m.materialCount)||m.materialCount<0||m.materialCount>2000))||
  [m.uvReady,m.normalReady,m.pbrReady,m.selfContained,m.validated].some(x=>typeof x!=='boolean')||
  Object.values(p.tests).some(x=>typeof x!=='boolean'))
  throw Error('studio_production_invalid_metrics')
}
export function reviewStudioProduction(p:StudioProductionPackage):StudioReview{
 validateStudioProductionPackage(p)
 const source=p.sourceFile!==null&&p.sourceBytes!==null
 const rights=p.rights!=='unverified'&&p.tests.sourceReviewed&&
  (p.rights==='original'||p.rightsEvidence.trim().length>=12)
 const geometry=p.sourceFormat==='glb'&&p.metrics.validated&&
  (p.metrics.triangleCount??0)>0
 const material=geometry&&p.metrics.uvReady&&p.metrics.pbrReady&&
  p.metrics.normalReady
 const rigRequired=p.assetType==='full-avatar'||p.assetType==='face-mask'
 const rig=geometry&&(!rigRequired||
  (p.metrics.rigTargets>=3&&p.tests.animationVerified))
 const placement=p.mount==='screen'?p.anchor===null:
  p.anchor!==null&&p.mount!=='body'
 // Body tracking is not certified by the face mesh.
 const mountReady=geometry&&placement
 const device=p.tests.mobileVisualApproved&&p.tests.deviceFpsVerified&&mountReady
 const steps:StudioStageResult[]=[
  {id:'source',status:source?'ready':'needs-work',issues:source?[]:['missing_source_file']},
  {id:'rights',status:rights?'ready':'blocked',issues:rights?[]:['rights_permission_required']},
  {id:'geometry',status:geometry?'ready':'needs-work',
   issues:geometry?[]:['requires_validated_self_contained_glb']},
  {id:'materials',status:material?'ready':'needs-work',
   issues:material?[]:['pbr_uv_normals_not_verified']},
  {id:'rig',status:rig?'ready':'needs-work',
   issues:rig?[]:['rig_or_expressions_not_verified']},
  {id:'placement',status:mountReady?'ready':'needs-work',
   issues:mountReady?[]:['device_attachment_not_verified']},
  {id:'device-qa',status:device?'ready':'needs-work',
   issues:device?[]:['physical_device_quality_not_verified']},
  {id:'release',status:'blocked',issues:['server_review_and_distribution_not_implemented']},
 ]
 const completeness=Math.round(steps.filter(s=>s.status==='ready').length*100/(steps.length-1))
 return {
  steps,completeness,
  mayExportCandidate:source&&rights,
  mayRequestReview:source&&rights&&geometry&&material&&rig&&device,
  mayPublish:false,
  warnings:steps.filter(s=>s.status!=='ready').flatMap(s=>s.issues),
 }
}
export function withStudioProductionSource(
 p:StudioProductionPackage,
 name:string,size:number,format:'image'|'glb'|'obj',
):StudioProductionPackage{
 const clean=name.trim().slice(0,255)
 const next:StudioProductionPackage={
  ...p,sourceFile:clean,sourceBytes:size,sourceFormat:format,
  // Rights/evidence belong to the particular source, not the project title.
  rights:'unverified',rightsEvidence:'',
  metrics:{...createStudioProductionPackage().metrics},
  tests:{...createStudioProductionPackage().tests},
  quality:'reference-only',
 }
 validateStudioProductionPackage(next)
 return next
}
