import {describe,it,expect} from 'vitest'
import {neutralColor} from './params'
import {
 NEUTRAL_PHOTOGRAPHIC_CORRECTION as neutral,
 targetPhotographicCorrection,smoothPhotographicCorrection,applyPhotographicCorrection,estimatePortraitPhotographicLight,
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
 it('does not amplify deep-night camera noise with maximum digital lift',()=>{
  const night=targetPhotographicCorrection({brightness:.08,warmth:0,side:0})
  const dim=targetPhotographicCorrection({brightness:.30,warmth:0,side:0})
  expect(night.exposure).toBeGreaterThan(0)
  expect(night.exposure).toBeLessThan(.12)
  expect(night.shadows).toBeLessThan(.10)
  expect(dim.exposure).toBeGreaterThan(0)
  expect(night.temperature).toBe(0)
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
 it('prioritizes a dark tracked face over a brighter background without face identity inspection',()=>{
  const width=32,height=18
  const pixels=new Uint8ClampedArray(width*height*4)
  for(let y=0;y<height;y++)for(let x=0;x<width;x++){
   const i=(y*width+x)*4
   const l=x>=2&&x<15&&y>=3&&y<16?40:220
   pixels[i]=l;pixels[i+1]=l;pixels[i+2]=l;pixels[i+3]=255
  }
  const ambient=estimatePortraitPhotographicLight(pixels,width,height,null)
  const portrait=estimatePortraitPhotographicLight(pixels,width,height,{
   center:{x:.25,y:.5},width:.45,
  })
  expect(portrait.brightness).toBeLessThan(ambient.brightness)
  expect(portrait.brightness).toBeGreaterThanOrEqual(.07)
  expect(portrait.warmth).toBe(ambient.warmth)
  expect(estimatePortraitPhotographicLight(pixels,width,height,{
   center:{x:NaN,y:.5},width:.45,
  })).toEqual(ambient)
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
