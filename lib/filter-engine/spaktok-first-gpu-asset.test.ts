import {describe,it,expect} from 'vitest'
import {SPAKTOK_FIRST_GPU_ASSET,isFirstGpuAsset} from './spaktok-first-gpu-asset'
describe('first private Vast GPU GLB provenance',()=>{
 it('recognizes exactly the tested GLB bytes by size and digest',()=>{
  expect(isFirstGpuAsset(SPAKTOK_FIRST_GPU_ASSET.sha256,5343540)).toBe(true)
  expect(isFirstGpuAsset(SPAKTOK_FIRST_GPU_ASSET.sha256,5343541)).toBe(false)
  expect(isFirstGpuAsset('0'.repeat(64),5343540)).toBe(false)
 })
 it('never treats the reference GLB as publicly published',()=>{
  expect(SPAKTOK_FIRST_GPU_ASSET.published).toBe(false)
  expect(SPAKTOK_FIRST_GPU_ASSET.sha256).toMatch(/^[0-9a-f]{64}$/)
 })
})
