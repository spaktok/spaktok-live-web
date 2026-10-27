import {describe,expect,it} from 'vitest'
import * as THREE from 'three'
import {assertSolidGlb,createSolidExportMesh} from './reality-solid-glb-export'

function sampleGlb(mode:number){
 const text=JSON.stringify({
  asset:{version:'2.0'},
  accessors:[{count:2694}],
  meshes:[{primitives:[{mode,indices:0}]}],
 })
 const bytes=new TextEncoder().encode(text)
 const padded=Math.ceil(bytes.length/4)*4
 const buffer=new ArrayBuffer(20+padded)
 const view=new DataView(buffer)
 view.setUint32(0,0x46546c67,true)
 view.setUint32(4,2,true)
 view.setUint32(8,buffer.byteLength,true)
 view.setUint32(12,padded,true)
 view.setUint32(16,0x4e4f534a,true)
 new Uint8Array(buffer,20).fill(32)
 new Uint8Array(buffer,20,bytes.length).set(bytes)
 return buffer
}

describe('Reality Studio must export SOLID phototextured geometry',()=>{
 it('copies wireframe preview as triangles with an independent material',()=>{
  const previewMaterial=new THREE.MeshStandardMaterial({wireframe:true})
  const preview=new THREE.Mesh(new THREE.BufferGeometry(),previewMaterial)
  preview.scale.setScalar(.01)
  const {mesh,dispose}=createSolidExportMesh(preview)
  expect((mesh.material as THREE.MeshStandardMaterial).wireframe).toBe(false)
  expect(mesh.material).not.toBe(preview.material)
  expect(previewMaterial.wireframe).toBe(true)
  expect(mesh.scale.x).toBeCloseTo(.01)
  dispose()
  previewMaterial.dispose()
  preview.geometry.dispose()
 })
 it('detects the real export bug: glTF LINES mode 1 instead of TRIANGLES mode 4',()=>{
  expect(()=>assertSolidGlb(sampleGlb(1))).toThrow('reality_export_not_triangles')
  expect(()=>assertSolidGlb(sampleGlb(4))).not.toThrow()
  expect(()=>assertSolidGlb(new ArrayBuffer(8))).toThrow('reality_export_invalid_glb')
 })
 it('rejects impossible index counts even for triangle-mode GLBs',()=>{
  const data=sampleGlb(4)
  const text=new TextDecoder().decode(new Uint8Array(data,20))
  const edited=text.replace('2694','2693')
  const bytes=new TextEncoder().encode(edited)
  new Uint8Array(data,20,bytes.length).set(bytes)
  expect(()=>assertSolidGlb(data)).toThrow('reality_export_invalid_indices')
 })
})
