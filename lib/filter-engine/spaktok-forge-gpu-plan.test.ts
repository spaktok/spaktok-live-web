import {describe,expect,it} from 'vitest'
import {planForgeGpuGeneration} from './spaktok-forge-gpu-plan'
describe('AI Director finite GPU command compiler',()=>{
 it('uses one mobile GLB for many targets',()=>{
  expect(planForgeGpuGeneration({
   description:'أفاتار لايف فلتر وهدية',targets:['avatar','live','gift','gift'],
  })).toMatchObject({
   task:'image-to-3d',engine:'trellis2',pipelineType:'512',
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
 it('rejects no targets or unknown destinations',()=>{
  expect(()=>planForgeGpuGeneration({description:'a',targets:[]})).toThrow()
  expect(()=>planForgeGpuGeneration({
   description:'a',targets:['shell' as 'world'],
  })).toThrow()
 })
})
