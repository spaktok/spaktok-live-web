import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {FaceLandmarker} from '@mediapipe/tasks-vision'
import {createDenseFaceTopology} from './reality-face-topology'
import {createFaceSemanticAtlas} from './reality-face-regions'
import {CANONICAL_FACE_UV_468,createFacePhotorealUV} from './reality-canonical-face-uv'
import {
 PRECISION_FACE_MASK_ID,PORCELAIN_FACE_MASK_ID,
 createPhotorealMicroTexture,PrecisionFaceSurfaceMask,
} from './reality-precision-face-mask'
import {getFaceRealityEffect} from './reality-effect-manifest'

function setup(){
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
 const geo=new THREE.BufferGeometry()
 const positions=new THREE.BufferAttribute(new Float32Array(478*3),3)
 geo.setAttribute('position',positions)
 geo.setIndex(Array.from(topology.indices))
 geo.computeVertexNormals()
 const mask=new PrecisionFaceSurfaceMask(geo,topology,atlas)
 return {geo,positions,mask}
}

describe('Face AR V2 camera-matched photo-PBR',()=>{
 it('binds 468 licensed canonical UV pairs and 10 iris fallback UV pairs',()=>{
  expect(CANONICAL_FACE_UV_468.length).toBe(936)
  const uv=createFacePhotorealUV()
  expect(uv.length).toBe(956)
  expect(uv[0]).toBeCloseTo(.499977,5)
  expect(uv[1]).toBeCloseTo(.347466,5)
  for(const v of uv)expect(Number.isFinite(v)&&v>=0&&v<=1).toBe(true)
  for(let i=468;i<478;i++){
   expect(uv[i*2]).toBe(.5)
   expect(uv[i*2+1]).toBe(.5)
  }
 })
 it('creates deterministic 256px mipmapped microdetails without time uniforms',()=>{
  const a=createPhotorealMicroTexture(),b=createPhotorealMicroTexture()
  expect(a.image.width).toBe(256)
  expect(a.image.height).toBe(256)
  expect(a.generateMipmaps).toBe(true)
  expect(a.minFilter).toBe(THREE.LinearMipmapLinearFilter)
  expect((a.image.data as Uint8Array).length).toBe(256*256*4)
  expect(Array.from((a.image.data as Uint8Array).slice(0,32)))
   .toEqual(Array.from((b.image.data as Uint8Array).slice(0,32)))
  a.dispose();b.dispose()
 })
 it('preserves shared moving mesh attributes with UV texture fixed to the face',()=>{
  const {geo,positions,mask}=setup()
  expect(mask.mesh.geometry.getAttribute('position')).toBe(positions)
  expect(mask.mesh.geometry.getAttribute('normal')).toBe(geo.getAttribute('normal'))
  expect(mask.mesh.geometry.getAttribute('uv').count).toBe(478)
  expect(mask.mesh.material.depthWrite).toBe(false)
  expect(mask.mesh.material.depthTest).toBe(true)
  expect(mask.mesh.material.fragmentShader).toContain('ggx(')
  expect(mask.mesh.material.fragmentShader).toContain('fresnel(')
  expect(mask.mesh.material.fragmentShader).not.toContain('uTime')
  expect(mask.mesh.material.uniforms.uMicro.value).toBe(mask.microTexture)
  mask.dispose();geo.dispose()
 })
 it('switches metalness, coat and scattering in-place, never changing tracking',()=>{
  const {geo,mask}=setup()
  mask.setFinish('porcelain')
  expect(mask.mesh.material.uniforms.uMetalness.value).toBe(.04)
  expect(mask.mesh.material.uniforms.uSubsurface.value).toBe(.28)
  mask.setFinish('titanium')
  expect(mask.mesh.material.uniforms.uMetalness.value).toBe(.75)
  expect(mask.mesh.material.uniforms.uSubsurface.value).toBe(0)
  mask.setLighting({brightness:.80,warmth:.30,side:.5})
  const bright=mask.mesh.material.uniforms.uAmbient.value
  const dir=(mask.mesh.material.uniforms.uLightDir.value as THREE.Vector3).clone()
  mask.setLighting({brightness:.08,warmth:-.3,side:-.5})
  expect(mask.mesh.material.uniforms.uAmbient.value).toBeLessThan(bright)
  expect((mask.mesh.material.uniforms.uLightDir.value as THREE.Vector3).x).toBeLessThan(dir.x)
  mask.setActive(true,10)
  expect(mask.mesh.material.uniforms.uStrength.value).toBe(1)
  mask.dispose();geo.dispose()
 })
 it('declares both finishes as local tracked-mesh surfaces, not face photos',()=>{
  for(const id of [PRECISION_FACE_MASK_ID,PORCELAIN_FACE_MASK_ID] as const){
   const m=getFaceRealityEffect(id)
   expect(m?.kind).toBe('face-surface')
   expect(m?.quality).toBe('tracked-mesh')
   expect(m?.occlusion).toBe('surface-depth')
   expect(m?.asset).toBeNull()
  }
 })
})
