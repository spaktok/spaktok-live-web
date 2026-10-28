import {describe,expect,it} from 'vitest'
import * as THREE from 'three'
import {buildCalibratedWordFaceRig,DEFAULT_WORD_RIG_CALIBRATION,
 WORD_RIG_CHANNELS,eligibleWordRigMeshes} from './spaktok-word-face-rig'
import {
 inspectWordRigQuality,rankWordFaceMeshes,verifyWordRigGlbChannels,
} from './spaktok-word-rig-qa'
function rigGeometry(){return new THREE.SphereGeometry(1,34,22)}
function jsonGlb(meshes:unknown[]):ArrayBuffer{
 const source=JSON.stringify({asset:{version:'2.0'},meshes})
 const bytes=new TextEncoder().encode(source)
 const padded=Math.ceil(bytes.length/4)*4
 const output=new ArrayBuffer(20+padded)
 const view=new DataView(output)
 view.setUint32(0,0x46546c67,true)
 view.setUint32(4,2,true)
 view.setUint32(8,output.byteLength,true)
 view.setUint32(12,padded,true)
 view.setUint32(16,0x4e4f534a,true)
 const data=new Uint8Array(output,20,padded)
 data.fill(32);data.set(bytes)
 return output
}
describe('Spaktok Word face rig on real Three.js vertex geometry',()=>{
 it('generates seven distinct relative morph targets with calibrated coverage',()=>{
  const original=rigGeometry()
  const before=original.getAttribute('position').getY(120)
  const {geometry,diagnostics}=buildCalibratedWordFaceRig(original)
  expect(geometry).not.toBe(original)
  expect(geometry.morphTargetsRelative).toBe(true)
  expect(geometry.morphAttributes.position.map(x=>x.name)).toEqual(WORD_RIG_CHANNELS)
  expect(original.morphAttributes.position).toBeUndefined()
  expect(original.getAttribute('position').getY(120)).toEqual(before)
  expect(diagnostics.activeVertices.jawOpen).toBeGreaterThan(12)
  expect(diagnostics.activeVertices.eyeBlinkLeft).toBeGreaterThan(8)
  expect(diagnostics.activeVertices.eyeBlinkRight).toBeGreaterThan(8)
  const quality=inspectWordRigQuality(geometry,diagnostics)
  expect(quality.status).toBe('ready-for-visual-review')
  expect(quality.visualApprovalRequired).toBe(true)
  expect(quality.channelNames).toHaveLength(7)
  geometry.dispose();original.dispose()
 })
 it('fails closed on mesh already rigged and degenerate/invalid calibration',()=>{
  const source=rigGeometry()
  const generated=buildCalibratedWordFaceRig(source).geometry
  expect(()=>buildCalibratedWordFaceRig(generated))
   .toThrow('word_rig_existing_morphs_preserve_original')
  expect(()=>buildCalibratedWordFaceRig(source,{
   ...DEFAULT_WORD_RIG_CALIBRATION,mouthY:.75,
  })).toThrow('word_rig_calibration_invalid')
  expect(()=>buildCalibratedWordFaceRig(new THREE.BufferGeometry()))
   .toThrow('word_rig_face_mesh_vertices_out_of_bounds')
  generated.dispose();source.dispose()
 })
 it('gives explicit hair rejection and suggests a likely facial mesh',()=>{
  const head=new THREE.Mesh(rigGeometry())
  head.name='Female_Head_Skin'
  const hair=new THREE.Mesh(rigGeometry())
  hair.name='Gloss_Hair'
  const ranked=rankWordFaceMeshes([hair,head])
  expect(ranked[0].index).toBe(1)
  expect(ranked[0].score).toBeGreaterThan(ranked[1].score)
  const g=new THREE.Group();g.add(hair,head)
  expect(eligibleWordRigMeshes(g)).toHaveLength(2)
  head.geometry.dispose();hair.geometry.dispose()
 })
 it('rejects missing morph target names even when seven targets exist',()=>{
  const missing=jsonGlb([{
   primitives:[{targets:Array.from({length:7},()=>({POSITION:0}))}],
   extras:{targetNames:['jawOpen','eyeBlinkLeft','eyeBlinkRight']},
  }])
  expect(verifyWordRigGlbChannels(missing).missing).toContain('mouthPucker')
  const complete=jsonGlb([{
   primitives:[{targets:Array.from({length:7},()=>({POSITION:0}))}],
   extras:{targetNames:[...WORD_RIG_CHANNELS]},
  }])
  expect(verifyWordRigGlbChannels(complete).missing).toEqual([])
  expect(verifyWordRigGlbChannels(complete).present).toEqual(WORD_RIG_CHANNELS)
  expect(()=>verifyWordRigGlbChannels(new ArrayBuffer(12)))
   .toThrow('word_rig_export_invalid_glb')
 })
})
