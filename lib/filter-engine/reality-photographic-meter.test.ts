import {describe,it,expect} from 'vitest'
import {neutralColor} from './params'
import {
 NEUTRAL_PHOTOGRAPHIC_CORRECTION as neutral,
 targetPhotographicCorrection,smoothPhotographicCorrection,applyPhotographicCorrection,
} from './reality-photographic-meter'

describe('Spaktok local photographic camera metering',()=>{
 it('lifts dim scenes conservatively without deforming a face or whitening skin',()=>{
  const correction=targetPhotographicCorrection({brightness:.08,warmth:.25,side:.4})
  expect(correction.exposure).toBeGreaterThan(0)
  expect(correction.exposure).toBeLessThanOrEqual(.2)
  expect(correction.shadows).toBeGreaterThan(0)
  expect(correction.temperature).toBeLessThan(0)
  const result=applyPhotographicCorrection(neutralColor,correction)
  expect(result.saturation).toBe(neutralColor.saturation)
  expect(result.sharpen).toBe(neutralColor.sharpen)
  expect(neutralColor.exposure).toBe(0)
 })
 it('guards highlights in bright scenes and retains original warmth at neutral light',()=>{
  const bright=targetPhotographicCorrection({brightness:.9,warmth:0,side:0})
  expect(bright.exposure).toBeLessThan(0)
  expect(bright.highlights).toBeLessThan(0)
  expect(bright.temperature).toBe(0)
  const normal=targetPhotographicCorrection({brightness:.55,warmth:0,side:0})
  expect(normal.exposure).toBe(0)
  expect(normal.shadows).toBe(0)
 })
 it('does not jump immediately when camera auto-exposure changes',()=>{
  const target=targetPhotographicCorrection({brightness:.08,warmth:-.3,side:0})
  const first=smoothPhotographicCorrection(neutral,target,500)
  expect(first.exposure).toBeGreaterThan(0)
  expect(first.exposure).toBeLessThan(target.exposure)
  const next=smoothPhotographicCorrection(first,target,500)
  expect(next.exposure).toBeGreaterThan(first.exposure)
  expect(smoothPhotographicCorrection(first,target,0)).toEqual(first)
 })
 it('clamps invalid light samples and user adjustments',()=>{
  const sample=targetPhotographicCorrection({brightness:NaN,warmth:Infinity,side:NaN})
  expect(Object.values(sample).every(Number.isFinite)).toBe(true)
  const color=applyPhotographicCorrection({...neutralColor,exposure:.99,temperature:-.99},{
   exposure:.2,temperature:-.13,highlights:-.2,shadows:.17,
  })
  expect(color.exposure).toBe(1)
  expect(color.temperature).toBe(-1)
 })
})
