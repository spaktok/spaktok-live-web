import {describe,expect,it} from 'vitest'
import type {StudioGlbAudit} from './reality-production-glb-audit'
import {createStudioFanoutManifest} from './spaktok-studio-fanout'
import {buildSpaktokQualityEvidence} from './spaktok-forge-quality-evidence'

const fixture=(bytes=5_343_540,hd=false)=>{
 const audit:StudioGlbAudit={
  valid:true,selfContained:true,triangles:100_000,
  materials:1,meshCount:1,primitives:1,textures:2,
  hasUV:true,hasNormals:true,hasPBR:true,
  rigTargets:0,animations:0,skins:0,
  requiredExtensions:[],warnings:[],
 }
 return createStudioFanoutManifest({
  fileName:'private.glb',sha256:'a'.repeat(64),bytes,audit,
  rights:'original',description:'Spaktok personal draft',
  targets:['avatar','live','gift','world'],
  sourceEngine:hd?'ai-360-gpu':'existing-glb',
  gpuProfile:hd?'studio-hd':undefined,
 })
}
describe('Spaktok objective Rodin-comparison evidence',()=>{
 it('reports real structural metrics but never invents an image-fidelity winner',()=>{
  const value=buildSpaktokQualityEvidence(fixture())
  expect(value.measured.triangleCount).toBe(100_000)
  expect(value.measured.embeddedTextureImageCount).toBe(2)
  expect(value.measured.hasPBRMaterial).toBe(true)
  expect(value.fidelity.referenceImageSimilarityMeasured).toBe(false)
  expect(value.competitorComparison.verifiedWinner).toBeNull()
  expect(value.publicReleaseApproved).toBe(false)
  expect(value.studios).toHaveLength(4)
  expect(value.studios.every(s=>!s.published)).toBe(true)
 })
 it('records HD provenance without calling it a fidelity win',()=>{
  const result=buildSpaktokQualityEvidence(fixture(5_343_540,true))
  expect(result.generationProfile).toBe('studio-hd')
  expect(result.competitorComparison.verifiedWinner).toBeNull()
 })
 it('identifies large models as outside mobile budgets',()=>{
  const report=buildSpaktokQualityEvidence(fixture(17*1024*1024))
  expect(report.mobile.under15MiB).toBe(false)
  expect(report.mobile.testedOnAndroid).toBe(false)
  expect(report.studios.every(s=>s.state==='needs-optimization')).toBe(true)
 })
})
