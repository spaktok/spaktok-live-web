import {describe,expect,it} from 'vitest'
import * as THREE from 'three'
import {
 buildCalibratedWordFaceRig,eligibleWordRigMeshes,WORD_RIG_CHANNELS,
 DEFAULT_WORD_RIG_CALIBRATION,
} from './spaktok-word-face-rig'

function sampleFace(){
 const verts:number[]=[]
 for(let i=0;i<45;i++)for(let j=0;j<45;j++){
  const x=j/44*2-1
  const y=i/44*2-1
  const z=.08+.58*Math.exp(-(x*x+y*y)*1.3)
  verts.push(x,y,z)
 }
 const geometry=new THREE.BufferGeometry()
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(verts,3))
 geometry.computeBoundingBox()
 return geometry
}
describe('Spaktok Word - creator-calibrated facial morph generator',()=>{
 it('builds seven named relative morph channels without altering original vertex bytes',()=>{
  const face=sampleFace()
  const original=new Float32Array((face.getAttribute('position').array as Float32Array))
  const {geometry,diagnostics}=buildCalibratedWordFaceRig(face)
  expect(geometry).not.toBe(face)
  expect(geometry.morphTargetsRelative).toBe(true)
  expect(geometry.morphAttributes.position).toHaveLength(7)
  expect(geometry.morphAttributes.position.map(x=>x.name)).toEqual([...WORD_RIG_CHANNELS])
  expect(geometry.morphAttributes.position.every(x=>x.count===original.length/3))
   .toBe(true)
  expect(Array.from(face.getAttribute('position').array)).toEqual(Array.from(original))
  for(const channel of WORD_RIG_CHANNELS){
   expect(diagnostics.activeVertices[channel]).toBeGreaterThan(0)
  }
  const jaw=geometry.morphAttributes.position[0].array
  expect(Array.from(jaw).some(x=>Math.abs(Number(x))>1e-6)).toBe(true)
  geometry.dispose();face.dispose()
 })
 it('does not accept a prior morph rig or tiny/unworkable head geometry',()=>{
  const face=sampleFace()
  const {geometry}=buildCalibratedWordFaceRig(face)
  expect(()=>buildCalibratedWordFaceRig(geometry))
   .toThrow('word_rig_existing_morphs_preserve_original')
  expect(()=>buildCalibratedWordFaceRig(new THREE.BoxGeometry(1,1,1)))
   .toThrow('word_rig_face_mesh_vertices_out_of_bounds')
  geometry.dispose();face.dispose()
 })
 it('requires plausible creator eye/mouth calibration before deformation',()=>{
  const face=sampleFace()
  expect(()=>buildCalibratedWordFaceRig(face,{
   ...DEFAULT_WORD_RIG_CALIBRATION,eyeY:.24,
  })).toThrow('word_rig_calibration_invalid')
  expect(()=>buildCalibratedWordFaceRig(face,{
   ...DEFAULT_WORD_RIG_CALIBRATION,mouthY:.79,
  })).toThrow('word_rig_calibration_invalid')
  expect(()=>buildCalibratedWordFaceRig(face,{
   ...DEFAULT_WORD_RIG_CALIBRATION,strength:Infinity,
  })).toThrow('word_rig_calibration_invalid')
  face.dispose()
 })
 it('handles face meshes with the opposite Z facing direction',()=>{
  const face=sampleFace()
  const p=face.getAttribute('position') as THREE.BufferAttribute
  for(let i=0;i<p.count;i++)p.setZ(i,-p.getZ(i))
  p.needsUpdate=true;face.computeBoundingBox()
  const {geometry,diagnostics}=buildCalibratedWordFaceRig(face,{
   ...DEFAULT_WORD_RIG_CALIBRATION,front:'negative-z',
  })
  expect(diagnostics.activeVertices.jawOpen).toBeGreaterThan(12)
  geometry.dispose();face.dispose()
 })
 it('limits auto rig selection to unrigged meshes with enough vertices',()=>{
  const group=new THREE.Group()
  const face=new THREE.Mesh(sampleFace(),new THREE.MeshStandardMaterial())
  const artifact=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshStandardMaterial())
  group.add(face,artifact)
  expect(eligibleWordRigMeshes(group)).toEqual([face])
  const rig=buildCalibratedWordFaceRig(face.geometry)
  const old=face.geometry
  face.geometry=rig.geometry
  expect(eligibleWordRigMeshes(group)).toEqual([])
  old.dispose();rig.geometry.dispose()
  ;(face.material as THREE.Material).dispose()
  artifact.geometry.dispose();(artifact.material as THREE.Material).dispose()
 })
})
