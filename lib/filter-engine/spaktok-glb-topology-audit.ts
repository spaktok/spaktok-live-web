/**
 * Deterministic, read-only triangle edge-incidence scan on a bounded GLB.
 * One mesh primitive's vertex indices are local to that primitive;
 * counting edges across separate primitives can invent fake topology.
 * This is a conservative QA signal, not a mathematical proof of watertightness.
 *
 * Limits prevent an arbitrary creator GLB from monopolizing a mobile browser.
 * Unsupported/oversized geometry must NOT be interpreted as manifold.
 */
export type StudioTopologyReport=Readonly<{
 status:'checked'|'not-checked'
 reason?:string
 triangles:number
 edges:number
 boundaryEdges:number
 nonManifoldEdges:number
 degenerateIndexTriangles:number
 checkedPrimitives:number
 publishReady:false
}>
const MAX_GLB_BYTES=35*1024*1024
const MAX_TRIANGLES=150_000
const MAX_PRIMITIVES=24
const noReport=(reason:string):StudioTopologyReport=>({
 status:'not-checked',reason,triangles:0,edges:0,
 boundaryEdges:0,nonManifoldEdges:0,degenerateIndexTriangles:0,
 checkedPrimitives:0,publishReady:false,
})
type GlbAccessor=Readonly<{
 componentType?:number;count?:number;type?:string
 bufferView?:number;byteOffset?:number;sparse?:unknown
}>
type GlbBufferView=Readonly<{
 buffer?:number;byteOffset?:number;byteLength?:number;byteStride?:number
}>
type GlbStructure=Readonly<{
 asset?:{version?:string}
 meshes?:readonly {
  primitives?:readonly {
   mode?:number;indices?:number;attributes?:{POSITION?:number}
  }[]
 }[]
 buffers?:readonly {byteLength?:number;uri?:string}[]
 accessors?:readonly GlbAccessor[]
 bufferViews?:readonly GlbBufferView[]
}>
const validIndex=(value:unknown,limit:number):value is number=>
 Number.isSafeInteger(value)&&Number(value)>=0&&Number(value)<limit
export function inspectStudioGlbTopology(bytes:ArrayBuffer):StudioTopologyReport{
 if(bytes.byteLength<28||bytes.byteLength>MAX_GLB_BYTES)
  return noReport('glb_size_out_of_range')
 const view=new DataView(bytes)
 if(view.getUint32(0,true)!==0x46546c67||
  view.getUint32(4,true)!==2||
  view.getUint32(8,true)!==bytes.byteLength||
  view.getUint32(16,true)!==0x4e4f534a)
  return noReport('glb_header_invalid')
 const n=view.getUint32(12,true),binHeader=20+n
 if(n<16||n%4||binHeader+8>bytes.byteLength||
  view.getUint32(binHeader+4,true)!==0x004e4942)
  return noReport('glb_chunk_invalid')
 const length=view.getUint32(binHeader,true)
 if(length%4||binHeader+8+length>bytes.byteLength)
  return noReport('glb_bin_invalid')
 let doc:GlbStructure
 try{
  doc=JSON.parse(new TextDecoder('utf-8',{fatal:true})
   .decode(new Uint8Array(bytes,20,n))) as GlbStructure
 }catch{return noReport('glb_json_invalid')}
 const accessors=doc.accessors??[],views=doc.bufferViews??[],
       primitives=(doc.meshes??[]).flatMap(m=>m.primitives??[])
 if(doc.asset?.version!=='2.0'||doc.buffers?.length!==1||
    doc.buffers[0].uri||!primitives.length||
    primitives.length>MAX_PRIMITIVES)
  return noReport('unsupported_glb_structure')
 const bufferLength=doc.buffers[0].byteLength??0
 if(!Number.isSafeInteger(bufferLength)||bufferLength<0||
    bufferLength>length)
  return noReport('glb_buffer_length_invalid')
 let triangles=0,edges=0,boundaryEdges=0,nonManifoldEdges=0,
     degenerateIndexTriangles=0,checkedPrimitives=0
 for(const primitive of primitives){
  const indexId=primitive.indices
  const positionId=primitive.attributes?.POSITION
  if((primitive.mode??4)!==4||!validIndex(indexId,accessors.length)||
    !validIndex(positionId,accessors.length))
   return noReport('unsupported_nonindexed_or_nonstriangle_primitive')
  const accessor=accessors[indexId]
  const positionAccessor=accessors[positionId]
  const count=accessor.count
  const vertices=positionAccessor.count
  if(accessor.type!=='SCALAR')
   return noReport('unsupported_index_type')
  if(![5121,5123,5125].includes(accessor.componentType??0))
   return noReport('unsupported_index_component')
  if(accessor.sparse!==undefined)
   return noReport('unsupported_sparse_indices')
  if(!validIndex(accessor.bufferView,views.length))
   return noReport('invalid_index_buffer_view')
  if(!Number.isSafeInteger(count)||count!<3||count!%3)
   return noReport('invalid_index_count')
  if(!Number.isSafeInteger(vertices)||vertices!<3)
   return noReport('invalid_position_count')
  const nTriangles=count!/3
  if(triangles+nTriangles>MAX_TRIANGLES)
   return noReport('topology_scan_triangle_limit')
  const source=views[accessor.bufferView!]
  const size=accessor.componentType===5125?4:
   accessor.componentType===5123?2:1
  const offset=(source.byteOffset??0)+(accessor.byteOffset??0)
  if(source.buffer!==0||
    !Number.isSafeInteger(offset)||offset<0||
    !Number.isSafeInteger(source.byteLength)||source.byteLength!<=0||
    source.byteStride!==undefined||
    !Number.isSafeInteger(accessor.byteOffset??0)||
    (accessor.byteOffset??0)+count!*size>source.byteLength!||
    offset+count!*size>bufferLength||
    offset%size)
   return noReport('unsupported_index_buffer_view')
  const absolute=binHeader+8+offset
  const indexAt=(i:number):number=>
   size===4?view.getUint32(absolute+i*size,true):
   size===2?view.getUint16(absolute+i*size,true):
   view.getUint8(absolute+i*size)
  const incidences=new Map<string,number>()
  const add=(a:number,b:number)=>{
   const key=(a<b?a+':'+b:b+':'+a)
   incidences.set(key,(incidences.get(key)??0)+1)
  }
  for(let i=0;i<count!;i+=3){
   const a=indexAt(i),b=indexAt(i+1),c=indexAt(i+2)
   if(a>=vertices!||b>=vertices!||c>=vertices!)
    return noReport('invalid_vertex_index')
   if(a===b||a===c||b===c){degenerateIndexTriangles++;continue}
   add(a,b);add(b,c);add(c,a)
  }
  triangles+=nTriangles;checkedPrimitives++
  edges+=incidences.size
  for(const incident of incidences.values()){
   if(incident===1)boundaryEdges++
   else if(incident>2)nonManifoldEdges++
  }
 }
 return {status:'checked',triangles,edges,boundaryEdges,
  nonManifoldEdges,degenerateIndexTriangles,checkedPrimitives,
  publishReady:false}
}
