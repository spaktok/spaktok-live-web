import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {parseCanonicalOBJ} from './reality-canonical-retarget'

export const LOCAL_PHOTO_FACE_MAX_BYTES=12*1024*1024
export const LOCAL_PHOTO_FACE_ID='3d-photo-face'
type Point3=readonly [number,number,number]
export type CanonicalCheck=Readonly<{meanError:number;maxError:number;vertices:468}>

/** Check VERTEX ID correspondence to canonical 468, not merely the count.
 * Normalization cancels authored centering and per-axis scaling; a reordered
 * mesh, mirrored geometry, or different 468-point topology is rejected.
 */
export function validateCanonicalVertexOrder(
 positions:ArrayLike<number>,canonical:readonly Point3[],
):CanonicalCheck{
 if(positions.length!==468*3||canonical.length!==468)
  throw Error('photo_face_requires_468_canonical_vertices')
 const points=Array.from({length:468},(_,i)=>[
  Number(positions[i*3]),Number(positions[i*3+1]),Number(positions[i*3+2]),
 ] as Point3)
 for(const p of [...points,...canonical])if(!p.every(Number.isFinite))
  throw Error('photo_face_invalid_coordinates')
 const normalized=(items:readonly Point3[])=>{
  const min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity]
  for(const p of items)for(let a=0;a<3;a++){
   min[a]=Math.min(min[a],p[a]);max[a]=Math.max(max[a],p[a])
  }
  const bounds=max.map((x,i)=>x-min[i])
  if(bounds.some(x=>x<1e-6))throw Error('photo_face_invalid_extent')
  return items.map(p=>[(p[0]-min[0])/bounds[0],
   (p[1]-min[1])/bounds[1],(p[2]-min[2])/bounds[2]] as Point3)
 }
 const v=normalized(points),ref=normalized(canonical)
 let total=0,maxError=0
 for(let i=0;i<468;i++){
  const error=Math.hypot(v[i][0]-ref[i][0],v[i][1]-ref[i][1],v[i][2]-ref[i][2])
  total+=error;maxError=Math.max(maxError,error)
 }
 const meanError=total/468
 if(meanError>.018||maxError>.09)throw Error('photo_face_vertex_order_mismatch')
 return {meanError,maxError,vertices:468}
}

/** No network-connected textures or models permitted in local user GLB.
 * JPEG/PNG texture bytes must be embedded in a bufferView/data URI.
 */
export function assertLocalPhotoGlb(buffer:ArrayBuffer):void{
 if(buffer.byteLength<28||buffer.byteLength>LOCAL_PHOTO_FACE_MAX_BYTES)
  throw Error('photo_face_file_size')
 const view=new DataView(buffer)
 if(view.getUint32(0,true)!==0x46546c67||
   view.getUint32(4,true)!==2||
   view.getUint32(8,true)!==buffer.byteLength||
   view.getUint32(16,true)!==0x4e4f534a)
  throw Error('photo_face_invalid_glb')
 const len=view.getUint32(12,true)
 if(len<16||len>buffer.byteLength-20)throw Error('photo_face_invalid_json')
 let gltf:{
  buffers?:{uri?:string}[]
  images?:{uri?:string}[]
  meshes?:{primitives?:{mode?:number}[]}[]
  extensionsUsed?:string[]
 }
 try{gltf=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,len)))}
 catch{throw Error('photo_face_invalid_json')}
 if((gltf.buffers??[]).some(x=>x.uri&&!x.uri.startsWith('data:'))||
   (gltf.images??[]).some(x=>x.uri&&!x.uri.startsWith('data:')))
  throw Error('photo_face_external_resources_forbidden')
 const primitives=gltf.meshes?.flatMap(m=>m.primitives??[])??[]
 if(primitives.length!==1||primitives[0].mode!==undefined&&primitives[0].mode!==4)
  throw Error('photo_face_requires_solid_mesh')
 if((gltf.extensionsUsed??[]).some(x=>!['KHR_materials_unlit','KHR_texture_transform'].includes(x)))
  throw Error('photo_face_unsupported_extensions')
}

/** Local-only, deformable photo-projection test filter. Its vertex positions
 * are driven by the same stabilized FaceLandmarker points as depth and makeup.
 * A photograph alone CANNOT reconstruct unseen sides/hair or 3D facial depth.
 */
export class RealityLivePhotoFace{
 readonly mesh:THREE.Mesh
 private readonly material:THREE.MeshStandardMaterial
 private readonly geometry:THREE.BufferGeometry
 private readonly origin:THREE.Group
 private readonly position:THREE.BufferAttribute
 private constructor(scene:THREE.Scene,geometry:THREE.BufferGeometry,
  material:THREE.MeshStandardMaterial,origin:THREE.Group){
  this.origin=origin
  this.geometry=geometry;this.material=material
  this.position=new THREE.BufferAttribute(new Float32Array(468*3),3)
  this.position.setUsage(THREE.DynamicDrawUsage)
  this.geometry.setAttribute('position',this.position)
  this.mesh=new THREE.Mesh(this.geometry,this.material)
  this.mesh.frustumCulled=false
  this.mesh.renderOrder=5
  this.mesh.visible=false
  scene.add(this.mesh)
 }
 static async load(scene:THREE.Scene,file:File):Promise<RealityLivePhotoFace>{
  if(!/\.glb$/i.test(file.name)||!file.size||file.size>LOCAL_PHOTO_FACE_MAX_BYTES)
   throw Error('photo_face_file_type_or_size')
  const buffer=await file.arrayBuffer()
  assertLocalPhotoGlb(buffer)
  const [gltf,canonicalResponse]=await Promise.all([
   new Promise<THREE.Group>((resolve,reject)=>{
    new GLTFLoader().parse(buffer,'',result=>resolve(result.scene),reject)
   }),
   fetch('/face-assets/mediapipe-canonical-face-468.obj',{cache:'force-cache'}),
  ])
  if(!canonicalResponse.ok)throw Error('photo_face_canonical_reference_unavailable')
  const canonical=parseCanonicalOBJ(await canonicalResponse.text())
  let source:THREE.Mesh|undefined
  gltf.traverse(object=>{
   if(object instanceof THREE.Mesh){
    if(source)throw Error('photo_face_multiple_meshes_not_supported')
    source=object
   }
  })
  if(!source)throw Error('photo_face_missing_mesh')
  const mesh=source as THREE.Mesh
  const positions=mesh.geometry.getAttribute('position')
  if(!positions||mesh.geometry.index?.count!==898*3||
   !mesh.geometry.getAttribute('uv'))
   throw Error('photo_face_incompatible_topology')
  validateCanonicalVertexOrder(positions.array,canonical.vertices)
  const mat=mesh.material
  if(!(mat instanceof THREE.MeshStandardMaterial)||!mat.map)
   throw Error('photo_face_requires_embedded_texture')
  const geometry=mesh.geometry.clone()
  const material=mat.clone()
  material.side=THREE.DoubleSide
  material.transparent=true
  material.depthTest=false
  material.depthWrite=false
  material.roughness=Math.max(.65,material.roughness)
  material.opacity=.90
  return new RealityLivePhotoFace(scene,geometry,material,gltf)
 }
 update(trackedPositions:ArrayLike<number>,visible:boolean,strength:number):void{
  this.mesh.visible=visible
  if(!visible)return
  if(trackedPositions.length<468*3)throw Error('photo_face_tracking_incomplete')
  const target=this.position.array as Float32Array
  for(let i=0;i<468;i++){
   const x=trackedPositions[i*3],y=trackedPositions[i*3+1],z=trackedPositions[i*3+2]
   if(![x,y,z].every(Number.isFinite)){this.mesh.visible=false;return}
   target[i*3]=x
   target[i*3+1]=y
   target[i*3+2]=z+1.8
  }
  this.position.needsUpdate=true
  this.geometry.computeVertexNormals()
  this.material.opacity=Math.min(.96,Math.max(.1,strength))
 }
 dispose(scene:THREE.Scene){
  scene.remove(this.mesh)
  this.geometry.dispose()
  this.material.dispose()
  this.origin.traverse(o=>{
   if(o instanceof THREE.Mesh){
    o.geometry.dispose()
    const list=Array.isArray(o.material)?o.material:[o.material]
    for(const material of list){
     for(const tex of Object.values(material))if(tex instanceof THREE.Texture)tex.dispose()
     material.dispose()
    }
   }
  })
 }
}
