import {describe,expect,it,vi} from 'vitest'
import {getRealityEffect} from './reality-effect-manifest'
import {RealityEffectRuntime} from './reality-effect-runtime'

const crown=()=>{
 const effect=getRealityEffect('3d-gold-crown')
 if(!effect)throw Error('crown_manifest_missing')
 return effect
}

describe('authored photographic GLB must never degrade to primitive geometry',()=>{
 it('rejects missing original crown asset rather than presenting a geometric clone',async()=>{
  const preview=vi.fn(()=>({placeholder:true}))
  const runtime=new RealityEffectRuntime({
   loadAuthoredGLB:async()=>{throw Error('asset_unavailable')},
   createProceduralPreview:preview,
   calibrateAuthored:()=>{},
  })
  await expect(runtime.instantiate(crown())).rejects
   .toThrow('reality_authored_asset_unavailable:3d-gold-crown')
  expect(preview).not.toHaveBeenCalled()
 })
 it('uses authored geometry only after successful load and calibration',async()=>{
  const node={original:true}
  const preview=vi.fn(()=>({placeholder:true}))
  const calibrated=vi.fn()
  const runtime=new RealityEffectRuntime({
   loadAuthoredGLB:async()=>node,
   createProceduralPreview:preview,
   calibrateAuthored:calibrated,
  })
  const result=await runtime.instantiate(crown())
  expect(result.node).toBe(node)
  expect(result.quality).toBe('hd')
  expect(result.source).toBe('authored-glb')
  expect(calibrated).toHaveBeenCalledOnce()
  expect(preview).not.toHaveBeenCalled()
 })
 it('keeps legacy procedural geometry internal but out of public photographic menus',async()=>{
  const effect=getRealityEffect('3d-lux-glasses')
  if(!effect)throw Error('legacy_manifest_missing')
  const runtime=new RealityEffectRuntime({
   loadAuthoredGLB:async()=>{throw Error('should_not_load')},
   createProceduralPreview:()=>({legacy:true}),
   calibrateAuthored:()=>{},
  })
  const result=await runtime.instantiate(effect)
  expect(result.source).toBe('procedural-preview')
  expect(result.quality).toBe('fallback')
 })
})
