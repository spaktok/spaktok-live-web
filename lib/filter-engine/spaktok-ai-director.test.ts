import {describe,it,expect} from 'vitest'
import {detectDirectorTargets,planSpaktokDirector,evaluateDirectorAsset} from './spaktok-ai-director'
import type {StudioGlbAudit} from './reality-production-glb-audit'
const audit:StudioGlbAudit={
 valid:true,selfContained:true,triangles:75000,materials:2,meshCount:1,
 primitives:1,textures:2,hasUV:true,hasNormals:true,hasPBR:true,
 rigTargets:0,animations:0,skins:0,requiredExtensions:[],warnings:[],
}
describe('Spaktok AI Director private production router',()=>{
 it('understands Arabic and English requested output categories',()=>{
  expect(detectDirectorTargets('حوّل الصورة إلى افتار للايف مع فلتر و gift في العالم'))
   .toEqual(['avatar','live','filter','gift','world'])
  expect(detectDirectorTargets('live and avatar')).toEqual(['avatar','live'])
 })
 it('blocks generation if private user image has no rights confirmation',()=>{
  const plan=planSpaktokDirector({
   description:'أفاتار',targets:['avatar'],source:'image',
   rightsApproved:false,gpuAvailable:true,
  })
  expect(plan.estimatedGpuJobs).toBe(0)
  expect(plan.stages.find(s=>s.id==='generation')?.status).toBe('blocked')
  expect(plan.stages.find(s=>s.id==='publish')?.status).toBe('blocked')
 })
 it('fails closed without configured GPU and never promises image-to-360 locally',()=>{
  const plan=planSpaktokDirector({
   description:'فلتر وجفت',targets:[],source:'image',
   rightsApproved:true,gpuAvailable:false,
  })
  expect(plan.targets).toEqual(['filter','gift'])
  expect(plan.estimatedGpuJobs).toBe(0)
  expect(plan.uploadsSourceImage).toBe(false)
  expect(plan.stages.find(s=>s.id==='generation')?.reason)
   .toBe('licensed_gpu_not_configured')
 })
 it('runs one paid generation maximum regardless of destinations and only after approval',()=>{
  const plan=planSpaktokDirector({
   description:'avatar live gift',targets:['avatar','live','gift'],
   source:'image',rightsApproved:true,gpuAvailable:true,
  })
  expect(plan.estimatedGpuJobs).toBe(1)
  expect(plan.uploadsSourceImage).toBe(true)
  expect(plan.publication).toBe('private-draft')
  expect(plan.stages.find(s=>s.id==='gift-animation')?.status).toBe('requires-work')
 })
 it('accepts valid GLB as input with ZERO GPU cost but never claims a rig',()=>{
  const plan=planSpaktokDirector({
   description:'',targets:['avatar','world'],source:'glb',
   rightsApproved:true,gpuAvailable:false,
  })
  expect(plan.estimatedGpuJobs).toBe(0)
  expect(plan.stages.find(s=>s.id==='generation')?.status).toBe('ready')
  expect(plan.stages.find(s=>s.id==='rig')?.status).toBe('requires-work')
 })
 it('marks geometry valid separately from native FPS, animation and publishing',()=>{
  const qa=evaluateDirectorAsset(audit,2*1024*1024,
   ['avatar','live','filter','gift','world'])
  expect(qa.valid).toBe(true)
  expect(qa.previewReady).toBe(true)
  expect(qa.canPublish).toBe(false)
  expect(qa.rigReady).toBe(false)
  expect(qa.issues).toContain('face_morph_targets_missing')
  expect(qa.issues).toContain('gift_animation_missing')
  expect(qa.issues).toContain('world_collision_and_scale_unverified')
 })
 it('blocks low-quality or oversized GLB before handoff',()=>{
  const qa=evaluateDirectorAsset({...audit,triangles:300000,
   hasNormals:false,textures:0},18*1024*1024,['filter'])
  expect(qa.requiresOptimization).toBe(true)
  expect(qa.previewReady).toBe(false)
  expect(qa.issues).toContain('mobile_triangle_budget_review')
  expect(qa.issues).toContain('missing_normals')
 })
})
