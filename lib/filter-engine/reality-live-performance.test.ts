import{describe,it,expect}from'vitest'
import{shouldRunExtraLiveMesh,choosePreviewSurfaceHeight}from'./reality-live-performance'
describe('mobile LIVE filter workload budget',()=>{
 it('avoids redundant diagnostic face tessellation for ordinary PBR AR',()=>{
  expect(shouldRunExtraLiveMesh(true,true,false,false)).toBe(false)
  expect(shouldRunExtraLiveMesh(true,true,false,true)).toBe(true)
  expect(shouldRunExtraLiveMesh(true,true,true,false)).toBe(true)
  expect(shouldRunExtraLiveMesh(false,true,true,true)).toBe(false)
  expect(shouldRunExtraLiveMesh(true,false,true,true)).toBe(false)
 })
 it('renders live camera to a smaller on-device surface without touching portrait photo or non-LIVE pipelines',()=>{
  expect(choosePreviewSurfaceHeight(true,true,8,8)).toBe(720)
  expect(choosePreviewSurfaceHeight(true,true,4,2)).toBe(720)
  expect(choosePreviewSurfaceHeight(false,true,8,8)).toBe(1280)
  expect(choosePreviewSurfaceHeight(false,true,4,2)).toBe(960)
  expect(choosePreviewSurfaceHeight(true,false,8,8)).toBe(1280)
 })
})
