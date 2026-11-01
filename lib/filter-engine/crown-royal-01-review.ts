/**
 * Verified first TRELLIS.2 image-derived Royal Crown 01.
 *
 * PRIVATE MASTER: Cloudflare R2 (owner-only; no public GLB URL).
 * One PBR material does not mean the gold and gemstones are independently
 * recolorable. Never advertise as a shipped Live filter before visual QA.
 */
export const ROYAL_CROWN_01_REVIEW=Object.freeze({
 id:'3d-royal-crown-01',
 assetId:'spaktok-studio/filters/crown/royal-crown-01',
 ownerPrivateR2Key:'studio/private/filters/crown/royal-crown-01/master.glb',
 ownerPrivateQaKey:'studio/private/filters/crown/royal-crown-01/qa.json',
 sha256:'3ce1d543317590c95b386e5f5f6747c048421cf9a93bbf7a37f2a8b39806822b',
 bytes:4856516,
 triangles:117788,
 materialCount:1,
 embeddedImages:2,
 uv:true,
 normals:true,
 geometryMobileBudgetPassed:true,
 published:false,
 availableInLive:false,
 materialZoneSeparationApproved:false,
 sourceImageFidelityApproved:false,
 faceTrackingApproved:false,
} as const)

export type RoyalCrown01ReleaseEvidence=Readonly<{
 rightsConfirmed:boolean
 sourceImageFidelityApproved:boolean
 fiveMaterialZonesValidated:boolean
 faceTrackingAndroidTestPassed:boolean
 visualAndFpsMobileQaPassed:boolean
 privateMasterSha256:string
}>

/** Passing a mesh triangle budget alone is NOT a release authorization. */
export function mayReleaseRoyalCrown01(e:RoyalCrown01ReleaseEvidence):boolean{
 return e.rightsConfirmed&&e.sourceImageFidelityApproved&&
  e.fiveMaterialZonesValidated&&e.faceTrackingAndroidTestPassed&&
  e.visualAndFpsMobileQaPassed&&
  e.privateMasterSha256===ROYAL_CROWN_01_REVIEW.sha256
}
