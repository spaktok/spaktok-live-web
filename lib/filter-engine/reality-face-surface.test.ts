import {describe,expect,it} from 'vitest'
import {FaceLandmarker} from '@mediapipe/tasks-vision'
import {createDenseFaceTopology,isDenseFaceFrame,FACE_LANDMARK_COUNT} from './reality-face-topology'
import {createFaceSemanticAtlas,expandFaceRegion} from './reality-face-regions'
import {createRegionSurfaceBinding,evaluateFaceSurfaceBinding} from './reality-face-surface'

const conn=FaceLandmarker.FACE_LANDMARKS_TESSELATION
const topology=createDenseFaceTopology(conn,FACE_LANDMARK_COUNT)
const atlas=createFaceSemanticAtlas(topology,{
 lips:FaceLandmarker.FACE_LANDMARKS_LIPS,
 leftEye:FaceLandmarker.FACE_LANDMARKS_LEFT_EYE,
 rightEye:FaceLandmarker.FACE_LANDMARKS_RIGHT_EYE,
 leftEyebrow:FaceLandmarker.FACE_LANDMARKS_LEFT_EYEBROW,
 rightEyebrow:FaceLandmarker.FACE_LANDMARKS_RIGHT_EYEBROW,
 leftIris:FaceLandmarker.FACE_LANDMARKS_LEFT_IRIS,
 rightIris:FaceLandmarker.FACE_LANDMARKS_RIGHT_IRIS,
 faceOval:FaceLandmarker.FACE_LANDMARKS_FACE_OVAL,
})

describe('MediaPipe full dense facial topology',()=>{
 it('builds the true MediaPipe triangles, not a handful of anchor points',()=>{
  expect(topology.vertexCount).toBe(478)
  expect(topology.triangleCount).toBeGreaterThan(800)
  expect(topology.indices.length).toBe(topology.triangleCount*3)
  expect(new Set(topology.triangles.map(t=>[...t].sort((a,b)=>a-b).join(':'))).size)
   .toBe(topology.triangleCount)
  expect(topology.triangles[0]).toEqual([
   conn[0].start,conn[0].end,conn[1].end,
  ])
  for(const [i,triangle] of topology.triangles.entries()){
   const [a,b,c]=triangle
   expect(topology.triangleIdsByVertex[a]).toContain(i)
   expect(topology.neighbors[b]).toContain(c)
  }
 })
 it('fails closed for corrupt winding, degenerate or duplicate triangles',()=>{
  const valid=[{start:0,end:1},{start:1,end:2},{start:2,end:0}]
  expect(createDenseFaceTopology(valid,3).triangleCount).toBe(1)
  expect(()=>createDenseFaceTopology([...valid,...valid],3))
   .toThrow('reality_duplicate_triangle')
  expect(()=>createDenseFaceTopology([valid[0],valid[2],valid[1]],3))
   .toThrow('reality_corrupt_triangle')
  expect(()=>createDenseFaceTopology([{start:0,end:1}],3))
   .toThrow('reality_invalid_topology')
 })
 it('reuses anatomical landmark contour connections and adjacency',()=>{
  for(const region of ['lips','left_eye','right_eye','left_eyebrow',
    'right_eyebrow','face_oval','nose','forehead','jaw','chin',
    'left_cheek','right_cheek'] as const){
   expect(atlas[region].vertexIds.length).toBeGreaterThan(0)
   expect(atlas[region].triangleIds.length).toBeGreaterThan(0)
  }
  expect(atlas.left_iris.vertexIds.length).toBeGreaterThan(0)
  expect(atlas.right_iris.vertexIds.length).toBeGreaterThan(0)
  expect(atlas.forehead.approximate).toBe(true)
  expect(atlas.lips.approximate).toBe(false)
  expect(expandFaceRegion(topology,[10],2).length)
   .toBeGreaterThan(expandFaceRegion(topology,[10],0).length)
 })
 it('validates finite detection points without inventing a metric face',()=>{
  const points=Array.from({length:478},()=>({x:.5,y:.5,z:0}))
  expect(isDenseFaceFrame(points)).toBe(true)
  points[80]={x:Number.NaN,y:.5,z:0}
  expect(isDenseFaceFrame(points)).toBe(false)
 })
})

describe('Barycentric surface attachment follows all tracked vertices',()=>{
 const id=atlas.forehead.triangleIds.find(id=>{
  const t=topology.triangles[id]
  return t.every(v=>v<468)
 })!
 const [a,b,c]=topology.triangles[id]
 const points=Array.from({length:478},()=>({x:.5,y:.5,z:0}))
 points[a]={x:.30,y:.30,z:-.01}
 points[b]={x:.42,y:.30,z:-.01}
 points[c]={x:.35,y:.43,z:-.01}
 const target={x:(points[a].x+points[b].x+points[c].x)/3,
  y:(points[a].y+points[b].y+points[c].y)/3}
 const binding=createRegionSurfaceBinding(topology,atlas,'forehead',target,points,720/1280)!
 const viewport={sourceWidth:720,sourceHeight:1280,outputWidth:360,outputHeight:640,mirror:false}
 it('binds to a real triangle with stable weights, not a fixed screen coordinate',()=>{
  expect(binding).not.toBeNull()
  expect(binding.region).toBe('forehead')
  expect(binding.weights.reduce((a,b)=>a+b,0)).toBeCloseTo(1)
  const surface=evaluateFaceSurfaceBinding(binding,points,viewport,12)!
  expect(surface).not.toBeNull()
  expect(surface.z).toBeGreaterThan(18)
  expect(surface.nz).toBeGreaterThan(0)
  expect(surface.triangleId).toBe(binding.triangleId)
 })
 it('follows expression, translation and selfie mirroring while keeping triangle identity',()=>{
  const original=evaluateFaceSurfaceBinding(binding,points,viewport)!
  const moved=points.map(p=>({...p}))
  for(const i of binding.vertices){
   moved[i].x+=.05
   moved[i].y+=.1
  }
  const after=evaluateFaceSurfaceBinding(binding,moved,viewport)!
  expect(after.x-original.x).toBeCloseTo(18)
  expect(after.y-original.y).toBeCloseTo(64)
  expect(after.triangleId).toBe(original.triangleId)
  const mirrored=evaluateFaceSurfaceBinding(binding,points,{...viewport,mirror:true})!
  expect(mirrored.x+original.x).toBeCloseTo(360)
  expect(mirrored.y).toBeCloseTo(original.y)
 })
 it('hides degenerate frames instead of continuing to draw a stale attachment',()=>{
  const collapsed=points.map(p=>({...p}))
  for(const i of binding.vertices)collapsed[i]={x:.5,y:.5,z:0}
  expect(evaluateFaceSurfaceBinding(binding,collapsed,viewport)).toBeNull()
  expect(createRegionSurfaceBinding(topology,atlas,'forehead',target,[],1))
   .toBeNull()
 })
})
