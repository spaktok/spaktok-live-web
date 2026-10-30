import {describe,expect,it} from 'vitest'
import {centeredPreviewTransform} from './spaktok-glb-preview-transform'
describe('Private GLB turntable normalization',()=>{
 it('centers source geometry before 360 rotation, even with off-center root',()=>{
  const {scale,offset}=centeredPreviewTransform(
   {x:23,y:-7,z:0.2},{x:4,y:2,z:1},
  )
  expect(scale).toBe(.5)
  expect(offset).toEqual({x:-11.5,y:3.5,z:-.1})
  const center={x:23,y:-7,z:0.2}
  expect(scale*center.x+offset.x).toBeCloseTo(0)
  expect(scale*center.y+offset.y).toBeCloseTo(0)
  expect(scale*center.z+offset.z).toBeCloseTo(0)
 })
 it('handles all axes without warping proportions',()=>{
  const v=centeredPreviewTransform(
   {x:0,y:0,z:0},{x:.5,y:2,z:.1},
  )
  expect(v.scale).toBe(1)
  expect(v.offset).toEqual({x:0,y:0,z:0})
 })
 it('rejects bad bounds before allocating WebGL resources',()=>{
  expect(()=>centeredPreviewTransform({x:NaN,y:0,z:0},{x:1,y:1,z:1}))
   .toThrow('studio_preview_nonfinite_extent')
  expect(()=>centeredPreviewTransform({x:0,y:0,z:0},{x:0,y:0,z:0}))
   .toThrow('studio_preview_invalid_bounds')
  expect(()=>centeredPreviewTransform({x:0,y:0,z:0},{x:1001,y:1,z:1}))
   .toThrow('studio_preview_invalid_bounds')
  expect(()=>centeredPreviewTransform({x:0,y:0,z:0},{x:1,y:1,z:1},-1))
   .toThrow('studio_preview_display_extent_invalid')
 })
})
