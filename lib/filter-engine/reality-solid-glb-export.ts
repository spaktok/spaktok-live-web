import * as THREE from 'three'

/** glTF has no wireframe material equivalent for solid surface geometry.
 * Three.js GLTFExporter interprets material.wireframe=true by emitting a
 * GL_LINES primitive (mode 1) instead of triangles (mode 4). The studio's
 * diagnostic wire overlay must NEVER modify the authored GLB topology.
 */
export function createSolidExportMesh(source:THREE.Mesh){
  const materials=Array.isArray(source.material)?source.material:[source.material]
  const owned=materials.map(material=>{
    const copy=material.clone()
    if('wireframe' in copy)(copy as THREE.Material & {wireframe:boolean}).wireframe=false
    return copy
  })
  const mesh=source.clone(false) as THREE.Mesh
  mesh.material=Array.isArray(source.material)?owned:owned[0]
  return {
    mesh,
    dispose:()=>{for(const material of owned)material.dispose()},
  }
}

/** Checks exported bytes rather than assuming Three.js respected our setting.
 * Default GLTF primitive mode is 4 (TRIANGLES). A LINES export cannot be
 * used as a phototextured face effect, even when it has normal/UV accessors.
 */
export function assertSolidGlb(data:ArrayBuffer){
  if(data.byteLength<28)throw Error('reality_export_invalid_glb')
  const dv=new DataView(data)
  if(dv.getUint32(0,true)!==0x46546c67||
     dv.getUint32(4,true)!==2||dv.getUint32(8,true)!==data.byteLength||
     dv.getUint32(16,true)!==0x4e4f534a)
    throw Error('reality_export_invalid_glb')
  const jsonLength=dv.getUint32(12,true)
  if(jsonLength<2||jsonLength>data.byteLength-20)
    throw Error('reality_export_invalid_glb')
  let gltf:{meshes?:Array<{primitives:Array<{mode?:number;indices?:number}>}>;accessors?:Array<{count?:number}>}
  try{
    gltf=JSON.parse(new TextDecoder().decode(
      new Uint8Array(data,20,jsonLength)))
  }catch{throw Error('reality_export_invalid_glb')}
  const primitives=gltf.meshes?.flatMap(mesh=>mesh.primitives)??[]
  if(primitives.length===0)throw Error('reality_export_no_geometry')
  for(const prim of primitives){
    if((prim.mode??4)!==4)throw Error('reality_export_not_triangles')
    if(prim.indices!==undefined){
      const count=gltf.accessors?.[prim.indices]?.count
      if(typeof count!=='number'||!Number.isSafeInteger(count)||count<3||count%3!==0)
        throw Error('reality_export_invalid_indices')
    }
  }
}
