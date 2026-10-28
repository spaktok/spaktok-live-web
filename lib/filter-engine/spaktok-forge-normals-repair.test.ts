import {describe,it,expect} from 'vitest'
import * as THREE from 'three'
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js'
import {
 repairForgeGlbNormals,
} from './spaktok-forge-normals-repair'
import {auditStudioGlbBytes} from './reality-production-glb-audit'

// GLTFExporter is browser-only. Node's Vitest runner has Blob but no
// FileReader; supply only the async read API used by Three.js. This is
// a TEST polyfill, never shipped to browsers or the GPU service.
class TestFileReader{
 result:ArrayBuffer|string|null=null
 onloadend:(()=>void)|null=null
 readAsArrayBuffer(blob:Blob){
  void blob.arrayBuffer().then(bytes=>{
   this.result=bytes
   this.onloadend?.()
  })
 }
 readAsDataURL(blob:Blob){
  void blob.arrayBuffer().then(bytes=>{
   this.result='data:'+(blob.type||'application/octet-stream')+
    ';base64,'+Buffer.from(bytes).toString('base64')
   this.onloadend?.()
  })
 }
}
Object.defineProperty(globalThis,'FileReader',{
 configurable:true,value:TestFileReader,
})

function makeGeometry(){
 const g=new THREE.BufferGeometry()
 g.setAttribute('position',new THREE.Float32BufferAttribute([
  -1,-1,0,1,-1,0,1,1,0,-1,1,0,
 ],3))
 g.setAttribute('uv',new THREE.Float32BufferAttribute([
  0,0,1,0,1,1,0,1,
 ],2))
 g.setIndex([0,1,2,0,2,3])
 return g
}
async function makeGlb(withNormals=false,morph=false){
 const g=makeGeometry()
 if(withNormals)g.computeVertexNormals()
 if(morph){
  g.morphTargetsRelative=true
  g.morphAttributes.position=[new THREE.Float32BufferAttribute(
   new Array(12).fill(0),3)]
 }
 const mesh=new THREE.Mesh(g,new THREE.MeshStandardMaterial({
  color:0xcc5533,roughness:.64,
 }))
 mesh.name='licensed_sample_mesh'
 const scene=new THREE.Scene()
 scene.add(mesh)
 const output=await new GLTFExporter().parseAsync(scene,{binary:true})
 expect(output).toBeInstanceOf(ArrayBuffer)
 g.dispose();(mesh.material as THREE.Material).dispose()
 return output as ArrayBuffer
}
describe('Forge audited local GLB vertex normal repair',()=>{
 it('adds missing normals while retaining triangles and PBR',async()=>{
  const original=await makeGlb()
  const source=auditStudioGlbBytes(original)
  expect(source.valid).toBe(true)
  expect(source.hasNormals).toBe(false)
  const fixed=await repairForgeGlbNormals(original)
  expect(fixed.repairedMeshes).toBe(1)
  expect(fixed.alreadyComplete).toBe(false)
  expect(fixed.after.valid).toBe(true)
  expect(fixed.after.hasNormals).toBe(true)
  expect(fixed.after.triangles).toBe(source.triangles)
  expect(fixed.after.materials).toBe(source.materials)
  expect(fixed.after.hasPBR).toBe(source.hasPBR)
  expect(fixed.after.hasUV).toBe(source.hasUV)
  expect(auditStudioGlbBytes(original).hasNormals).toBe(false)
 })
 it('does not export or charge if normals already exist',async()=>{
  const original=await makeGlb(true)
  const fixed=await repairForgeGlbNormals(original)
  expect(fixed.alreadyComplete).toBe(true)
  expect(fixed.bytes).toBe(original)
  expect(fixed.repairedMeshes).toBe(0)
 })
 it('safely refuses malformed input and facial morph assets',async()=>{
  await expect(repairForgeGlbNormals(new ArrayBuffer(40))).rejects.toThrow()
  const rigged=await makeGlb(false,true)
  await expect(repairForgeGlbNormals(rigged))
   .rejects.toThrow('forge_repair_animated_or_morphed_asset_requires_blender')
 })
})
