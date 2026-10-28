import {describe,expect,it} from 'vitest'
import * as THREE from 'three'
import {
 buildCalibratedWordFaceRig,eligibleWordRigMeshes,WORD_RIG_CHANNELS,
 DEFAULT_WORD_RIG_CALIBRATION,WORD_RIG_EXPRESSIVE_CHANNELS,
} from './spaktok-word-face-rig'
import {inspectWordRigQuality} from './spaktok-word-rig-qa'

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
 it('creates 21 distinct, finite named optional expressive morphs and audits every channel',()=>{
  const face=sampleFace()
  const {geometry,diagnostics}=buildCalibratedWordFaceRig(
   face,DEFAULT_WORD_RIG_CALIBRATION,'expressive')
  const channels=geometry.morphAttributes.position
  expect(channels).toHaveLength(21)
  expect(channels.map(x=>x.name)).toEqual([...WORD_RIG_EXPRESSIVE_CHANNELS])
  expect(diagnostics.channels).toEqual([...WORD_RIG_EXPRESSIVE_CHANNELS])
  expect(diagnostics.profile).toBe('expressive')
  expect(channels.every(x=>x.count===face.getAttribute('position').count))
   .toBe(true)
  for(const name of WORD_RIG_EXPRESSIVE_CHANNELS)
   expect(diagnostics.activeVertices[name]).toBeGreaterThan(8)
  const inspection=inspectWordRigQuality(geometry,diagnostics)
  expect(inspection.channelNames).toHaveLength(21)
  expect(inspection.coverage.cheekPuff).toBeGreaterThan(0)
  for(const morph of channels){
   const values=morph.array as Float32Array
   expect(Array.from(values).every(Number.isFinite)).toBe(true)
  }
  // Channel geometry cannot merely be duplicated aliases.
  expect(Array.from(channels[0].array)).not.toEqual(Array.from(channels[19].array))
  expect(Array.from(channels[7].array)).not.toEqual(Array.from(channels[8].array))
  geometry.dispose();face.dispose()
 })
 it('keeps the expanded rig opt-in and enforces a mobile vertex budget',()=>{
  const face=sampleFace()
  expect(()=>buildCalibratedWordFaceRig(face,DEFAULT_WORD_RIG_CALIBRATION,
   'non-existent' as 'expressive')).toThrow('word_rig_profile_invalid')
  const count=22001
  const packed=new Float32Array(count*3)
  for(let i=0;i<count;i++){
   packed[i*3]=i%151/150
   packed[i*3+1]=Math.floor(i/151)/146
   packed[i*3+2]=.1+.4*Math.sin(i*.01)
  }
  const dense=new THREE.BufferGeometry()
  dense.setAttribute('position',new THREE.Float32BufferAttribute(packed,3))
  expect(()=>buildCalibratedWordFaceRig(dense,
   DEFAULT_WORD_RIG_CALIBRATION,'expressive'))
   .toThrow('word_rig_expressive_requires_mobile_retoptology_under_22000_vertices')
  face.dispose();dense.dispose()
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
