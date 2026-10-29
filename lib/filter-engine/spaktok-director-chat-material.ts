'use client'
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js'
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js'
import * as THREE from 'three'
import {inspectWordGeneratedGlb} from './spaktok-word-import'

export type DirectorMaterialStyle=Readonly<{
 id:'gold'|'silver'|'red'|'blue'|'green'|'purple'|'black'|'white'
 color:number;metallic:number;roughness:number;label:string
}>
const STYLES:Readonly<Record<DirectorMaterialStyle['id'],DirectorMaterialStyle>>={
 gold:{id:'gold',color:0xd5aa45,metallic:.8,roughness:.26,label:'ذهبي معدني'},
 silver:{id:'silver',color:0xcbd5e1,metallic:.82,roughness:.25,label:'فضي معدني'},
 red:{id:'red',color:0xe64a4a,metallic:.12,roughness:.45,label:'أحمر'},
 blue:{id:'blue',color:0x3974ed,metallic:.12,roughness:.44,label:'أزرق'},
 green:{id:'green',color:0x3bbb84,metallic:.08,roughness:.55,label:'أخضر'},
 purple:{id:'purple',color:0x9056dc,metallic:.15,roughness:.43,label:'بنفسجي'},
 black:{id:'black',color:0x20232d,metallic:.2,roughness:.55,label:'أسود'},
 white:{id:'white',color:0xf5f7fc,metallic:.05,roughness:.58,label:'أبيض'},
}
const RULES:readonly [RegExp,DirectorMaterialStyle['id']][]=[
 [/ذهبي|ذهبية|ذهبية|\bgold\b|\bgolden\b/i,'gold'],
 [/فضي|فضية|\bsilver\b/i,'silver'],
 [/أحمر|احمر|حمراء|حمراء|\bred\b/i,'red'],
 [/أزرق|ازرق|زرقاء|\bblue\b/i,'blue'],
 [/أخضر|اخضر|خضراء|\bgreen\b/i,'green'],
 [/بنفسجي|بنفسجية|أرجواني|\bpurple\b|\bviolet\b/i,'purple'],
 [/أسود|اسود|سوداء|\bblack\b/i,'black'],
 [/أبيض|ابيض|بيضاء|\bwhite\b/i,'white'],
]
export function detectDirectorMaterialStyle(prompt:string):
 DirectorMaterialStyle|null{
 if(!/(غيّر|غير|بدّل|بدل|لوّن|لون|اجعل|خليه|خلّي|حوّل|حول|paint|recolor|make|color|colour|material|خامة)/i.test(prompt))
  return null
 for(const [test,key] of RULES)if(test.test(prompt))return STYLES[key]
 return null
}
/** A REAL private operation on an existing STATIC GLB: tint material and
 * change metal/roughness, preserving self-contained textures and geometry.
 * Not a text-to-3D model, skeletal rig, or generative texture replacement.
 */
export async function styleDirectorGlb(
 original:File,style:DirectorMaterialStyle,
):Promise<File>{
 if(!/\.glb$/i.test(original.name)||original.size<28||
    original.size>15*1024*1024)
  throw Error('director_material_requires_safe_glb')
 const bytes=await original.arrayBuffer()
 const checked=inspectWordGeneratedGlb(bytes,original.name)
 if(!checked.audit.valid||!checked.audit.selfContained||
    checked.audit.skins>0||checked.audit.animations>0||
    checked.audit.rigTargets>0)
  throw Error('director_material_requires_static_unrigged_glb')
 const gltf=await new GLTFLoader().parseAsync(bytes,'')
 let changed=0
 gltf.scene.traverse(node=>{
  if(!(node instanceof THREE.Mesh))return
  for(const material of Array.isArray(node.material)?node.material:[node.material]){
   if(!(material instanceof THREE.MeshStandardMaterial))continue
   material.color.setHex(style.color)
   material.metalness=style.metallic
   material.roughness=style.roughness
   material.needsUpdate=true
   changed+=1
  }
 })
 if(!changed)throw Error('director_material_no_pbr_surface')
 const output=await new GLTFExporter().parseAsync(gltf.scene,{
  binary:true,onlyVisible:true,maxTextureSize:1024,
 })
 if(!(output instanceof ArrayBuffer))throw Error('director_material_export_failed')
 const name='spaktok-director-'+style.id+'.glb'
 const verified=inspectWordGeneratedGlb(output,name)
 if(!verified.audit.valid||!verified.audit.selfContained||
    verified.audit.triangles!==checked.audit.triangles||
    verified.audit.textures<checked.audit.textures||
    !verified.audit.hasUV||!verified.audit.hasNormals||
    !verified.audit.hasPBR||output.byteLength>15*1024*1024)
  throw Error('director_material_output_qa_failed')
 return new File([output],name,{type:'model/gltf-binary'})
}
