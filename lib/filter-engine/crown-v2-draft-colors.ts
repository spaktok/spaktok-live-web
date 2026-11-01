import * as THREE from 'three'
import {ROYAL_CROWN_01_PRESETS,type RoyalCrown01PresetId} from './crown-royal-01-palette'

export type CrownV2ColorPresetId=RoyalCrown01PresetId
export const CROWN_V2_COLOR_PRESETS=ROYAL_CROWN_01_PRESETS

/** Only visual QA tints. The original PNG map stays unmodified in every GLB.
 * These six grid-derived regions have NOT passed fine gemstone segmentation.
 */
const ZONES=['metal_base','gem_main_center','gem_secondary','diamond_small',
 'sparkle_layer','gold_backing_headband'] as const
type Zone=(typeof ZONES)[number]
type Tintable=THREE.MeshBasicMaterial|THREE.MeshStandardMaterial

const owned=new WeakMap<THREE.Mesh,Tintable>()
const originalColors=new WeakMap<THREE.Mesh,THREE.Color>()
function tintable(value:THREE.Material):value is Tintable{
 return value instanceof THREE.MeshBasicMaterial||value instanceof THREE.MeshStandardMaterial
}
function materialFor(mesh:THREE.Mesh):Tintable|null{
 const prev=owned.get(mesh)
 if(prev)return prev
 if(Array.isArray(mesh.material)||!tintable(mesh.material))return null
 const clone=mesh.material.clone() as Tintable
 originalColors.set(mesh,clone.color.clone())
 mesh.material=clone
 owned.set(mesh,clone)
 return clone
}
export function applyCrownV2DraftColors(root:THREE.Object3D,id:CrownV2ColorPresetId):{
 applied:boolean,updatedMeshes:number,missing:string[],experimental:true
}{
 const palette=CROWN_V2_COLOR_PRESETS[id]
 if(!palette)throw Error('crown_v2_unknown_preset')
 const found=new Set<Zone>()
 root.traverse(o=>{
  if(!(o instanceof THREE.Mesh)||Array.isArray(o.material))return
  const zone=o.material.name
  if((ZONES as readonly string[]).includes(zone)&&tintable(o.material))found.add(zone as Zone)
 })
 const missing=ZONES.filter(z=>!found.has(z))
 if(missing.length)return {applied:false,updatedMeshes:0,missing,experimental:true}
 let updated=0
 root.traverse(o=>{
  if(!(o instanceof THREE.Mesh)||Array.isArray(o.material))return
  const zone=o.material.name as Zone
  if(!found.has(zone))return
  const mat=materialFor(o)
  if(!mat)return
  // Neutral rainbow mode leaves original source PNG colors exactly intact.
  // Other presets blend toward target color while preserving the source map.
  const hex=zone==='metal_base'||zone==='gold_backing_headband'?palette.metal:
   zone==='gem_main_center'?palette.main:
   zone==='gem_secondary'?palette.secondary:palette.diamonds
  const base=originalColors.get(o)??new THREE.Color('#ffffff')
  const color=id==='royal-rainbow'?base.clone():
   base.clone().lerp(new THREE.Color(hex),zone==='gold_backing_headband'?.64:.56)
  mat.color.copy(color)
  mat.needsUpdate=true
  updated++
 })
 return {applied:true,updatedMeshes:updated,missing:[],experimental:true}
}
