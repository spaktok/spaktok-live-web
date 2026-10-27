import {describe,expect,it} from 'vitest'
import {createStudioState,filterPresets,faceFxCatalog} from './params'
import {
 DEFAULT_REALITY_UNIFIED_CONFIG,REALITY_SHARED_EFFECT_OPTIONS,
 REALITY_SHARED_FACE_OPTIONS,REALITY_SHARED_GRADE_OPTIONS,
 realityEffectCompatibility,planRealityMeshBudget,
 resolveUnifiedRealityLook,makeUnifiedRealitySession,
} from './reality-unified-profile'
import {REALITY_EFFECTS} from './reality-effect-manifest'

describe('Shared Reality camera/video/live compatibility',()=>{
 it('uses ALL registered effect contracts without pretending runtime parity',()=>{
  expect(REALITY_SHARED_EFFECT_OPTIONS.length)
   .toBe(REALITY_EFFECTS.length-1)
  expect(REALITY_SHARED_FACE_OPTIONS.length)
   .toBe(faceFxCatalog.length-2)
  expect(REALITY_SHARED_GRADE_OPTIONS.length).toBe(filterPresets.length)
  for(const mode of ['camera','recorded-video','live-preview'] as const){
   for(const option of REALITY_SHARED_EFFECT_OPTIONS){
    const entry=realityEffectCompatibility(option.id,mode)
    expect(entry.catalogued).toBe(true)
    expect(entry.support).toBe('shared-definition-only')
   }
   expect(realityEffectCompatibility('not-an-effect',mode).support)
    .toBe('unsupported')
  }
 })
 it('defaults to identity preserving original in all three modes',()=>{
  for(const mode of ['camera','recorded-video','live-preview'] as const){
   const current=createStudioState()
   const output=makeUnifiedRealitySession({
    mode,device:'mid',trackingValid:true,
    config:DEFAULT_REALITY_UNIFIED_CONFIG,studio:current,
   })
   expect(output.studio).toEqual(current)
   expect(output.studio.face.id).toBe('none')
   expect(output.studio.beauty.slim).toBe(0)
   expect(output.studio.beauty.whiten).toBe(0)
   expect(output.mesh.targetTriangles).toBeLessThanOrEqual(24000)
   expect(output.warnings).toContain('face_geometry_unchanged')
  }
 })
 it('allows bounded camera lighting without changing anatomy',()=>{
  const current=createStudioState()
  const output=resolveUnifiedRealityLook({
   ...DEFAULT_REALITY_UNIFIED_CONFIG,look:'natural-light',
  },current)
  expect(output.color.exposure).toBeGreaterThan(current.color.exposure)
  expect(output.color.shadows).toBeGreaterThan(current.color.shadows)
  expect(output.beauty).toEqual(current.beauty)
  expect(output.face).toEqual(current.face)
  expect(current.color).toEqual(createStudioState().color)
 })
 it('requires explicit opt-in to change face features, and bounds strength',()=>{
  const no=resolveUnifiedRealityLook({
   ...DEFAULT_REALITY_UNIFIED_CONFIG,faceMorphStrength:1,skinSmoothing:1,
  })
  expect(no.face.id).toBe('none')
  expect(no.beauty.smooth).toBe(0)
  const yes=resolveUnifiedRealityLook({
   ...DEFAULT_REALITY_UNIFIED_CONFIG,faceShapeOptIn:true,
   faceMorphStrength:1,skinSmoothing:1,
  })
  expect(yes.beauty.smooth).toBeLessThanOrEqual(.35)
  expect(yes.face.strength).toBeLessThanOrEqual(.45)
  expect(yes.face.id).toBe('face-morph')
 })
 it('only permits theoretical ultra desktop LOD after opt-in and smooth measured tracking',()=>{
  const ultra=planRealityMeshBudget({
   mode:'live-preview',device:'desktop',quality:'high-quality-preview',
   trackingValid:true,fps:60,optInUltra:true,
  })
  expect(ultra.targetTriangles).toBeGreaterThan(900_000)
  expect(ultra.targetTriangles).toBeLessThanOrEqual(1_048_576)
  expect(ultra.extraDenseEnabled).toBe(true)
  const slow=planRealityMeshBudget({
   mode:'live-preview',device:'desktop',quality:'high-quality-preview',
   trackingValid:true,fps:14,optInUltra:true,
  })
  expect(slow.targetTriangles).toBeLessThan(ultra.targetTriangles)
  const mid=planRealityMeshBudget({
   mode:'live-preview',device:'mid',quality:'high-quality-preview',
   trackingValid:true,fps:60,optInUltra:true,
  })
  expect(mid.targetTriangles).toBeLessThan(ultra.targetTriangles)
 })
 it('fails closed on tracking loss and invalid topology',()=>{
  expect(planRealityMeshBudget({
   mode:'live-preview',device:'desktop',quality:'high-quality-preview',
   trackingValid:false,fps:60,optInUltra:true,
  }).targetTriangles).toBe(912)
  expect(()=>planRealityMeshBudget({
   mode:'camera',device:'low',trackingValid:true,quality:'adaptive',
   baseTriangles:Infinity,
  })).toThrow('reality_invalid_base_mesh_triangles')
 })
})
