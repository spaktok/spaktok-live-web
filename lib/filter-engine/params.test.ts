import {describe,expect,it} from 'vitest'
import {filterPresets,createStudioState,needsFaceTracking,needsFaceFxTracking,faceFxCatalog,faceFxCode,needsSegmentation,getPreset} from './params'
describe('SpakTok real-time filter catalog',()=>{
 it('keeps every look uniquely addressable',()=>{
  expect(filterPresets.length).toBeGreaterThanOrEqual(55)
  expect(new Set(filterPresets.map(p=>p.id)).size).toBe(filterPresets.length)
 })
 it('does not need expensive face ML for GPU-only color and skin smoothing',()=>{
  expect(needsFaceTracking(createStudioState().beauty)).toBe(false)
  expect(needsFaceTracking({...createStudioState().beauty,eyes:0.2})).toBe(true)
 })
 it('does not load segmentation when background mode is disabled',()=>{
  expect(needsSegmentation(createStudioState().effects)).toBe(false)
 })
 it('has distinct tracked face effects but no face inference when disabled',()=>{
  expect(faceFxCatalog.length).toBe(80)
  expect(new Set(faceFxCatalog.map(x=>x.id)).size).toBe(faceFxCatalog.length)
  expect(faceFxCode('cat-ears')).toBe(3)
  expect(faceFxCatalog.filter(x=>x.group==='reactive').length).toBeGreaterThanOrEqual(8)
  expect(needsFaceFxTracking(createStudioState().face)).toBe(false)
  expect(needsFaceFxTracking({id:'cat-ears',strength:0.8})).toBe(true)
  expect(needsFaceFxTracking({id:'puppy',strength:0})).toBe(false)
 })
 it('has twenty original photographic looks with valid bounded GPU parameters',()=>{
  const own=filterPresets.filter(p=>p.id.startsWith('spk-'))
  expect(own).toHaveLength(20)
  expect(new Set(own.map(p=>p.id)).size).toBe(20)
  for(const preset of own){
    expect(preset.swatch).toMatch(/^#[0-9a-f]{6}$/i)
    for(const val of Object.values(preset.color))
      for(const channel of Array.isArray(val)?val:[val]){
        expect(Number.isFinite(channel)).toBe(true)
        expect(Math.abs(channel)).toBeLessThanOrEqual(1)
      }
  }
 })
 it('has eight new distinct original tracked PBR face finishes',async()=>{
  const {SPAKTOK_ORIGINAL_FACE_FINISHES}=await import('./spaktok-original-face-filters')
  const newFinishes=SPAKTOK_ORIGINAL_FACE_FINISHES.filter(x=>
    ['moonstone','black-diamond','azure-chrome','lavender-pearl','sunset-copper','jade','rose-quartz','arctic-glass']
      .some(tag=>x.id.endsWith(tag)))
  expect(newFinishes).toHaveLength(8)
  expect(new Set(newFinishes.map(x=>x.id)).size).toBe(8)
  expect(newFinishes.every(x=>x.opacity>0&&x.opacity<=1)).toBe(true)
 })
 it('falls back to an available original look',()=>{
  expect(getPreset('unknown').id).toBe('original')
 })
})
