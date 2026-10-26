import {describe,expect,it} from 'vitest'
import {filterPresets,createStudioState,needsFaceTracking,needsSegmentation,getPreset} from './params'
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
 it('falls back to an available original look',()=>{
  expect(getPreset('unknown').id).toBe('original')
 })
})
