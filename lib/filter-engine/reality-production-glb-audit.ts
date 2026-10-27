/** Non-executing glTF 2.0 / GLB structural audit, before any renderer parsing.
 * This counts true indexed triangles and flags material/UV/rig limitations.
 * A valid GLB is not automatically art-approved or licensed.
 */
export const STUDIO_GLB_AUDIT_MAX_BYTES=35*1024*1024
type Accessor={count?:number;type?:string;componentType?:number;bufferView?:number}
type BufferView={buffer?:number;byteOffset?:number;byteLength?:number}
type Primitive={mode?:number;indices?:number;attributes?:Record<string,number>;
 material?:number;targets?:Array<Record<string,number>>}
type Mesh={primitives?:Primitive[];extras?:{targetNames?:string[]}}
type Image={uri?:string;bufferView?:number;mimeType?:string}
type GLTF={
 asset?:{version?:string}
 buffers?:Array<{byteLength?:number;uri?:string}>
 bufferViews?:BufferView[]
 accessors?:Accessor[];meshes?:Mesh[]
 materials?:Array<{pbrMetallicRoughness?:unknown;normalTexture?:unknown;
  occlusionTexture?:unknown;emissiveTexture?:unknown;extensions?:object}>
 textures?:unknown[];images?:Image[]
 skins?:unknown[];animations?:unknown[];nodes?:unknown[]
 extensionsRequired?:string[]
}
export type StudioGlbAudit=Readonly<{
 valid:boolean;selfContained:boolean
 triangles:number;materials:number;meshCount:number;primitives:number
 textures:number;hasUV:boolean;hasNormals:boolean;hasPBR:boolean
 rigTargets:number;animations:number;skins:number
 requiredExtensions:readonly string[]
 warnings:readonly string[]
}>
const empty=():StudioGlbAudit=>({
 valid:false,selfContained:false,triangles:0,materials:0,meshCount:0,
 primitives:0,textures:0,hasUV:false,hasNormals:false,hasPBR:false,
 rigTargets:0,animations:0,skins:0,requiredExtensions:[],warnings:[],
})
const indexValid=(i:number|undefined,length:number)=>
 Number.isSafeInteger(i)&&i!==undefined&&i>=0&&i<length
export function auditStudioGlbBytes(buffer:ArrayBuffer):StudioGlbAudit{
 if(buffer.byteLength<28||buffer.byteLength>STUDIO_GLB_AUDIT_MAX_BYTES)
  throw Error('studio_glb_invalid_size')
 const view=new DataView(buffer)
 if(view.getUint32(0,true)!==0x46546c67||
    view.getUint32(4,true)!==2||view.getUint32(8,true)!==buffer.byteLength||
    view.getUint32(16,true)!==0x4e4f534a)
  throw Error('studio_glb_invalid_header')
 const length=view.getUint32(12,true)
 if(length<16||length>buffer.byteLength-20||length%4!==0)
  throw Error('studio_glb_invalid_json_chunk')
 let data:GLTF
 try{data=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(
  new Uint8Array(buffer,20,length))) as GLTF}
 catch{throw Error('studio_glb_corrupt_json')}
 if(data.asset?.version!=='2.0')throw Error('studio_glb_wrong_version')
 const warnings:string[]=[]
 // GLB must carry the actual typed vertex data, not just unbacked
 // JSON declarations that happen to claim many triangles.
 const binOffset=20+length
 const hasBin=binOffset+8<=buffer.byteLength&&
  view.getUint32(binOffset+4,true)===0x004e4942
 const binLength=hasBin?view.getUint32(binOffset,true):0
 if(hasBin&&(binOffset+8+binLength>buffer.byteLength||
  binLength%4!==0))throw Error('studio_glb_invalid_bin_chunk')
 const buffers=data.buffers??[]
 const views=data.bufferViews??[]
 const validViews=buffers.length===1&&
  Number.isSafeInteger(buffers[0]?.byteLength)&&
  (buffers[0].byteLength??0)>0&&hasBin&&
  binLength>=(buffers[0].byteLength??0)&&
  views.every(v=>{
   const offset=v.byteOffset??0
   return v.buffer===0&&Number.isSafeInteger(offset)&&offset>=0&&
    Number.isSafeInteger(v.byteLength)&&v.byteLength!>0&&
    offset+v.byteLength!<=buffers[0].byteLength!
  })
 if(!validViews)warnings.push('missing_or_invalid_embedded_geometry')
 const primitives=data.meshes?.flatMap(mesh=>mesh.primitives??[])??[]
 if(!primitives.length)warnings.push('empty_geometry')
 const accessors=data.accessors??[]
 const materials=data.materials??[]
 let triangles=0,uvCount=0,normalCount=0,modeProblems=0
 for(const primitive of primitives){
  if((primitive.mode??4)!==4){modeProblems++;continue}
  const positionIndex=primitive.attributes?.POSITION
  if(!indexValid(positionIndex,accessors.length))
   throw Error('studio_glb_missing_positions')
  const position=accessors[positionIndex!]
  const vertCount=position.count
  if(!indexValid(position.bufferView,views.length)||position.type!=='VEC3'||
   position.componentType!==5126)
   warnings.push('unsupported_or_unbacked_position_accessor')
  if(!Number.isSafeInteger(vertCount)||vertCount!<3)
   throw Error('studio_glb_bad_vertex_count')
  let count=vertCount!
  if(primitive.indices!==undefined){
   if(!indexValid(primitive.indices,accessors.length))
    throw Error('studio_glb_bad_indices')
   const idx=accessors[primitive.indices]
   if(!indexValid(idx.bufferView,views.length)||
    ![5121,5123,5125].includes(idx.componentType??0))
    warnings.push('unsupported_or_unbacked_indices')
   count=idx.count!
  }
  if(!Number.isSafeInteger(count)||count<3||count%3!==0)
   throw Error('studio_glb_triangle_indices_invalid')
  triangles+=count/3
  if(indexValid(primitive.attributes?.TEXCOORD_0,accessors.length))uvCount++
  if(indexValid(primitive.attributes?.NORMAL,accessors.length))normalCount++
  if(primitive.material!==undefined&&!indexValid(primitive.material,materials.length))
   throw Error('studio_glb_invalid_material')
 }
 if(modeProblems)warnings.push('non_triangle_primitives')
 if(triangles>150000)warnings.push('mobile_triangle_budget_review')
 const allTriangle=modeProblems===0&&primitives.length>0
 const hasUV=uvCount===primitives.length
 const hasNormals=normalCount===primitives.length
 if(!hasUV)warnings.push('uv0_missing_on_some_meshes')
 if(!hasNormals)warnings.push('normals_missing_on_some_meshes')
 const hasPBR=materials.length>0&&materials.every(m=>m.pbrMetallicRoughness!==undefined)
 if(!hasPBR)warnings.push('pbr_missing_or_default')
 const images=data.images??[]
 const uriSafe=(u:string|undefined)=>!u||u.startsWith('data:')
 const selfContained=(data.buffers??[]).every(b=>uriSafe(b.uri))&&
  images.every(i=>uriSafe(i.uri)&&(i.uri!==undefined||i.bufferView!==undefined))
 if(!selfContained)warnings.push('external_buffers_or_images')
 const requiredExtensions=data.extensionsRequired??[]
 const supported=['KHR_materials_unlit','KHR_materials_clearcoat',
  'KHR_materials_transmission','KHR_materials_sheen',
  'KHR_materials_specular','KHR_materials_ior','KHR_materials_emissive_strength',
  'KHR_texture_transform','KHR_mesh_quantization']
 const unexpected=requiredExtensions.filter(e=>!supported.includes(e))
 if(unexpected.length)warnings.push('unverified_required_extensions')
 const targetCount=(data.meshes??[]).reduce((sum,mesh)=>{
  let max=0
  for(const p of mesh.primitives??[])max=Math.max(max,p.targets?.length??0)
  return sum+max
 },0)
 if(!targetCount)warnings.push('morph_targets_missing')
 if(images.length>12)warnings.push('mobile_texture_budget_review')
 const valid=allTriangle&&triangles>0&&triangles<=2_000_000&&
  validViews&&!warnings.includes('unsupported_or_unbacked_indices')&&
  !warnings.includes('unsupported_or_unbacked_position_accessor')&&
  selfContained&&unexpected.length===0
 return {
  ...empty(),valid,selfContained,triangles,materials:materials.length,
  meshCount:data.meshes?.length??0,primitives:primitives.length,
  textures:images.length,hasUV,hasNormals,hasPBR,
  rigTargets:targetCount,animations:data.animations?.length??0,
  skins:data.skins?.length??0,requiredExtensions,warnings,
 }
}
