import {describe,expect,it} from 'vitest'
import {needsRealityGpuBlend,realityGpuBlendFragmentShader} from './reality-gpu-blend'

describe('GPU-native AR strength blending',()=>{
 it('does not do extra passes for absent/full AR',()=>{
  expect(needsRealityGpuBlend(0)).toBe(false)
  expect(needsRealityGpuBlend(1)).toBe(false)
  expect(needsRealityGpuBlend(.5)).toBe(true)
  expect(needsRealityGpuBlend(-.5)).toBe(false)
  expect(needsRealityGpuBlend(Number.NaN)).toBe(false)
 })
 it('mixes the camera-only and physically shaded frame, not canvas opacity',()=>{
  expect(realityGpuBlendFragmentShader).toContain('mix(base,reality,clamp(uIntensity,0.0,1.0))')
  expect(realityGpuBlendFragmentShader).toContain('#include <colorspace_fragment>')
  const blend=(base:number,full:number,strength:number)=>base+(full-base)*strength
  expect(blend(.2,.8,0)).toBeCloseTo(.2)
  expect(blend(.2,.8,1)).toBeCloseTo(.8)
  expect(blend(.2,.8,.5)).toBeCloseTo(.5)
 })
})
