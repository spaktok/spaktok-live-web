import {describe,expect,it} from 'vitest'
import {
 createLiveFaceMeshTemplate,updateLiveFaceMesh,chooseLiveMeshLevel,
} from './reality-live-personal-mesh'

const topology={
 vertexCount:478,triangleCount:2,
 indices:new Uint16Array([0,1,2, 2,1,3]),
}
const landmarks=Array.from({length:478},(_,index)=>({
 x:.3+(index%20)*.005,y:.2+Math.floor(index/20)*.003,z:index*.00001,
}))
const viewport={sourceWidth:1920,sourceHeight:1080,
 outputWidth:720,outputHeight:1280,mirror:false}

describe('Live personal face mesh',()=>{
 it('creates a real indexed mesh with shared edges, not a paper million triangles',()=>{
  const base=createLiveFaceMeshTemplate(topology,0)
  const one=createLiveFaceMeshTemplate(topology,1)
  const two=createLiveFaceMeshTemplate(topology,2)
  expect(base.triangleCount).toBe(2)
  expect(one.triangleCount).toBe(8)
  expect(two.triangleCount).toBe(32)
  expect(one.vertexCount).toBe(483)
  expect(new Set(Array.from(one.indices).filter(i=>i>=478)).size).toBe(5)
  expect(Math.max(...two.indices)).toBeLessThan(two.vertexCount)
 })
 it('preserves the exact measured points at level zero and interpolates reused edges',()=>{
  const mesh=createLiveFaceMeshTemplate(topology,1)
  const out=updateLiveFaceMesh(mesh,landmarks,viewport)!
  expect(out.vertexCount).toBe(mesh.vertexCount)
  expect(out.measuredLandmarks).toBe(478)
  const scale=Math.max(viewport.outputWidth/viewport.sourceWidth,
   viewport.outputHeight/viewport.sourceHeight)
  const x0=(viewport.outputWidth-viewport.sourceWidth*scale)*.5+
   landmarks[0].x*viewport.sourceWidth*scale
  expect(out.positions[0]).toBeCloseTo(x0,3)
  const midpoint=478*3
  expect(out.positions[midpoint]).toBeCloseTo((out.positions[0]+out.positions[3])/2,3)
  expect(out.positions[midpoint+1]).toBeCloseTo((out.positions[1]+out.positions[4])/2,3)
 })
 it('mirrors only one horizontal image axis and keeps Y/Z stable',()=>{
  const mesh=createLiveFaceMeshTemplate(topology,0)
  const normal=updateLiveFaceMesh(mesh,landmarks,viewport)!
  const mirrored=updateLiveFaceMesh(mesh,landmarks,{...viewport,mirror:true})!
  expect(normal.positions[0]+mirrored.positions[0]).toBeCloseTo(viewport.outputWidth,3)
  expect(normal.positions[1]).toBeCloseTo(mirrored.positions[1],3)
  expect(normal.positions[2]).toBeCloseTo(mirrored.positions[2],3)
 })
 it('never reuses another frame when tracking data becomes corrupt',()=>{
  const mesh=createLiveFaceMeshTemplate(topology,2)
  expect(updateLiveFaceMesh(mesh,[],viewport)).toBeNull()
  const broken=[...landmarks];broken[4]={x:NaN,y:0,z:0}
  expect(updateLiveFaceMesh(mesh,broken,viewport)).toBeNull()
  const wrong=new Float32Array(3)
  expect(updateLiveFaceMesh(mesh,landmarks,viewport,wrong)).toBeNull()
  expect(updateLiveFaceMesh(mesh,landmarks,{...viewport,outputWidth:0})).toBeNull()
  expect(()=>createLiveFaceMeshTemplate({...topology,triangleCount:3},1)).toThrow()
 })
 it('throttles subdivision for low FPS and mobile capabilities',()=>{
  expect(chooseLiveMeshLevel('low',60,true)).toBe(0)
  expect(chooseLiveMeshLevel('high',null,true)).toBe(0)
  expect(chooseLiveMeshLevel('high',18,true)).toBe(0)
  expect(chooseLiveMeshLevel('mid',30,true)).toBe(1)
  expect(chooseLiveMeshLevel('desktop',60,true)).toBe(2)
  expect(chooseLiveMeshLevel('desktop',60,false)).toBe(0)
 })
})
