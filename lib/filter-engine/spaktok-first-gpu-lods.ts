/** Owner-private Cloudflare R2 LOD variants, SHA-256 verified.
 * lod1/lod2 are defective preview clustering prototypes.
 * lod1c/lod2c use gltfpack 1.3 conservative CPU simplification, with zero
 * detected non-manifold INDEX edges but unachieved target LOD budgets.
 * None is automatically approved for Live, AR, gifts or public publishing.
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
 // Professionally simplified on CPU with gltfpack 1.3; R2 read-back and
 // SHA-256 matched on 2026-10-30. Neither achieved its 50%/20% goal.
 // These are PRIVATE QA candidates, not Live/AR-ready production assets.
 lod1c:Object.freeze({
  id:'lod1c',fileName:'spaktok-lod1-conservative.glb',
  sha256:'765011185736c0d2f53e9252b51346b10f4107d3128934ccbbbee7b1f9cd3bbd',
  bytes:5087128,triangles:109406,vertices:100512,nonManifoldEdges:0,
  meanVertexDriftPercent:null,p95VertexDriftPercent:null,
  uvCollapsedTriangles:3,surfaceAreaChangePercent:-0.00857227,uvAreaSumChangePercent:null,
  objectKey:'studio/private/pilot-20261030/professional-candidates-v1/lod1-conservative.glb',
  description:'LOD1 احترافي محافظ 5.09MB — فحص خاص، الهدف لم يتحقق',
 }),
 lod2c:Object.freeze({
  id:'lod2c',fileName:'spaktok-lod2-conservative.glb',
  sha256:'6b434a87299c2ad653efe10969cffb11b14c9608fb5574eb40b0228d2444ca23',
  bytes:4992732,triangles:106428,vertices:98679,nonManifoldEdges:0,
  meanVertexDriftPercent:null,p95VertexDriftPercent:null,
  uvCollapsedTriangles:2,surfaceAreaChangePercent:-0.00711598,uvAreaSumChangePercent:null,
  objectKey:'studio/private/pilot-20261030/professional-candidates-v1/lod2-conservative.glb',
  description:'LOD2 احترافي محافظ 4.99MB — فحص خاص، الهدف لم يتحقق',
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
 ['lod0','lod1c','lod2c','lod1','lod2'] as const
)
export function isSpaktokFirstLodId(v:unknown):v is SpaktokFirstLodId{
 return typeof v==='string' &&
  Object.prototype.hasOwnProperty.call(SPAKTOK_FIRST_GPU_LODS,v)
}
