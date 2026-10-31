import type {StudioGlbAudit} from './reality-production-glb-audit'
/** TikTok Effect House published reference budgets, not certification by TikTok.
 * Importing another creator's filters requires a separately verified license.
 * We enforce strict GLB packages for creator-facing mobile QA before release.
 */
export const LIVE_FILTER_IMPORT_BUDGET=Object.freeze({
 maxPackageBytes:8*1024*1024,
 maxImageBytes:1025*1024,
 maxImageSide:1024,
 preferredStaticTriangles:12000,
 maxTextureCount:4,
 targetFps:30,
})
export type LiveFilterLicense=Readonly<{
 status:'original'|'verified-commercial-license'|'unverified'
 source:string
 evidence:string
}>
export type LiveFilterImportCandidate=Readonly<{
 fileBytes:number
 glb:StudioGlbAudit
 textureFiles:readonly Readonly<{bytes:number;width:number;height:number}>[]
 license:LiveFilterLicense
}>
export type LiveFilterImportDecision=Readonly<{
 status:'blocked'|'device-qa-required'
 reasons:readonly string[]
 /** Technically plausible is not the same as visual, performance or legal QA. */
 tikTokCertified:false
 deviceFpsVerified:false
 published:false
}>
export function reviewLiveFilterImport(c:LiveFilterImportCandidate):LiveFilterImportDecision{
 const reasons:string[]=[]
 const budget=LIVE_FILTER_IMPORT_BUDGET
 const bytes=c.fileBytes
 if(!Number.isSafeInteger(bytes)||bytes<1||bytes>budget.maxPackageBytes)
  reasons.push('package_exceeds_8mb_or_invalid')
 const lic=c.license
 if(lic.status==='unverified'||!lic.source.trim()||
    (lic.status==='verified-commercial-license'&&lic.evidence.trim().length<12))
  reasons.push('commercial_rights_unverified')
 if(!c.glb.valid||!c.glb.selfContained)reasons.push('unverified_glb_structure')
 if(!c.glb.hasUV||!c.glb.hasNormals||!c.glb.hasPBR)
  reasons.push('pbr_normals_or_uv_missing')
 if(!Number.isSafeInteger(c.glb.triangles)||c.glb.triangles<1||
   c.glb.triangles>budget.preferredStaticTriangles)
  reasons.push('mobile_triangle_optimization_required')
 if(c.glb.textures>budget.maxTextureCount||
    c.textureFiles.length>budget.maxTextureCount)
  reasons.push('excessive_texture_count')
 if(c.glb.textures!==c.textureFiles.length)
  reasons.push('texture_metadata_incomplete')
 for(const image of c.textureFiles){
  if(![image.bytes,image.width,image.height].every(Number.isSafeInteger)||
   image.bytes<1||image.bytes>budget.maxImageBytes||
   image.width<1||image.height<1||
   image.width>budget.maxImageSide||image.height>budget.maxImageSide){
   reasons.push('texture_exceeds_size_or_resolution_budget')
   break
  }
 }
 if(c.glb.requiredExtensions.length>0)
  reasons.push('extension_compatibility_device_qa_required')
 return {
  status:reasons.some(x=>x!=='extension_compatibility_device_qa_required')?
    'blocked':'device-qa-required',
  reasons,
  tikTokCertified:false,
  deviceFpsVerified:false,
  published:false,
 }
}
