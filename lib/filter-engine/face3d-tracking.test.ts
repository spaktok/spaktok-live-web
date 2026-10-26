import {describe,expect,it} from 'vitest'
import {stabilizeFaceMesh,hasFreshFace} from './face3d-tracking'
const make=(x:number,y:number)=>Array.from({length:478},()=>({x,y,z:-.02}))
describe('Face3D camera-coordinate tracking',()=>{
 it('keeps all 478 landmarks in the same normalized frame',()=>{
  const previous=make(.48,.45),next=make(.49,.46)
  const result=stabilizeFaceMesh(previous,next,45,9/16)
  expect(result).toHaveLength(478)
  expect(result[33].y).toBeGreaterThan(.45)
  expect(result[33].y).toBeLessThanOrEqual(.46)
 })
 it('tracks large head translation without dragging the mesh behind',()=>{
  const previous=make(.5,.25),next=make(.52,.82)
  const result=stabilizeFaceMesh(previous,next,45,9/16)
  expect(result[33].y).toBeCloseTo(.82)
  expect(result[263].y).toBeCloseTo(.82)
 })
 it('resets after interruption, never freezing a ghost near the ceiling',()=>{
  const previous=make(.5,.2),next=make(.5,.79)
  expect(stabilizeFaceMesh(previous,next,400,9/16)[1].y).toBe(.79)
  expect(hasFreshFace(1000,1400)).toBe(false)
  expect(hasFreshFace(1000,1300)).toBe(true)
  expect(hasFreshFace(0,100)).toBe(false)
 })
})
