import {describe,expect,it} from 'vitest'
import {assertLocalPhotoGlb,validateCanonicalVertexOrder,LOCAL_PHOTO_FACE_ID} from './reality-live-photo-face'
import {faceFxCatalog} from './params'
import {getRealityEffect} from './reality-effect-manifest'

function glbWith(primitives:{mode?:number}[],uri?:string){
 const json={
  asset:{version:'2.0'},
  buffers:[{byteLength:0}],
  images:uri?[{uri}]:[{bufferView:0,mimeType:'image/png'}],
  meshes:[{primitives}],
 }
 const raw=new TextEncoder().encode(JSON.stringify(json))
 const length=Math.ceil(raw.length/4)*4
 const buffer=new ArrayBuffer(20+length)
 const view=new DataView(buffer)
 view.setUint32(0,0x46546c67,true)
 view.setUint32(4,2,true)
 view.setUint32(8,20+length,true)
 view.setUint32(12,length,true)
 view.setUint32(16,0x4e4f534a,true)
 new Uint8Array(buffer,20).fill(32)
 new Uint8Array(buffer,20,raw.length).set(raw)
 return buffer
}
describe('Local photo face 3D filter',()=>{
 it('is a registered camera effect, not a crown-specific branch',()=>{
  expect(faceFxCatalog.some(x=>x.id===LOCAL_PHOTO_FACE_ID)).toBe(true)
  expect(getRealityEffect(LOCAL_PHOTO_FACE_ID)?.kind).toBe('wearable-3d')
 })
 it('recognizes a trusted embedded textured solid GLB',()=>{
  expect(()=>assertLocalPhotoGlb(glbWith([{mode:4}]))).not.toThrow()
  expect(()=>assertLocalPhotoGlb(glbWith([{}]))).not.toThrow()
 })
 it('rejects links that could transmit data to untrusted model providers',()=>{
  expect(()=>assertLocalPhotoGlb(glbWith([{mode:4}],'https://example.com/texture.png')))
   .toThrow('photo_face_external_resources_forbidden')
  expect(()=>assertLocalPhotoGlb(glbWith([{mode:1}]))).toThrow('photo_face_requires_solid_mesh')
  expect(()=>assertLocalPhotoGlb(new ArrayBuffer(5))).toThrow('photo_face_file_size')
 })
 it('verifies original vertex IDs and rejects 468 unrelated positions',()=>{
  const original=Array.from({length:468},(_,i)=>[
   Math.cos(i*.21)*2+(i%16)*.05,
   Math.sin(i*.11)*1.8+(i%23)*.02,
   Math.sin(i*.05)*.35,
  ] as const)
  const transformed=new Float32Array(original.flatMap(p=>[
   p[0]*.01-.3,p[1]*.01+.5,p[2]*.01-.1,
  ]))
  const result=validateCanonicalVertexOrder(transformed,original)
  expect(result.vertices).toBe(468)
  expect(result.meanError).toBeLessThan(.00001)
  const reordered=Float32Array.from(transformed)
  for(let i=0;i<3;i++){
   const t=reordered[i];reordered[i]=reordered[120*3+i];reordered[120*3+i]=t
  }
  expect(()=>validateCanonicalVertexOrder(reordered,original))
   .toThrow('photo_face_vertex_order_mismatch')
  expect(()=>validateCanonicalVertexOrder(new Float32Array(10),original))
   .toThrow('photo_face_requires_468_canonical_vertices')
 })
})
