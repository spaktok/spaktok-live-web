/** Owner's validated 2026-10-30 Vast A100 80GB → TRELLIS.2 test GLB.
 * Matches only the bytes from the observed successful local E2E test.
 * This metadata is NOT a claim that the object exists in Cloudflare R2,
 * and matching it does not replace source rights or mobile/rigging QA.
 */
export const SPAKTOK_FIRST_GPU_ASSET=Object.freeze({
 fileName:'spaktok-first.glb',
 sha256:'33be391ce222f90d00316b26b5ff6c3f21b30f230122d8e87f94b26992f619aa',
 bytes:5343540,
 meshes:1,
 materials:1,
 textures:2,
 source:'microsoft/TRELLIS.2-4B + DINOv3 + ZhengPeng7/BiRefNet',
 qualityProfile:'mobile-preview',
 published:false,
})
export function isFirstGpuAsset(hash:string,bytes:number):boolean{
 return hash.toLowerCase()===SPAKTOK_FIRST_GPU_ASSET.sha256 &&
  bytes===SPAKTOK_FIRST_GPU_ASSET.bytes
}
