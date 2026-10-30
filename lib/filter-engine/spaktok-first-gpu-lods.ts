/** Verified PRIVATE Cloudflare R2 GLB LOD variants from the owner's A100 output.
 * Generated and independently read back from R2 on 2026-10-30.
 * LOD1/LOD2 use prototype spatial-UV clustering, NOT gltfpack/QEM.
 * No asset here is public, visual-QA approved, rigged or native-ready.
 */
export const SPAKTOK_FIRST_GPU_LODS=Object.freeze({
 lod0:Object.freeze({
  id:'lod0',fileName:'spaktok-first-lod0.glb',
  sha256:'33be391ce222f90d00316b26b5ff6c3f21b30f230122d8e87f94b26992f619aa',
  bytes:5343540,triangles:117887,vertices:105337,nonManifoldEdges:0,
  meanVertexDriftPercent:0,p95VertexDriftPercent:0,
  uvCollapsedTriangles:6,surfaceAreaChangePercent:0,uvAreaSumChangePercent:0,
  objectKey:'studio/private/pilot-20261030/lods/lod0.glb',
  description:'الأصل 5.34MB — تفاصيل كاملة',
 }),
 lod1:Object.freeze({
  id:'lod1',fileName:'spaktok-first-lod1.glb',
  sha256:'3c0cb4c850450dd60195639199ec96f1260303cf7f4cf9272ff879e5d9b2ed8b',
  bytes:2825124,triangles:54132,vertices:50544,nonManifoldEdges:825,
  meanVertexDriftPercent:0.1615365,p95VertexDriftPercent:0.4659947,
  uvCollapsedTriangles:0,surfaceAreaChangePercent:-13.4723,uvAreaSumChangePercent:47.5168,
  objectKey:'studio/private/pilot-20261030/lods/lod1.glb',
  description:'متوسط 2.83MB — معاينة الأفـاتار والهدايا',
 }),
 lod2:Object.freeze({
  id:'lod2',fileName:'spaktok-first-lod2.glb',
  sha256:'bfadca41f907c577be9de6590f07cf95ff6f2e17c56ce518fd008e0cbd8c8742',
  bytes:1448404,triangles:18651,vertices:20826,nonManifoldEdges:400,
  meanVertexDriftPercent:0.4062424,p95VertexDriftPercent:0.8769104,
  uvCollapsedTriangles:0,surfaceAreaChangePercent:-30.9121,uvAreaSumChangePercent:45.0923,
  objectKey:'studio/private/pilot-20261030/lods/lod2.glb',
  description:'خفيف 1.45MB — معاينة اللايف والفلاتر',
 }),
} as const)
export type SpaktokFirstLodId=keyof typeof SPAKTOK_FIRST_GPU_LODS
export const SPAKTOK_FIRST_GPU_LOD_IDS=Object.freeze(
 ['lod0','lod1','lod2'] as const
)
export function isSpaktokFirstLodId(v:unknown):v is SpaktokFirstLodId{
 return typeof v==='string' &&
  Object.prototype.hasOwnProperty.call(SPAKTOK_FIRST_GPU_LODS,v)
}
