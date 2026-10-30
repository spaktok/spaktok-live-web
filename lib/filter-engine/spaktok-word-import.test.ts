import {describe,expect,it} from 'vitest'
import {inspectWordGeneratedGlb,WORD_MAX_RESULT_BYTES} from './spaktok-word-import'
function fixture(requiredExtensions:string[]=[]){
 const bytes=new Uint8Array(104)
 const data={
  asset:{version:'2.0'},
  extensionsRequired:requiredExtensions,
  buffers:[{byteLength:104}],
  bufferViews:[
   {buffer:0,byteOffset:0,byteLength:36},
   {buffer:0,byteOffset:36,byteLength:36},
   {buffer:0,byteOffset:72,byteLength:24},
   {buffer:0,byteOffset:96,byteLength:6},
  ],
  accessors:[
   {bufferView:0,componentType:5126,count:3,type:'VEC3'},
   {bufferView:1,componentType:5126,count:3,type:'VEC3'},
   {bufferView:2,componentType:5126,count:3,type:'VEC2'},
   {bufferView:3,componentType:5123,count:3,type:'SCALAR'},
  ],
  materials:[{pbrMetallicRoughness:{}}],
  meshes:[{primitives:[{
   attributes:{POSITION:0,NORMAL:1,TEXCOORD_0:2},
   indices:3,material:0,mode:4,
  }]}],
 }
 // Three vertices + a triangle in the binary chunk.
 const positions=new Float32Array(bytes.buffer,0,9)
 positions.set([0,0,0,1,0,0,0,1,0])
 const normals=new Float32Array(bytes.buffer,36,9)
 normals.set([0,0,1,0,0,1,0,0,1])
 new Uint16Array(bytes.buffer,96,3).set([0,1,2])
 const text=new TextEncoder().encode(JSON.stringify(data))
 const jsonSize=Math.ceil(text.byteLength/4)*4
 const array=new ArrayBuffer(20+jsonSize+8+bytes.byteLength)
 const v=new DataView(array)
 v.setUint32(0,0x46546c67,true)
 v.setUint32(4,2,true)
 v.setUint32(8,array.byteLength,true)
 v.setUint32(12,jsonSize,true)
 v.setUint32(16,0x4e4f534a,true)
 new Uint8Array(array,20,jsonSize).fill(32)
 new Uint8Array(array,20,text.byteLength).set(text)
 const off=20+jsonSize
 v.setUint32(off,bytes.byteLength,true)
 v.setUint32(off+4,0x004e4942,true)
 new Uint8Array(array,off+8).set(bytes)
 return array
}
describe('Spaktok Word Rodin result ingestion',()=>{
 it('accepts a real embedded geometry GLB and flags missing face rig separately',()=>{
  const info=inspectWordGeneratedGlb(fixture())
  expect(info.audit.valid).toBe(true)
  expect(info.audit.triangles).toBe(1)
  expect(info.audit.hasUV).toBe(true)
  expect(info.audit.hasPBR).toBe(true)
  expect(info.audit.rigTargets).toBe(0)
  expect(info.canOpenInAvatar).toBe(true)
  expect(info.requiresMobileOptimization).toBe(false)
 })
 it('accepts GPU PBR WebP required extension, rejects unknown decoder requirements',()=>{
  expect(inspectWordGeneratedGlb(fixture(['EXT_texture_webp'])).audit.valid)
   .toBe(true)
  expect(()=>inspectWordGeneratedGlb(fixture(['EXT_unsafe_unknown'])))
   .toThrow('word_generated_glb_failed_structural_qa')
 })
 it('fails closed on file-like gibberish and oversized payload',()=>{
  expect(()=>inspectWordGeneratedGlb(new ArrayBuffer(2048)))
   .toThrow('studio_glb_invalid_header')
  expect(()=>inspectWordGeneratedGlb(new ArrayBuffer(WORD_MAX_RESULT_BYTES+1)))
   .toThrow('word_generated_glb_out_of_bounds')
 })
 it('never accepts a GLB whose internal size/header is damaged',()=>{
  const input=fixture()
  new DataView(input).setUint32(8,0,true)
  expect(()=>inspectWordGeneratedGlb(input)).toThrow('studio_glb_invalid_header')
 })
})
