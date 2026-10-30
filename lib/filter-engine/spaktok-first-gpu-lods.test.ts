import {describe,expect,it} from 'vitest'
import {
 SPAKTOK_FIRST_GPU_LODS,SPAKTOK_FIRST_GPU_LOD_IDS,
 isSpaktokFirstLodId,
} from './spaktok-first-gpu-lods'
describe('Verified owner-private first GPU LOD registry',()=>{
 it('has exactly three distinct, pinned immutable GLBs',()=>{
  expect(SPAKTOK_FIRST_GPU_LOD_IDS).toEqual(['lod0','lod1','lod2'])
  const models=SPAKTOK_FIRST_GPU_LOD_IDS.map(id=>SPAKTOK_FIRST_GPU_LODS[id])
  expect(new Set(models.map(m=>m.objectKey)).size).toBe(3)
  expect(new Set(models.map(m=>m.sha256)).size).toBe(3)
  expect(models.every(m=>/^[a-f0-9]{64}$/.test(m.sha256))).toBe(true)
  expect(models.every(m=>m.objectKey.startsWith('studio/private/pilot-20261030/lods/')))
   .toBe(true)
 })
 it('keeps reference original and strictly decreasing topology/size',()=>{
  const {lod0,lod1,lod2}=SPAKTOK_FIRST_GPU_LODS
  expect(lod0.bytes).toBe(5_343_540)
  expect(lod0.triangles).toBe(117_887)
  expect(lod0.triangles).toBeGreaterThan(lod1.triangles)
  expect(lod1.triangles).toBeGreaterThan(lod2.triangles)
  expect(lod0.meanVertexDriftPercent).toBe(0)
  expect(lod1.meanVertexDriftPercent).toBeCloseTo(.1615365,6)
  expect(lod2.meanVertexDriftPercent).toBeCloseTo(.4062424,6)
  expect(lod1.meanVertexDriftPercent).toBeLessThan(lod2.meanVertexDriftPercent)
  expect(lod1.p95VertexDriftPercent).toBeLessThan(lod2.p95VertexDriftPercent)
  expect(lod0.nonManifoldEdges).toBe(0)
  expect(lod1.nonManifoldEdges).toBe(825)
  expect(lod2.nonManifoldEdges).toBe(400)
  expect(lod0.vertices).toBeGreaterThan(lod1.vertices)
  expect(lod1.vertices).toBeGreaterThan(lod2.vertices)
  expect(lod0.bytes).toBeGreaterThan(lod1.bytes)
  expect(lod1.bytes).toBeGreaterThan(lod2.bytes)
 })
 it('rejects unknown or prototype-injection selections',()=>{
  expect(isSpaktokFirstLodId('lod2')).toBe(true)
  expect(isSpaktokFirstLodId('first')).toBe(false)
  expect(isSpaktokFirstLodId('../private')).toBe(false)
  expect(isSpaktokFirstLodId('__proto__')).toBe(false)
  expect(isSpaktokFirstLodId({lod:'lod0'})).toBe(false)
 })
})
