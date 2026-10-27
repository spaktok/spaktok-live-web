import {describe,it,expect} from 'vitest'
import {
 parseCanonicalOBJ,buildCanonicalRetarget,retargetTrackedFace,type Vec3,
} from './reality-canonical-retarget'
import {semanticHandMaskFromConfidence,semanticHandMaskFresh} from './reality-hand-segmentation'
import type {TrackedHand} from './reality-hand-physics'

function syntheticCanonical(){
 // 24*20 = 480 -> take first 468, with 898+ valid triangles.
 const verts:Vec3[]=Array.from({length:468},(_,i)=>{
  const col=i%24,row=Math.floor(i/24)
  return [(col-11.5)/10,(row-9.5)/10,Math.sin(col/8)*.05]
 })
 const faces:[number,number,number][]=[]
 for(let row=0;row<19;row++)for(let col=0;col<23;col++){
  const a=row*24+col,b=a+1,c=a+24,d=c+1
  if(d>=468)continue
  faces.push([a,b,c],[b,d,c])
 }
 return {vertices:verts,triangles:faces}
}
describe('Canonical OBJ retarget map (authoring time)',()=>{
 it('parses triangles, quads, UV face notation and rejects invalid paths',()=>{
  const src='v 0 0 0\nv 1 0 0\nv 1 1 0\nv 0 1 0\nvt 0.3 0.2\nf 1/1 2/1 3/1 4/1\n'
  const obj=parseCanonicalOBJ(src)
  expect(obj.vertices).toHaveLength(4)
  expect(obj.triangles).toEqual([[0,1,2],[0,2,3]])
  expect(()=>parseCanonicalOBJ('v 0 0 0\nf 1 2 3')).toThrow('reality_obj_invalid_face')
  expect(()=>parseCanonicalOBJ(src,3)).toThrow('reality_obj_oversized')
 })
 it('projects a denser template to canonical triangles, keeping weights stable',()=>{
  const canonical=syntheticCanonical()
  expect(canonical.triangles.length).toBeGreaterThan(600)
  const src={vertices:canonical.vertices.slice(0,54),
   triangles:canonical.triangles.slice(0,50)}
  const map=buildCanonicalRetarget(src,canonical)
  expect(map.targetVertices).toBe(468)
  expect(map.sourceVertices).toBe(54)
  expect(map.matches).toHaveLength(54)
  expect(map.confidence).toBe('approximate-neutral-projection')
  for(const m of map.matches){
   expect(m.weights.reduce((a,b)=>a+b,0)).toBeCloseTo(1,5)
   expect(m.indices).toHaveLength(3)
   expect(m.projectionError).toBeGreaterThanOrEqual(0)
  }
  const animated=canonical.vertices.map(([x,y,z])=>[x+.2,y-.15,z+.03] as Vec3)
  const before=retargetTrackedFace(map,canonical.vertices)!
  const after=retargetTrackedFace(map,animated)!
  expect(after).toHaveLength(54)
  expect(after[0][0]-before[0][0]).toBeCloseTo(.2,4)
  expect(after[0][1]-before[0][1]).toBeCloseTo(-.15,4)
  expect(after[0][2]-before[0][2]).toBeCloseTo(.03,4)
 })
 it('rejects missing tracked points instead of leaving a stale 3D face',()=>{
  const canonical=syntheticCanonical()
  const map=buildCanonicalRetarget({vertices:canonical.vertices.slice(0,4),
   triangles:[[0,1,2]]},canonical)
  expect(retargetTrackedFace(map,[])).toBeNull()
 })
})
describe('Point-guided semantic foreground mask',()=>{
 const landmarks=Array.from({length:21},(_,i)=>({
  x:.45+(i%5)*.016,y:.40+Math.floor(i/5)*.025,z:0,
 }))
 const hand:TrackedHand={timestamp:100,landmarks,handedness:'Right'}
 it('clips large mis-segmentation away from the observed finger/palm region',()=>{
  const pixels=new Float32Array(64*64).fill(1)
  const mask=semanticHandMaskFromConfidence(hand,pixels,64,64,120,64)!
  expect(mask).not.toBeNull()
  const count=Array.from(mask.rgba).filter((v,i)=>i%4===3&&v>0).length
  expect(count).toBeGreaterThan(10)
  expect(count).toBeLessThan(64*64*.1)
  expect(mask.rgba[3]).toBe(0)
  expect(mask.handCenter.x).toBeGreaterThan(0)
 })
 it('rejects stale masks, missing points, empty confidence and displaced hand',()=>{
  const pixels=new Float32Array(64*64).fill(1)
  const mask=semanticHandMaskFromConfidence(hand,pixels,64,64,120,64)!
  expect(semanticHandMaskFresh(mask,hand,230)).toBe(true)
  expect(semanticHandMaskFresh(mask,hand,900)).toBe(false)
  expect(semanticHandMaskFresh(mask,{...hand,
   landmarks:hand.landmarks.map(x=>({...x,x:x.x+.5}))},200)).toBe(false)
  expect(semanticHandMaskFromConfidence(hand,new Float32Array(4096),64,64,130)).toBeNull()
  expect(semanticHandMaskFromConfidence(hand,pixels,64,64,800)).toBeNull()
 })
})
