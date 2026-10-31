import {describe,expect,it} from 'vitest'
import {stabilizeFaceMesh,hasFreshFace} from './face3d-tracking'
const make=(x:number,y:number)=>Array.from({length:478},()=>({x,y,z:-.02}))
function face(){
 const p=make(.5,.52)
 p[33]={x:.35,y:.40,z:-.02}
 p[263]={x:.65,y:.40,z:-.02}
 p[4]={x:.5,y:.55,z:-.025}
 p[152]={x:.5,y:.74,z:-.018}
 return p
}
describe('3D face motion: rigid-fast, skin-jitter-slow',()=>{
 it('keeps all 478 landmarks in same normalized frame',()=>{
  const previous=face(),next=face()
  next[4]={...next[4],y:.57}
  const result=stabilizeFaceMesh(previous,next,35,9/16)
  expect(result).toHaveLength(478)
  expect(result[4].y).toBeGreaterThan(.55)
  expect(result[4].y).toBeLessThan(.57)
 })
 it('follows realistic horizontal and vertical head movement without geometric lag',()=>{
  const previous=face()
  const next=previous.map(p=>({...p,x:p.x+.07,y:p.y+.08,z:p.z+.01}))
  const result=stabilizeFaceMesh(previous,next,35,9/16)
  for(const id of [33,263,4,152,234,454]){
   expect(result[id].x).toBeCloseTo(next[id].x,5)
   expect(result[id].y).toBeCloseTo(next[id].y,5)
  }
 })
 it('preserves rigid rotation and zoom rather than making face waves',()=>{
  const prev=face(),r=.24,zoom=1.13,c=Math.cos(r)*zoom,s=Math.sin(r)*zoom
  const aspect=9/16,cx=.5,cy=.40
  const next=prev.map(p=>{
   const x=(p.x-cx)*aspect,y=p.y-cy
   return {x:cx+(x*c-y*s)/aspect,y:cy+x*s+y*c,z:p.z*zoom}
  })
  const result=stabilizeFaceMesh(prev,next,34,aspect)
  for(const id of [33,263,4,152,234,454]){
   expect(result[id].x).toBeCloseTo(next[id].x,5)
   expect(result[id].y).toBeCloseTo(next[id].y,5)
  }
 })
 it('damps one noisy landmark while eye anchors stay stable',()=>{
  const prev=face(),next=face()
  next[4]={...next[4],x:.53}
  const result=stabilizeFaceMesh(prev,next,33,9/16)
  expect(result[4].x).toBeGreaterThan(.5)
  expect(result[4].x).toBeLessThan(.53)
  expect(result[33].x).toBeCloseTo(prev[33].x)
 })
 it('does not interpolate a lost or switched face',()=>{
  const previous=face(),next=face()
  next[33].x=.95
  expect(stabilizeFaceMesh(previous,next,35,9/16)[33].x).toBe(.95)
  expect(stabilizeFaceMesh(previous,next,400,9/16)[33].x).toBe(.95)
  expect(hasFreshFace(1000,1400)).toBe(false)
  expect(hasFreshFace(1000,1300)).toBe(true)
  expect(hasFreshFace(0,100)).toBe(false)
 })
})
