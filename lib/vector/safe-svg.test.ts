import {describe,it,expect} from 'vitest'
import {vectorLayout,MAX_VECTOR_BYTES} from './safe-svg'
describe('imported LottieFiles SVG placement',()=>{
 it('keeps original drawing proportions in exported 720x1280 stories',()=>{
  const r=vectorLayout(50,40,40,720,1280,1.5)
  expect(r.width).toBeCloseTo(288)
  expect(r.height).toBeCloseTo(192)
  expect(r.left).toBeCloseTo(216)
  expect(r.top).toBeCloseTo(416)
 })
 it('restricts dimensions and prevents off-screen canvas exploits',()=>{
  const r=vectorLayout(50,50,600,720,1280,.000001)
  expect(r.width).toBeLessThan(720)
  expect(r.height).toBeLessThanOrEqual(1280*.6)
  expect(MAX_VECTOR_BYTES).toBeLessThan(2_000_000)
 })
})
