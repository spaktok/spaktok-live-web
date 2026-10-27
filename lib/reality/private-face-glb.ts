export const PRIVATE_FACE_MAX_BYTES=12*1024*1024

/** Validate untrusted binary before storage. Embedding a Pngtree asset does
 * not prove a redistribution license: drafts remain owner-private.
 */
export function validatePrivateFaceGlb(buffer:ArrayBuffer){
 if(buffer.byteLength<64||buffer.byteLength>PRIVATE_FACE_MAX_BYTES)
  throw Error('private_face_bad_file_size')
 const dv=new DataView(buffer)
 if(dv.getUint32(0,true)!==0x46546c67||
    dv.getUint32(4,true)!==2||
    dv.getUint32(8,true)!==buffer.byteLength||
    dv.getUint32(16,true)!==0x4e4f534a)
  throw Error('private_face_invalid_glb')
 const len=dv.getUint32(12,true)
 if(len<16||len>buffer.byteLength-20)throw Error('private_face_invalid_json')
 let gltf:unknown
 try{gltf=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,len)))}
 catch{throw Error('private_face_invalid_json')}
 if(!gltf||typeof gltf!=='object')throw Error('private_face_invalid_gltf')
 const g=gltf as {
  buffers?:{uri?:string}[];images?:{uri?:string}[];extensionsRequired?:string[];
  accessors?:{count?:number}[];
  meshes?:{primitives?:{mode?:number;indices?:number;attributes?:{POSITION?:number;TEXCOORD_0?:number}}[]}[]
 }
 const mesh=g.meshes?.[0]?.primitives?.[0],accessors=g.accessors??[]
 if(g.meshes?.length!==1||g.meshes[0]?.primitives?.length!==1||
  !mesh||(mesh.mode??4)!==4||
  accessors[mesh.attributes?.POSITION??-1]?.count!==468||
  accessors[mesh.attributes?.TEXCOORD_0??-1]?.count!==468||
  accessors[mesh.indices??-1]?.count!==2694||
  g.images?.length!==1||
  g.buffers?.some(b=>b.uri&&!b.uri.startsWith('data:'))||
  g.images.some(x=>x.uri&&!x.uri.startsWith('data:'))||
  (g.extensionsRequired?.length??0)>0)
  throw Error('private_face_bad_topology')
}
