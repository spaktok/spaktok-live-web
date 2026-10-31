/** Mirror of the private studio-assets Worker GLB gate, checked in Next
 * BEFORE reserving a D1 draft so a forge result the Worker would reject
 * (too dense, external URIs, no PBR texture) fails fast with a clear reason.
 */
export const FORGE_LIBRARY_MAX_BYTES=15*1024*1024
export const FORGE_LIBRARY_MAX_TRIANGLES=150000
export const FORGE_LIBRARY_TARGETS=['avatar','live','filter','gift','world'] as const

export type ForgeLibraryCheck=
 |{ok:true;triangles:number}
 |{ok:false;error:'glb_size'|'glb_header'|'glb_json'|'glb_external_uri'|
   'glb_no_pbr_texture'|'glb_bad_primitive'|'glb_missing_uv_or_normals'|
   'glb_too_dense'|'glb_extensions_required'}

export function checkForgeLibraryGlb(bytes:Uint8Array):ForgeLibraryCheck{
 if(bytes.byteLength<128||bytes.byteLength>FORGE_LIBRARY_MAX_BYTES)
  return {ok:false,error:'glb_size'}
 const v=new DataView(bytes.buffer,bytes.byteOffset,bytes.byteLength)
 if(v.getUint32(0,true)!==0x46546c67||v.getUint32(4,true)!==2||
    v.getUint32(8,true)!==bytes.byteLength||v.getUint32(16,true)!==0x4e4f534a)
  return {ok:false,error:'glb_header'}
 const size=v.getUint32(12,true)
 if(size<20||size>bytes.byteLength-20)return {ok:false,error:'glb_header'}
 let doc:Record<string,any>
 try{
  doc=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes.subarray(20,20+size)))
 }catch{return {ok:false,error:'glb_json'}}
 if(doc?.asset?.version!=='2.0'||!Array.isArray(doc.meshes)||!doc.meshes.length||
    !Array.isArray(doc.accessors))return {ok:false,error:'glb_json'}
 if((doc.extensionsRequired||[]).length>0)return {ok:false,error:'glb_extensions_required'}
 const external=(list:unknown)=>Array.isArray(list)&&
  list.some(x=>x&&typeof x.uri==='string'&&!x.uri.startsWith('data:'))
 if(external(doc.buffers)||external(doc.images))return {ok:false,error:'glb_external_uri'}
 if(!(doc.materials||[]).some((m:any)=>m?.pbrMetallicRoughness)||!(doc.images||[]).length)
  return {ok:false,error:'glb_no_pbr_texture'}
 let triangles=0,uv=false,normals=false
 for(const mesh of doc.meshes){
  for(const p of mesh?.primitives||[]){
   if((p.mode??4)!==4)continue
   if(!Number.isInteger(p.indices))return {ok:false,error:'glb_bad_primitive'}
   const accessor=doc.accessors[p.indices]
   if(!accessor||!Number.isInteger(accessor.count))return {ok:false,error:'glb_bad_primitive'}
   triangles+=Math.floor(accessor.count/3)
   uv=uv||Number.isInteger(p.attributes?.TEXCOORD_0)
   normals=normals||Number.isInteger(p.attributes?.NORMAL)
  }
 }
 if(!uv||!normals||triangles<1)return {ok:false,error:'glb_missing_uv_or_normals'}
 if(triangles>FORGE_LIBRARY_MAX_TRIANGLES)return {ok:false,error:'glb_too_dense'}
 return {ok:true,triangles}
}
