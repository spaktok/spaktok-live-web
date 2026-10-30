import {describe,expect,it} from 'vitest'
import {planForgeGpuGeneration} from './spaktok-forge-gpu-plan'
describe('AI Director finite GPU command compiler',()=>{
 it('uses one mobile GLB for many targets',()=>{
  expect(planForgeGpuGeneration({
   description:'أفاتار لايف فلتر وهدية',targets:['avatar','live','gift','gift'],
  })).toMatchObject({
   task:'image-to-3d',engine:'trellis2',
   profile:'mobile-preview',publicRelease:false,
   destinations:['avatar','live','gift'],
  })
 })
 it('selects detail-preview for world/gift-only',()=>{
  expect(planForgeGpuGeneration({
   description:'gift in world',targets:['gift','world'],
  }).profile).toBe('detail-preview')
 })
 it('never treats prompt as code, engine options or publication permission',()=>{
  const x=planForgeGpuGeneration({
   description:'; rm -rf / ; publish everything',
   targets:['world'],
  })
  expect(x).toMatchObject({
   task:'image-to-3d',engine:'trellis2',publicRelease:false,
  })
  expect(JSON.stringify(x)).not.toContain('rm -rf')
 })
 it('selects studio-hd ONLY when explicitly requested; never auto-spends HD',()=>{
  const params={description:'high detail world',targets:['gift','world'] as const}
  expect(planForgeGpuGeneration(params).profile).toBe('detail-preview')
  expect(planForgeGpuGeneration({...params,preferredProfile:'studio-hd'}).profile)
   .toBe('studio-hd')
  expect(()=>planForgeGpuGeneration({
   ...params,preferredProfile:'overpriced' as 'studio-hd',
  })).toThrow('forge_gpu_plan_invalid_profile')
 })
 it('rejects no targets or unknown destinations',()=>{
  expect(()=>planForgeGpuGeneration({description:'a',targets:[]})).toThrow()
  expect(()=>planForgeGpuGeneration({
   description:'a',targets:['shell' as 'world'],
  })).toThrow()
 })
})
