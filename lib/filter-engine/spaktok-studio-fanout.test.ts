import {describe,it,expect} from 'vitest'
import {createStudioFanoutManifest,assertStudioFanoutManifest}
 from './spaktok-studio-fanout'
import {RODIN_HEAD_CALIBRATED_SHA256} from './rodin-owner-head'
import type {StudioGlbAudit} from './reality-production-glb-audit'
const audit:StudioGlbAudit={
 valid:true,selfContained:true,triangles:117657,
 materials:1,meshCount:1,primitives:1,
 textures:0,hasUV:true,hasNormals:true,hasPBR:true,
 rigTargets:0,animations:0,skins:0,
 requiredExtensions:[],warnings:[],
}
const make=(overrides:Partial<Parameters<typeof createStudioFanoutManifest>[0]>={})=>
 createStudioFanoutManifest({
  fileName:'rodin_spaktok_head_avatar_calibrated.glb',
  sha256:RODIN_HEAD_CALIBRATED_SHA256,bytes:6571920,
  audit,description:'أفاتار ولايف وفلتر وGift وعالم',
  rights:'licensed',targets:['avatar','live','filter','gift','world'],
  createdAt:'2026-10-29T00:20:00.000Z',...overrides,
 })
describe('Studio fan-out manifest GPU-free production contract',()=>{
 it('references one GLB for all five departments without GPU',()=>{
  const result=make()
  expect(result.project.gpuJobsUsed).toBe(0)
  expect(result.source.triangles).toBe(117657)
  expect(result.source.textureImages).toBe(0)
  expect(result.outputs.map(x=>x.target)).toEqual(
   ['avatar','live','filter','gift','world'])
  expect(new Set(result.outputs.map(x=>x.target)).size).toBe(5)
  expect(result.outputs.every(x=>x.state==='private-preview')).toBe(true)
  expect(result.outputs.every(x=>x.published===false)).toBe(true)
  expect(result.review.publicReleaseApproved).toBe(false)
 })
 it('labels a free local relief as 2.5D and never grants 360 readiness',()=>{
  const result=make({fileName:'spaktok-director-local-2-5d.glb',
   sha256:'a'.repeat(64),sourceEngine:'browser-2.5d'})
  expect(result.project.sourceEngine).toBe('browser-2.5d')
  expect(result.project.gpuJobsUsed).toBe(0)
  expect(result.calibration.optionalReferenceHeadHeightMeters).toBe(null)
  for(const output of result.outputs)
   expect(output.blockers).toContain(
    'local_relief_is_not_a_full_360_reconstruction')
 })
 it('preserves calibrated Rodin bust as an unverified preview estimate',()=>{
  const result=make()
  expect(result.calibration.optionalReferenceHeadHeightMeters).toBe(.34)
  expect(result.calibration.verified).toBe(false)
  expect(result.calibration.actualScaleMetersPerUnit).toBe(null)
 })
 it('separates technical preview from animation/collision/live readiness',()=>{
  const result=make()
  expect(result.outputs.find(x=>x.target==='avatar')?.blockers)
   .toContain('face_morph_targets_missing')
  expect(result.outputs.find(x=>x.target==='live')?.blockers)
   .toContain('camera_tracking_and_agora_not_verified')
  expect(result.outputs.find(x=>x.target==='filter')?.blockers)
   .toContain('face_anchor_and_occlusion_not_calibrated')
  expect(result.outputs.find(x=>x.target==='gift')?.blockers)
   .toContain('gift_effect_animation_and_payment_review_required')
  expect(result.outputs.find(x=>x.target==='world')?.blockers)
   .toContain('collision_scale_and_lod_not_verified')
 })
 it('routes a separate Video 3D Studio private preview without claiming video export',()=>{
  const result=make({targets:['video']})
  expect(result.outputs[0].destination).toBe('/video-studio')
  expect(result.outputs[0].state).toBe('private-preview')
  expect(result.outputs[0].blockers)
   .toContain('video_timeline_source_and_keyframes_not_verified')
  expect(result.outputs[0].published).toBe(false)
 })
 it('flags oversized GLB for optimization in every requested department',()=>{
  const result=make({bytes:20*1024*1024,audit:{...audit,triangles:500000}})
  expect(result.outputs.every(x=>x.state==='needs-optimization')).toBe(true)
  expect(result.outputs[0].blockers).toContain('mobile_triangle_limit')
  expect(result.outputs[0].blockers).toContain('over_15mb_delivery_limit')
 })
 it('cannot mix another asset, duplicate targets or unverifiable approvals',()=>{
  expect(()=>make({sha256:'invalid'})).toThrow()
  expect(()=>make({targets:[]})).toThrow()
  const safe=make()
  const malformed={...safe,review:{...safe.review,
   publicReleaseApproved:true}}
  expect(()=>assertStudioFanoutManifest(malformed)).toThrow(
   'studio_fanout_publication_forbidden')
  const unexpected={...safe,outputs:[...safe.outputs,
   safe.outputs[0]]}
  expect(()=>assertStudioFanoutManifest(unexpected)).toThrow()
 })
 it('round-trips a private JSON file with no image bytes or tokens',()=>{
  const result=make({targets:['gift']})
  const encoded=JSON.stringify(result)
  const clone:unknown=JSON.parse(encoded)
  expect(()=>assertStudioFanoutManifest(clone)).not.toThrow()
  expect(encoded).not.toContain('Bearer ')
  expect(encoded).not.toContain('data:image')
  expect((clone as typeof result).source.sha256).toBe(
   RODIN_HEAD_CALIBRATED_SHA256)
 })
})
