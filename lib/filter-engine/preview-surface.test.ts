import {describe,expect,it} from 'vitest'
import {cameraSurfaceDimensions} from './preview-surface'
describe('camera/AR surface pixel alignment',()=>{
 it('matches full mobile browser viewport instead of blindly using 9:16',()=>{
  const size=cameraSurfaceDimensions(709,1278,960)!
  expect(size.height).toBe(960)
  expect(size.width/size.height).toBeCloseTo(709/1278,2)
 })
 it('reprojects accurately when the mobile toolbar changes viewport height',()=>{
  const before=cameraSurfaceDimensions(709,1278,960)!
  const after=cameraSurfaceDimensions(709,1160,960)!
  expect(after.width).toBeGreaterThan(before.width)
  expect(after.height).toBe(before.height)
 })
 it('ignores hidden/invalid previews',()=>{
  expect(cameraSurfaceDimensions(0,0,960)).toBeNull()
  expect(cameraSurfaceDimensions(Infinity,1200,960)).toBeNull()
 })
})
