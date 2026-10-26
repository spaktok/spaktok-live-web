import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {prepareUploadedCrown,UPLOADED_CROWN_MOBILE,CROWN_BAND_LOCAL_Y,TARGET_CROWN_HEAD_WIDTH} from './crown-uploaded-asset'
describe('uploaded GLB tiara geometry and landmark-10 forehead anchor',()=>{
 it('uses the exact uploaded model URL instead of placeholder crown',()=>{
  expect(UPLOADED_CROWN_MOBILE).toContain('/spaktok-owner-crown-mobile.glb')
 })
 it('normalizes 25 cm wide +Y-up source mesh into selfie image coordinates',()=>{
  const root=new THREE.Group()
  const geo=new THREE.BoxGeometry(.253,.1669,.2166)
  const material=new THREE.MeshBasicMaterial()
  const m=new THREE.Mesh(geo,material);m.position.set(0,.07215,.036);root.add(m)
  const x=prepareUploadedCrown(root)
  expect(x.sourceWidth).toBeCloseTo(.253,4)
  expect(x.bandY).toBeCloseTo(CROWN_BAND_LOCAL_Y,6)
  expect(root.scale.x).toBeCloseTo(TARGET_CROWN_HEAD_WIDTH/.253)
  expect(root.scale.y).toBeCloseTo(-root.scale.x)
  expect(root.position.x).toBeCloseTo(0)
  geo.dispose();material.dispose()
 })
 it('rejects missing or corrupt mesh rather than pretending to render HD model',()=>{
  expect(()=>prepareUploadedCrown(new THREE.Group())).toThrow('uploaded_crown_invalid_bounds')
 })
})
