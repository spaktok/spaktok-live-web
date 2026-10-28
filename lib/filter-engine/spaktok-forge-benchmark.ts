import type {StudioGlbAudit} from './reality-production-glb-audit'
export const FORGE_BENCHMARK_PREVIEW_MAX_BYTES=15*1024*1024
export type ForgeCandidate='rodin'|'forge'
export type ForgeTechnicalSnapshot=Readonly<{
 engine:ForgeCandidate;bytes:number
 triangles:number;materials:number;textures:number
 morphs:number;animations:number
 valid:boolean;selfContained:boolean;pbr:boolean;uv:boolean;normals:boolean
 readyForMobilePreview:boolean;warnings:readonly string[]
}>
export function summarizeForgeCandidate(
 engine:ForgeCandidate,bytes:number,audit:StudioGlbAudit,
):ForgeTechnicalSnapshot{
 if(!Number.isSafeInteger(bytes)||bytes<28||
  bytes>35*1024*1024)throw Error('forge_benchmark_invalid_size')
 const warnings=[...audit.warnings]
 if(!audit.valid||!audit.selfContained)warnings.push('invalid_glb')
 if(bytes>FORGE_BENCHMARK_PREVIEW_MAX_BYTES)
  warnings.push('mobile_preview_file_over_15mb')
 if(audit.triangles>150000)warnings.push('mobile_triangles_over_150k')
 if(audit.textures>12)warnings.push('mobile_textures_over_12')
 if(!audit.hasPBR)warnings.push('pbr_missing')
 if(!audit.hasUV)warnings.push('uv_missing')
 if(!audit.hasNormals)warnings.push('normals_missing')
 return {
  engine,bytes,triangles:audit.triangles,materials:audit.materials,
  textures:audit.textures,morphs:audit.rigTargets,
  animations:audit.animations,
  valid:audit.valid,selfContained:audit.selfContained,
  pbr:audit.hasPBR,uv:audit.hasUV,normals:audit.hasNormals,
  readyForMobilePreview:audit.valid&&audit.selfContained&&
   audit.triangles<=150000&&audit.textures<=12&&
   bytes<=FORGE_BENCHMARK_PREVIEW_MAX_BYTES&&
   audit.hasPBR&&audit.hasUV&&audit.hasNormals,
  warnings:[...new Set(warnings)],
 }
}
export type ForgeManualReview=Readonly<{
 frontAppearance:number|null
 backGeometry:number|null
 textureQuality:number|null
 geometryQuality:number|null
}>
export function validManualForgeReview(r:ForgeManualReview):boolean{
 return Object.values(r).every(x=>
  Number.isInteger(x)&&x!==null&&x>=1&&x<=5)
}
export function compareForgeManualRatings(
 rodin:ForgeManualReview,forge:ForgeManualReview,
):'unrated'|'forge-better'|'rodin-better'|'tie'{
 if(!validManualForgeReview(rodin)||!validManualForgeReview(forge))
  return 'unrated'
 const total=(r:ForgeManualReview)=>
  Object.values(r).reduce<number>((s,v)=>s+(v??0),0)
 return total(forge)>total(rodin)?'forge-better':
  total(forge)<total(rodin)?'rodin-better':'tie'
}
/** A manual rating from one rater is a qualitative note, NEVER a
 * trustworthy claim that one generator is commercially superior.
 */

/** Files alone do NOT prove that the same source image or generation
 * method was used. The author must supply these facts explicitly.
 */
export type ForgeGenerationMethod='full-360-ai'|'local-2.5d-relief'|'unknown'
export type ForgeSourceMatch='same'|'different'|'unknown'
export type ForgeComparisonTrust=Readonly<{
 comparable:boolean
 reasons:readonly string[]
 missingTextureImages:ReadonlyArray<ForgeCandidate>
}>
export function assessForgeComparisonTrust(
 rodin:ForgeTechnicalSnapshot,forge:ForgeTechnicalSnapshot,
 context:Readonly<{
  rodinMethod:ForgeGenerationMethod
  forgeMethod:ForgeGenerationMethod
  sourceMatch:ForgeSourceMatch
 }>,
):ForgeComparisonTrust{
 const reasons:string[]=[]
 if(context.sourceMatch==='different')
  reasons.push('different_source_images')
 else if(context.sourceMatch==='unknown')
  reasons.push('source_image_match_unverified')
 if(context.rodinMethod==='unknown'||context.forgeMethod==='unknown')
  reasons.push('generation_method_unverified')
 if(context.rodinMethod!==context.forgeMethod &&
  context.rodinMethod!=='unknown'&&context.forgeMethod!=='unknown')
  reasons.push('different_generation_methods_2_5d_vs_360')
 if(!rodin.valid||!forge.valid)
  reasons.push('invalid_asset')
 if(!rodin.selfContained||!forge.selfContained)
  reasons.push('assets_not_self_contained')
 const missingTextureImages:ForgeCandidate[]=[]
 if(rodin.textures===0)missingTextureImages.push('rodin')
 if(forge.textures===0)missingTextureImages.push('forge')
 if(missingTextureImages.length)
  reasons.push('some_assets_lack_embedded_texture_images')
 return {
  comparable:reasons.length===0,
  reasons,missingTextureImages,
 }
}
