import {describe,expect,it} from 'vitest'
import {checkForgeLibraryGlb} from './spaktok-forge-library'

function glb(doc:Record<string,unknown>,padTo=256):Uint8Array{
 let text=JSON.stringify(doc)
 while((text.length%4)!==0)text+=' '
 const json=new TextEncoder().encode(text)
 const total=Math.max(padTo,20+json.length)
 const out=new Uint8Array(total)
 const v=new DataView(out.buffer)
 v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true);v.setUint32(8,total,true)
 v.setUint32(12,json.length,true);v.setUint32(16,0x4e4f534a,true)
 out.set(json,20)
 return out
}
const good=(count=300)=>({
 asset:{version:'2.0'},
 meshes:[{primitives:[{indices:0,attributes:{POSITION:1,NORMAL:2,TEXCOORD_0:3}}]}],
 accessors:[{count},{count:10},{count:10},{count:10}],
 materials:[{pbrMetallicRoughness:{}}],
 images:[{bufferView:0,mimeType:'image/png'}],
})

describe('checkForgeLibraryGlb',()=>{
 it('accepts a textured triangle mesh and counts triangles',()=>{
  expect(checkForgeLibraryGlb(glb(good()))).toEqual({ok:true,triangles:100})
 })
 it('rejects meshes denser than the Worker limit',()=>{
  expect(checkForgeLibraryGlb(glb(good(150001*3)))).toEqual({ok:false,error:'glb_too_dense'})
 })
 it('rejects external URIs',()=>{
  const doc={...good(),images:[{uri:'https://evil.example/a.png'}]}
  expect(checkForgeLibraryGlb(glb(doc))).toEqual({ok:false,error:'glb_external_uri'})
 })
 it('rejects untextured results',()=>{
  expect(checkForgeLibraryGlb(glb({...good(),images:[]}))).toEqual({ok:false,error:'glb_no_pbr_texture'})
 })
 it('rejects a wrong declared length',()=>{
  const bytes=glb(good());new DataView(bytes.buffer).setUint32(8,bytes.length+4,true)
  expect(checkForgeLibraryGlb(bytes)).toEqual({ok:false,error:'glb_header'})
 })
 it('rejects missing UVs',()=>{
  const doc={...good(),meshes:[{primitives:[{indices:0,attributes:{POSITION:1,NORMAL:2}}]}]}
  expect(checkForgeLibraryGlb(glb(doc))).toEqual({ok:false,error:'glb_missing_uv_or_normals'})
 })
})
