import * as THREE from 'three'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js'
import {
 auditStudioGlbBytes,type StudioGlbAudit,
} from './reality-production-glb-audit'

/** Creates a NEW local GLB with missing vertex normals computed from faces.
 * For safety, this limited repair rejects skins, animation clips and
 * morph-target meshes rather than silently altering their deformation data.
 * It does not infer high-quality artistic normals, correct flipped faces,
 * retopologize geometry or supply missing face rig channels.
 */
export type ForgeNormalsRepair=Readonly<{
 bytes:ArrayBuffer
 before:StudioGlbAudit
 after:StudioGlbAudit
 repairedMeshes:number
 alreadyComplete:boolean
}>
export async function repairForgeGlbNormals(
 original:ArrayBuffer,
):Promise<ForgeNormalsRepair>{
 const before=auditStudioGlbBytes(original)
 if(!before.valid||!before.selfContained)
  throw Error('forge_repair_source_invalid')
 if(before.hasNormals)return {
  bytes:original,before,after:before,
  repairedMeshes:0,alreadyComplete:true,
 }
 if(before.skins>0||before.animations>0||before.rigTargets>0)
  throw Error('forge_repair_animated_or_morphed_asset_requires_blender')
 const parsed=await new GLTFLoader().parseAsync(original,'')
 if(parsed.scenes.length!==1)
  throw Error('forge_repair_multiscene_asset_requires_editor')
 const root=parsed.scene
 const touched=new Map<THREE.BufferGeometry,THREE.BufferGeometry>()
 let repairedMeshes=0
 root.traverse(node=>{
  if(!(node instanceof THREE.Mesh))return
  const geometry=node.geometry
  if(geometry.getAttribute('normal'))return
  if(geometry.morphAttributes.position?.length||
   geometry.morphAttributes.normal?.length)
   throw Error('forge_repair_morph_mesh_requires_editor')
  const position=geometry.getAttribute('position')
  if(!position||position.count<3||position.itemSize!==3)
   throw Error('forge_repair_missing_positions')
  if(geometry.index&&geometry.index.count%3!==0)
   throw Error('forge_repair_invalid_triangle_indices')
  let replacement=touched.get(geometry)
  if(!replacement){
   const created:THREE.BufferGeometry=geometry.clone()
   created.computeVertexNormals()
   const normals=created.getAttribute('normal')
   if(!normals||normals.count!==position.count)
    throw Error('forge_repair_normals_not_computed')
   // Keep zero normals on a truly degenerate triangle from accidentally
   // being reported as healthy. No guessing the direction is possible.
   let nonzero=0
   for(let i=0;i<normals.count;i++){
    const x=normals.getX(i),y=normals.getY(i),z=normals.getZ(i)
    if(!Number.isFinite(x+y+z))
     throw Error('forge_repair_non_finite_normal')
    if(x*x+y*y+z*z>.001)nonzero++
   }
   if(nonzero<Math.max(3,normals.count*.5))
    throw Error('forge_repair_degenerate_surface')
   touched.set(geometry,created)
   replacement=created
  }
  node.geometry=replacement
  repairedMeshes++
 })
 if(!repairedMeshes)
  throw Error('forge_repair_no_missing_mesh_normals')
 const exported=await new GLTFExporter().parseAsync(root,{
  binary:true,onlyVisible:false,embedImages:true,
 })
 if(!(exported instanceof ArrayBuffer))
  throw Error('forge_repair_not_glb')
 const after=auditStudioGlbBytes(exported)
 if(!after.valid||!after.selfContained||!after.hasNormals||
  after.triangles!==before.triangles||
  after.meshCount>before.meshCount+10||
  after.hasUV!==before.hasUV||after.hasPBR!==before.hasPBR||
  after.textures!==before.textures)
  throw Error('forge_repair_failed_roundtrip_qa')
 return {
  bytes:exported,before,after,repairedMeshes,alreadyComplete:false,
 }
}
