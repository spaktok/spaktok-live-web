import {describe,expect,it} from 'vitest'
import {filterPresets,createStudioState,needsFaceTracking,needsFaceFxTracking,faceFxCatalog,faceFxCode,needsSegmentation,getPreset} from './params'
describe('SpakTok real-time filter catalog',()=>{
 it('keeps every look uniquely addressable',()=>{
  expect(filterPresets.length).toBeGreaterThanOrEqual(35)
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
  expect(faceFxCatalog.length).toBe(56)
  expect(new Set(faceFxCatalog.map(x=>x.id)).size).toBe(faceFxCatalog.length)
  expect(faceFxCode('cat-ears')).toBe(3)
  expect(faceFxCatalog.filter(x=>x.group==='reactive').length).toBeGreaterThanOrEqual(8)
  expect(needsFaceFxTracking(createStudioState().face)).toBe(false)
  expect(needsFaceFxTracking({id:'cat-ears',strength:0.8})).toBe(true)
  expect(needsFaceFxTracking({id:'puppy',strength:0})).toBe(false)
 })
 it('falls back to an available original look',()=>{
  expect(getPreset('unknown').id).toBe('original')
 })
})
