/** Canonical metric authoring contract. References are neutral ADULT
 * population approximations, never person-identifying or calibrated body measurements.
 * The FaceLandmarker projection remains camera-estimated and scale-ambiguous.
 */
export const REALITY_METRIC_PROFILE_VERSION=1 as const
export type RealityCanonicalProfile=Readonly<{
 version:1
 unit:'meter'
 referenceInterpupillaryDistanceM:number
 referenceFaceWidthM:number
 orientation:'x-right-y-up-z-forward'
 assetUpAxis:'y'
 expectedUV:'gltf'
 confidence:'nominal-not-measured'
}>
export const DEFAULT_CANONICAL_HEAD:RealityCanonicalProfile=Object.freeze({
 version:REALITY_METRIC_PROFILE_VERSION,unit:'meter',
 referenceInterpupillaryDistanceM:.063,
 referenceFaceWidthM:.145,
 orientation:'x-right-y-up-z-forward',
 assetUpAxis:'y',expectedUV:'gltf',
 confidence:'nominal-not-measured',
})
export type TrackedPoint2D=Readonly<{x:number;y:number}>
export type MetricCalibration=Readonly<{
 pixelsPerMeter:number
 referenceScaleM:number
 measuredEyeDistancePx:number
 confidence:'estimated'
}>
/** A MONOCULAR screen estimate, not physical biometric face measurement.
 * Once a calibrated AR camera arrives, replace with real camera intrinsics.
 */
export function estimateMetricFaceScale(
 left:TrackedPoint2D,right:TrackedPoint2D,
 video:{width:number;height:number},viewport:{width:number;height:number},
 profile:RealityCanonicalProfile=DEFAULT_CANONICAL_HEAD,
):MetricCalibration|null{
 if(![left.x,left.y,right.x,right.y,video.width,video.height,
   viewport.width,viewport.height,profile.referenceInterpupillaryDistanceM]
   .every(Number.isFinite)||
    video.width<=0||video.height<=0||viewport.width<=0||viewport.height<=0||
    profile.referenceInterpupillaryDistanceM<=0)return null
 const cover=Math.max(viewport.width/video.width,viewport.height/video.height)
 const dx=(right.x-left.x)*video.width*cover
 const dy=(right.y-left.y)*video.height*cover
 const eyesPx=Math.hypot(dx,dy)
 if(eyesPx<8||eyesPx>Math.max(viewport.width,viewport.height)*1.5)return null
 return {
  pixelsPerMeter:eyesPx/profile.referenceInterpupillaryDistanceM,
  referenceScaleM:profile.referenceFaceWidthM,
  measuredEyeDistancePx:eyesPx,
  confidence:'estimated',
 }
}
export type RealityAuthoringAsset=Readonly<{
 id:string
 uri:string
 category:'glasses'|'hair'|'hat'|'mask'|'jewelry'|'other'
 units:'meter'
 pivotM:readonly [number,number,number]
 grippingPointsM:readonly (readonly [number,number,number])[]
 supportsArticulatedRig:boolean
 materials:Readonly<{pbrMetallicRoughness:boolean;normalMap:boolean;occlusionMap:boolean}>
}>
export function validateAuthoringAsset(asset:RealityAuthoringAsset){
 if(!/^[a-z0-9][a-z0-9-]{1,79}$/.test(asset.id)||
    !/^\/face-assets\/[a-z0-9][a-z0-9-]*\.glb(?:\?v=[a-zA-Z0-9-]+)?$/.test(asset.uri))
   throw Error('reality_untrusted_authoring_asset')
 const pts=[asset.pivotM,...asset.grippingPointsM]
 if(!pts.length||pts.some(p=>p.length!==3||p.some(n=>!Number.isFinite(n)||Math.abs(n)>10)))
   throw Error('reality_invalid_metric_pivot')
 return asset
}
