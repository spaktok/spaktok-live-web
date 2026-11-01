import * as THREE from 'three'

/**
 * Royal Crown 01: operator-owned image-derived crown color variants.
 * Exact material slot names are assigned during GLB QA/retopology.
 * Does NOT replace the user's mesh, simulate the unbuilt model, or alter
 * other face filters. The original prism colors are preserved by the
 * neutral gem tint in 'royal-rainbow'.
 */
export const ROYAL_CROWN_01_SLOTS=[
 'metal_base','gem_main_center','gem_secondary','diamond_small','sparkle_layer',
] as const

export type RoyalCrown01Slot=(typeof ROYAL_CROWN_01_SLOTS)[number]
export const ROYAL_CROWN_01_PRESETS={
 'royal-rainbow': {title:'Royal Rainbow',metal:'#E9A72B',main:'#FFFFFF',secondary:'#FFFFFF',diamonds:'#EFFBFF'},
 'rose-princess': {title:'Rose Princess',metal:'#D899A2',main:'#F8A7E9',secondary:'#F9D6FF',diamonds:'#FFF7FA'},
 'ice-queen': {title:'Ice Queen',metal:'#CFDEE9',main:'#96DAFF',secondary:'#D1EFFF',diamonds:'#F4FDFF'},
 'sapphire': {title:'Sapphire Blue',metal:'#E8B437',main:'#1E5CD8',secondary:'#53B7FD',diamonds:'#E0F4FF'},
 'emerald': {title:'Emerald',metal:'#E2AC2B',main:'#20AD7A',secondary:'#63E4BA',diamonds:'#E1FFF5'},
 'ruby': {title:'Ruby',metal:'#E4AC2D',main:'#C92051',secondary:'#FA6580',diamonds:'#FFF1F4'},
 'amethyst': {title:'Amethyst',metal:'#D5D2EB',main:'#8F46CC',secondary:'#C99BFF',diamonds:'#F8F0FF'},
 'dark-luxury': {title:'Dark Luxury',metal:'#383032',main:'#7136B1',secondary:'#9F70E6',diamonds:'#D1C3E9'},
} as const

export type RoyalCrown01PresetId=keyof typeof ROYAL_CROWN_01_PRESETS

// Per-mesh ownership: applying a preset never changes a material shared with
// an unrelated object, and subsequent selections do not leak GPU materials.
const ownedMaterial=new WeakMap<THREE.Mesh,THREE.MeshStandardMaterial>()
const slots=new Set<string>(ROYAL_CROWN_01_SLOTS)

function findSlot(mesh:THREE.Mesh):RoyalCrown01Slot|null{
 if(slots.has(mesh.name))return mesh.name as RoyalCrown01Slot
 const material=mesh.material
 if(!Array.isArray(material)&&material&&slots.has(material.name))
  return material.name as RoyalCrown01Slot
 return null
}

function materialForInspection(mesh:THREE.Mesh):boolean{
 return !Array.isArray(mesh.material)&&mesh.material instanceof THREE.MeshStandardMaterial
}

function materialFor(mesh:THREE.Mesh):THREE.MeshStandardMaterial|null{
 const earlier=ownedMaterial.get(mesh)
 if(earlier)return earlier
 const material=mesh.material
 if(Array.isArray(material)||!(material instanceof THREE.MeshStandardMaterial))
  return null
 const personal=material.clone()
 personal.name=material.name
 ownedMaterial.set(mesh,personal)
 mesh.material=personal
 return personal
}

function setSlot(mat:THREE.MeshStandardMaterial,slot:RoyalCrown01Slot,
                 preset:typeof ROYAL_CROWN_01_PRESETS[RoyalCrown01PresetId]):void{
 if(slot==='metal_base'){
  mat.color.set(preset.metal)
  mat.metalness=.92;mat.roughness=.18
  if(mat instanceof THREE.MeshPhysicalMaterial){mat.clearcoat=.45;mat.clearcoatRoughness=.16}
 }else if(slot==='gem_main_center'||slot==='gem_secondary'||slot==='diamond_small'){
  mat.color.set(slot==='gem_main_center'?preset.main:
                slot==='gem_secondary'?preset.secondary:preset.diamonds)
  mat.metalness=.02;mat.roughness=.08
  if(mat instanceof THREE.MeshPhysicalMaterial){
   mat.clearcoat=.92
   mat.clearcoatRoughness=.06
   mat.iridescence=slot==='gem_main_center'?.65:.32
   mat.iridescenceIOR=1.34
   // Avoid expensive real refraction in the Live mobile preview.
   mat.transmission=0
  }
 }else{
  mat.color.set(preset.diamonds)
  mat.metalness=0;mat.roughness=.19
  mat.emissive.set(preset.diamonds)
  mat.emissiveIntensity=.26
 }
 mat.needsUpdate=true
}

export function applyRoyalCrown01Palette(root:THREE.Object3D,
   presetId:RoyalCrown01PresetId):{
     preset:RoyalCrown01PresetId,updatedMeshes:number,
     slotsFound:RoyalCrown01Slot[],missingSlots:RoyalCrown01Slot[]
   }{
 const preset=ROYAL_CROWN_01_PRESETS[presetId]
 if(!preset)throw Error('unknown_royal_crown_01_preset')
 // Do not partially recolor a one-material TRELLIS.2 mesh.
 // The owner's first crown GLB currently has ONE PBR material; all five
 // distinct metal/gem material zones must pass QA before colors can vary.
 const verifiedZones=new Set<RoyalCrown01Slot>()
 root.traverse(o=>{
  if(!(o instanceof THREE.Mesh))return
  const zone=findSlot(o)
  if(zone&&materialForInspection(o))verifiedZones.add(zone)
 })
 const missing=ROYAL_CROWN_01_SLOTS.filter(zone=>!verifiedZones.has(zone))
 if(missing.length)return {preset:presetId,updatedMeshes:0,
  slotsFound:[...verifiedZones],missingSlots:missing}
 const found=new Set<RoyalCrown01Slot>()
 let updated=0
 root.traverse(o=>{
  if(!(o instanceof THREE.Mesh))return
  const slot=findSlot(o)
  if(!slot)return
  const material=materialFor(o)
  if(!material)return
  setSlot(material,slot,preset)
  found.add(slot);updated++
 })
 return {preset:presetId,updatedMeshes:updated,
  slotsFound:[...found],missingSlots:ROYAL_CROWN_01_SLOTS.filter(x=>!found.has(x))}
}
