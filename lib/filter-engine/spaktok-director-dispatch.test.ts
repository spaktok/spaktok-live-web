import {describe,it,expect} from 'vitest'
import type {StudioGlbAudit} from './reality-production-glb-audit'
import {createStudioFanoutManifest} from './spaktok-studio-fanout'
import {createDirectorDispatch,DIRECTOR_DEPARTMENT_ROUTES} from './spaktok-director-dispatch'

const audit:StudioGlbAudit={
 valid:true,selfContained:true,triangles:28379,materials:1,meshCount:1,
 primitives:1,textures:1,hasUV:true,hasNormals:true,hasPBR:true,
 rigTargets:0,animations:0,skins:0,requiredExtensions:[],warnings:[],
}
const manifest=(overrides:Partial<Parameters<typeof createStudioFanoutManifest>[0]>={})=>
 createStudioFanoutManifest({
  fileName:'spaktok-trellis1-preview-mobile.glb',
  sha256:'21b916f662457d17a18a2a4d1337a3f34f0ec52ad1a96584d83d986621b924ff',
  bytes:2842496,audit,description:'World prop and avatar preview',
  rights:'original',targets:['avatar','live','filter','gift','world'],
  sourceEngine:'ai-360-gpu',gpuJobsUsed:1,
  createdAt:'2026-10-29T19:39:00.000Z',
  ...overrides,
 })
describe('Spaktok AI Director cross-department routing, private only',()=>{
 it('routes one authentic TRELLIS GLB to all existing department previews',()=>{
  const plan=createDirectorDispatch(manifest())
  expect(plan.sourceSha256).toBe(
   '21b916f662457d17a18a2a4d1337a3f34f0ec52ad1a96584d83d986621b924ff')
  expect(plan.steps.map(x=>x.target)).toEqual(['avatar','live','filter','gift','world'])
  expect(plan.steps.map(x=>x.route)).toEqual(
   ['avatar','live','filter','gift','world'].map(t=>
    DIRECTOR_DEPARTMENT_ROUTES[t as keyof typeof DIRECTOR_DEPARTMENT_ROUTES]))
  expect(plan.steps.every(s=>s.published===false)).toBe(true)
  expect(plan.steps.every(s=>s.status==='private-preview-staged')).toBe(true)
  expect(plan.gpuJobsUsed).toBe(1)
  expect(plan.uploadToCloud).toBe(false)
  expect(plan.publication).toBe('private-draft')
 })
 it('does not confuse a decorative World GLB with a rigged Avatar',()=>{
  const plan=createDirectorDispatch(manifest())
  expect(plan.steps.find(s=>s.target==='avatar')?.requiresRig).toBe(true)
  expect(plan.steps.find(s=>s.target==='avatar')?.blockers)
   .toContain('face_morph_targets_missing')
  expect(plan.steps.find(s=>s.target==='gift')?.requiresAnimation).toBe(true)
  expect(plan.steps.find(s=>s.target==='world')?.requiresWorldCollision).toBe(true)
  expect(plan.steps.find(s=>s.target==='live')?.requiresCameraTracking).toBe(true)
 })
 it('does not dispatch an oversized or missing-normals GLB to preview',()=>{
  const plan=createDirectorDispatch(manifest({
   bytes:20*1024*1024,
   audit:{...audit,hasNormals:false},
  }))
  expect(plan.steps.every(s=>s.status==='blocked-geometry')).toBe(true)
  expect(plan.steps.every(s=>s.action==='optimize-glb-first')).toBe(true)
 })
 it('blocks malformed or forged published manifests',()=>{
  const m=manifest()
  expect(()=>createDirectorDispatch({...m,review:{
   ...m.review,publicReleaseApproved:true,
  }})).toThrow()
 })
})
