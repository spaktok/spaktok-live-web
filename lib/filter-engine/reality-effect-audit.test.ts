import {describe,expect,it} from 'vitest'
import {backgroundModes,faceFxCatalog,filterPresets,fxList,neutralBeauty} from './params'
import {REALITY_EFFECTS} from './reality-effect-manifest'
import {
 REALITY_AUDIT_FAMILIES,REALITY_EFFECT_AUDIT,
 auditRealityEffect,realityAuditFamily,summarizeRealityAudit,
} from './reality-effect-audit'

const entry=(id:string)=>{
 const found=REALITY_EFFECT_AUDIT.find(effect=>effect.id===id)
 if(!found)throw Error('missing audit entry: '+id)
 return found
}

describe('Reality Studio: complete filter family audit',()=>{
 it('enumerates every catalog item and all eight editor families',()=>{
  expect(REALITY_EFFECT_AUDIT).toHaveLength(REALITY_EFFECTS.length)
  expect(new Set(REALITY_EFFECT_AUDIT.map(effect=>effect.id)).size).toBe(REALITY_EFFECTS.length)
  for(const effect of faceFxCatalog.filter(x=>x.id!=='none'))expect(entry(effect.id)).toBeTruthy()
  for(const p of filterPresets)expect(entry('grade:'+p.id).family).toBe('color-grade')
  for(const fx of fxList)expect(entry('post:'+fx).family).toBe('post-process')
  for(const mode of backgroundModes)expect(entry('background:'+mode).family).toBe('background')
  for(const key of Object.keys(neutralBeauty))expect(entry('beauty:'+key).family).toBe('beauty')
  expect(new Set(REALITY_EFFECT_AUDIT.map(effect=>effect.family)))
   .toEqual(new Set(REALITY_AUDIT_FAMILIES))
  const summary=summarizeRealityAudit(REALITY_EFFECT_AUDIT)
  expect(summary.total).toBe(REALITY_EFFECTS.length)
  expect(summary.disabled+summary.prototypes+summary.needingDeviceQa).toBe(summary.total)
  expect(summary.families.reduce((sum,group)=>sum+group.count,0)).toBe(summary.total)
 })
 it('distinguishes authored assets from preview geometry and mesh makeup',()=>{
  expect(entry('3d-gold-crown')).toMatchObject({
   family:'accessory-3d',state:'device-qa-required',quality:'authored-glb',
   anchor:'forehead_center',
  })
  expect(entry('3d-gold-crown').checks).toContain('verify-asset-rights')
  expect(entry('3d-lux-glasses')).toMatchObject({
   family:'accessory-3d',state:'prototype',quality:'procedural-preview',
  })
  expect(entry('3d-lux-glasses').checks).toContain('original-3d-asset-needed')
  expect(entry('3d-makeup-glam')).toMatchObject({
   family:'makeup-3d',quality:'tracked-mesh',
  })
  expect(entry('3d-makeup-glam').checks).toContain('face-region-and-skin-tone')
 })
 it('does not re-enable the rejected photo-overlay identity replacement',()=>{
  const legacy=entry('3d-photo-face')
  expect(legacy.state).toBe('disabled')
  expect(legacy.checks).toContain('legacy-photo-overlay-disabled')
  expect(entry('face-morph')).toMatchObject({
   family:'face-morph',state:'device-qa-required',
  })
  expect(entry('face-morph').checks).toContain('face-warp-and-identity')
 })
 it('keeps requirements specific to each effect category',()=>{
  expect(entry('neon-glasses').checks).toContain('face-tracking-and-mirror')
  expect(entry('grade:original').requiredModels).toEqual([])
  expect(entry('grade:clear').checks).toContain('color-and-gamma')
  expect(entry('post:glitch').checks).toContain('post-fx-motion-and-latency')
  expect(entry('background:blur').requiredModels).toContain('segmentation')
  expect(entry('background:blur').checks).toContain('segmentation-boundaries')
  expect(entry('background:none').checks).not.toContain('segmentation-boundaries')
  expect(entry('beauty:slim').requiredModels).toContain('face-mesh')
  expect(entry('beauty:smooth').requiredModels).not.toContain('face-mesh')
  expect(entry('beauty:smooth').checks).toContain('beauty-and-skin-tone')
 })
 it('never marks an effect production-certified based on a passing unit test',()=>{
  for(const effect of REALITY_EFFECT_AUDIT){
   expect(effect.checks).toContain('real-device-performance')
   expect(effect.checks).toContain('recording-parity')
   expect(['disabled','prototype','device-qa-required']).toContain(effect.state)
  }
 })
 it('handles malformed manifests as disabled, not silently green',()=>{
  const original=REALITY_EFFECTS.find(effect=>effect.id==='3d-crystal')!
  expect(realityAuditFamily(original)).toBe('accessory-3d')
  const unsafe=auditRealityEffect({
   ...original,asset:{...original.asset!,uri:'https://unsafe.example/effect.glb'},
  })
  expect(unsafe.state).toBe('disabled')
  expect(unsafe.checks).toContain('manifest-invalid')
 })
})
