import {describe,expect,it} from 'vitest'
import type {StudioGlbAudit} from './reality-production-glb-audit'
import {
 summarizeForgeCandidate,compareForgeManualRatings,validManualForgeReview,
} from './spaktok-forge-benchmark'

const audit:StudioGlbAudit={
 valid:true,selfContained:true,triangles:10000,materials:1,meshCount:1,
 primitives:1,textures:1,hasUV:true,hasNormals:true,hasPBR:true,
 rigTargets:0,animations:0,skins:0,requiredExtensions:[],warnings:[],
}
describe('Spaktok Forge: honest technical and human Rodin comparison',()=>{
 it('reports mobile readiness only for validated, textured, contained GLBs',()=>{
  const result=summarizeForgeCandidate('forge',100_000,audit)
  expect(result.readyForMobilePreview).toBe(true)
  expect(result.warnings).toHaveLength(0)
  expect(result.morphs).toBe(0)
 })
 it('does not mistake high triangle counts for better quality',()=>{
  const result=summarizeForgeCandidate('rodin',16*1024*1024,{
   ...audit,triangles:170000,textures:15,hasUV:false,
  })
  expect(result.readyForMobilePreview).toBe(false)
  expect(result.warnings).toContain('mobile_triangles_over_150k')
  expect(result.warnings).toContain('mobile_preview_file_over_15mb')
  expect(result.warnings).toContain('uv_missing')
 })
 it('requires 4 explicit human ratings on BOTH models before comparison',()=>{
  const empty={frontAppearance:null,backGeometry:null,
   textureQuality:null,geometryQuality:null}
  expect(validManualForgeReview(empty)).toBe(false)
  const good={frontAppearance:4,backGeometry:3,
   textureQuality:5,geometryQuality:4}
  expect(validManualForgeReview(good)).toBe(true)
  expect(compareForgeManualRatings(empty,good)).toBe('unrated')
  expect(compareForgeManualRatings(good,good)).toBe('tie')
  expect(compareForgeManualRatings(good,{...good,backGeometry:4}))
   .toBe('forge-better')
  expect(compareForgeManualRatings({...good,backGeometry:5},good))
   .toBe('rodin-better')
 })
})
