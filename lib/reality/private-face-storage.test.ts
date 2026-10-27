import {describe,it,expect} from 'vitest'
import {validatePrivateFaceGlb,PRIVATE_FACE_MAX_BYTES} from './private-face-storage'
function testGlb(overrides:Record<string,unknown>={}):ArrayBuffer{
 const gltf={
  asset:{version:'2.0'},
  accessors:[{count:468},{count:2694},{count:468}],
  meshes:[{primitives:[{attributes:{POSITION:0,TEXCOORD_0:2},indices:1,mode:4}]}],
  images:[{bufferView:0,mimeType:'image/png'}],
  buffers:[{byteLength:64}],
  ...overrides,
 }
 const encoded=new TextEncoder().encode(JSON.stringify(gltf))
 const padded=Math.ceil(encoded.length/4)*4
 const data=new ArrayBuffer(20+padded)
 const view=new DataView(data)
 view.setUint32(0,0x46546c67,true)
 view.setUint32(4,2,true)
 view.setUint32(8,data.byteLength,true)
 view.setUint32(12,padded,true)
 view.setUint32(16,0x4e4f534a,true)
 new Uint8Array(data,20).fill(32)
 new Uint8Array(data,20,encoded.length).set(encoded)
 return data
}
describe('Private Cloudflare R2 face-asset security gate',()=>{
 it('accepts exactly one self-contained 468-point solid textured canonical GLB',()=>{
  expect(()=>validatePrivateFaceGlb(testGlb())).not.toThrow()
 })
 it('blocks external resources, scripts and alternate topology',()=>{
  expect(()=>validatePrivateFaceGlb(testGlb({images:[{uri:'https://evil.example/tracker.jpg'}]})))
   .toThrow('private_face_bad_topology')
  expect(()=>validatePrivateFaceGlb(testGlb({
   meshes:[{primitives:[{attributes:{POSITION:0,TEXCOORD_0:2},indices:1,mode:1}]}],
  }))).toThrow('private_face_bad_topology')
  expect(()=>validatePrivateFaceGlb(testGlb({
   extensionsRequired:['KHR_draco_mesh_compression'],
  }))).toThrow('private_face_bad_topology')
 })
 it('rejects invalid magic, payload size and zero-body uploads',()=>{
  expect(()=>validatePrivateFaceGlb(new ArrayBuffer(5))).toThrow('private_face_bad_file_size')
  const bytes=testGlb()
  new DataView(bytes).setUint32(0,0x12345678,true)
  expect(()=>validatePrivateFaceGlb(bytes)).toThrow('private_face_invalid_glb')
  expect(PRIVATE_FACE_MAX_BYTES).toBe(12582912)
 })
})
