import {describe,expect,it} from 'vitest'
import {inspectStudioGlbTopology} from './spaktok-glb-topology-audit'

function makeGlb(indices:number[],vertices=5,indexType:5121|5123|5125=5123):ArrayBuffer{
 const nbytes=indexType===5125?4:indexType===5123?2:1
 const aligned=Math.ceil(indices.length*nbytes/4)*4
 const doc={
  asset:{version:'2.0'},
  buffers:[{byteLength:aligned}],
  bufferViews:[{buffer:0,byteOffset:0,byteLength:aligned}],
  accessors:[
   {type:'SCALAR',componentType:indexType,count:indices.length,bufferView:0},
   {type:'VEC3',componentType:5126,count:vertices},
  ],
  meshes:[{primitives:[{mode:4,indices:0,attributes:{POSITION:1}}]}],
 }
 const raw=new TextEncoder().encode(JSON.stringify(doc))
 const jLen=Math.ceil(raw.length/4)*4
 const out=new ArrayBuffer(20+jLen+8+aligned),v=new DataView(out)
 v.setUint32(0,0x46546c67,true);v.setUint32(4,2,true)
 v.setUint32(8,out.byteLength,true)
 v.setUint32(12,jLen,true);v.setUint32(16,0x4e4f534a,true)
 new Uint8Array(out,20,jLen).fill(32)
 new Uint8Array(out,20,raw.length).set(raw)
 const offset=20+jLen
 v.setUint32(offset,aligned,true);v.setUint32(offset+4,0x004e4942,true)
 for(let i=0;i<indices.length;i++){
  const o=offset+8+i*nbytes
  if(nbytes===4)v.setUint32(o,indices[i],true)
  else if(nbytes===2)v.setUint16(o,indices[i],true)
  else v.setUint8(o,indices[i])
 }
 return out
}

describe('Spaktok private GLB topology scan — no GPU',()=>{
 it('identifies two triangles sharing only one manifold edge',()=>{
  const glb=makeGlb([0,1,2,2,1,3])
  const r=inspectStudioGlbTopology(glb)
  expect(r.status).toBe('checked')
  expect(r.triangles).toBe(2)
  expect(r.edges).toBe(5)
  expect(r.boundaryEdges).toBe(4)
  expect(r.nonManifoldEdges).toBe(0)
  expect(r.publishReady).toBe(false)
 })
 it('detects an edge used by three faces as non-manifold',()=>{
  for(const componentType of [5121,5123,5125]){
   const glb=makeGlb([0,1,2,1,0,3,0,1,4],5,componentType)
   const r=inspectStudioGlbTopology(glb)
   expect(r.status).toBe('checked')
   expect(r.nonManifoldEdges).toBe(1)
   expect(r.triangles).toBe(3)
  }
 })
 it('counts and ignores degenerate index triangles',()=>{
  const r=inspectStudioGlbTopology(makeGlb([0,0,1,0,1,2]))
  expect(r.degenerateIndexTriangles).toBe(1)
  expect(r.triangles).toBe(2)
  expect(r.edges).toBe(3)
 })
 it('rejects out-of-range indices rather than silently considering them safe',()=>{
  const r=inspectStudioGlbTopology(makeGlb([0,1,9]))
  expect(r.status).toBe('not-checked')
  expect(r.reason).toBe('invalid_vertex_index')
  expect(r.publishReady).toBe(false)
 })
 it('fails closed when corrupted or unsupported geometry arrives',()=>{
  const bad=makeGlb([0,1,2])
  new DataView(bad).setUint32(0,0,true)
  expect(inspectStudioGlbTopology(bad).status).toBe('not-checked')
  expect(inspectStudioGlbTopology(new ArrayBuffer(100)).publishReady)
   .toBe(false)
 })
})
