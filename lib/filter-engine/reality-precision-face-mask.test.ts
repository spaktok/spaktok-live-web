import {describe,expect,it} from 'vitest'
import * as THREE from 'three'
import {FaceLandmarker} from '@mediapipe/tasks-vision'
import {createDenseFaceTopology} from './reality-face-topology'
import {createFaceSemanticAtlas} from './reality-face-regions'
import {PRECISION_FACE_MASK_ID,PrecisionFaceSurfaceMask,precisionMaskCoverage}
 from './reality-precision-face-mask'
import {faceFxCatalog} from './params'
import {getFaceRealityEffect} from './reality-effect-manifest'
function fixture(){
 const topology=createDenseFaceTopology(FaceLandmarker.FACE_LANDMARKS_TESSELATION,478)
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
 return {topology,atlas}
}
describe('Face AR V2 semantic surface mask',()=>{
 it('is a face-surface effect and not a free-floating GLB',()=>{
  const c=getFaceRealityEffect(PRECISION_FACE_MASK_ID)
  expect(faceFxCatalog.some(x=>x.id===PRECISION_FACE_MASK_ID&&x.group==='3d')).toBe(true)
  expect(c?.kind).toBe('face-surface')
  expect(c?.quality).toBe('tracked-mesh')
  expect(c?.occlusion).toBe('surface-depth')
  expect(c?.asset).toBeNull()
  expect(c?.anchor).toBeNull()
 })
 it('does not paint eye, iris, lip or face oval contours',()=>{
  const {topology,atlas}=fixture()
  const c=precisionMaskCoverage(topology,atlas)
  expect(c).toHaveLength(478)
  for(const region of ['face_oval','left_eye','right_eye','left_iris','right_iris','lips'] as const)
   for(const id of atlas[region].vertexIds)expect(c[id]).toBe(0)
  expect(Math.max(...c)).toBeGreaterThan(.4)
  for(const v of c)expect(v>=0&&v<=1).toBe(true)
 })
 it('shares depth geometry attributes, and never writes over live camera depth',()=>{
  const {topology,atlas}=fixture()
  const source=new THREE.BufferGeometry()
  const positions=new THREE.BufferAttribute(new Float32Array(478*3),3)
  source.setAttribute('position',positions)
  source.setIndex(Array.from(topology.indices))
  source.computeVertexNormals()
  const mask=new PrecisionFaceSurfaceMask(source,topology,atlas)
  expect(mask.mesh.geometry.getAttribute('position')).toBe(positions)
  expect(mask.mesh.geometry.getAttribute('normal')).toBe(source.getAttribute('normal'))
  expect(mask.mesh.material.depthWrite).toBe(false)
  expect(mask.mesh.material.depthTest).toBe(true)
  expect(mask.mesh.visible).toBe(false)
  mask.setActive(true,4)
  expect(mask.mesh.visible).toBe(true)
  expect(mask.mesh.material.uniforms.uStrength.value).toBe(1)
  mask.setActive(false)
  expect(mask.mesh.visible).toBe(false)
  mask.dispose()
  source.dispose()
 })
})
