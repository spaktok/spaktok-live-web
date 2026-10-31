import {describe,it,expect} from 'vitest'
import {SPAKTOK_FIRST_GPU_ASSET} from './spaktok-first-gpu-asset'
import {FIRST_GPU_LIVE_FILTER_ID,verifiedFirstGpuBuffer,normalizeFirstGpuCalibration,DEFAULT_FIRST_GPU_CALIBRATION} from './spaktok-first-gpu-live'
import {faceFxCatalog} from './params'
import {getFaceRealityEffect} from './reality-effect-manifest'
describe('owner private first GPU live pilot',()=>{
 it('safely bounds scale, position and rotation from arbitrary device settings',()=>{
  expect(normalizeFirstGpuCalibration(null)).toEqual(DEFAULT_FIRST_GPU_CALIBRATION)
  expect(normalizeFirstGpuCalibration({scale:999,vertical:-7,depth:.6,rotation:130}))
   .toEqual({scale:1.8,vertical:-.5,depth:.35,rotation:90})
  expect(normalizeFirstGpuCalibration({scale:'2',rotation:NaN}))
   .toEqual(DEFAULT_FIRST_GPU_CALIBRATION)
  expect(normalizeFirstGpuCalibration({scale:.75,vertical:.1,depth:-.1,rotation:-35}))
   .toEqual({scale:.75,vertical:.1,depth:-.1,rotation:-35})
 })
 it('is a selectable 3D preview but has no public GLB URL',()=>{
  expect(faceFxCatalog.some(x=>x.id===FIRST_GPU_LIVE_FILTER_ID&&x.group==='3d')).toBe(true)
  const effect=getFaceRealityEffect(FIRST_GPU_LIVE_FILTER_ID)
  expect(effect?.asset).toBeNull()
  expect(effect?.anchor).toBe('head_top')
  expect(SPAKTOK_FIRST_GPU_ASSET.published).toBe(false)
 })
 it('rejects bytes of wrong size before decoding',async()=>{
  const f=new File([new Uint8Array(100)],'different.glb',{type:'model/gltf-binary'})
  await expect(verifiedFirstGpuBuffer(f)).rejects.toThrow('gpu_wrong_size')
 })
 it('rejects same-size non-GLB before hashing',async()=>{
  const f=new File([new Uint8Array(SPAKTOK_FIRST_GPU_ASSET.bytes)],
    'impostor.glb',{type:'model/gltf-binary'})
  await expect(verifiedFirstGpuBuffer(f)).rejects.toThrow('gpu_invalid_glb')
 })
})
