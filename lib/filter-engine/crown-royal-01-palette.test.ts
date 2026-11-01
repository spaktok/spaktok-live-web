import {describe,it,expect} from 'bun:test'
import * as THREE from 'three'
import {
 ROYAL_CROWN_01_PRESETS,ROYAL_CROWN_01_SLOTS,
 applyRoyalCrown01Palette,
} from './crown-royal-01-palette'

function fixture(){
 const root=new THREE.Group()
 const other=new THREE.Mesh(
  new THREE.BoxGeometry(1,1,1),
  new THREE.MeshStandardMaterial({color:0x112233}))
 other.name='other-prop'
 root.add(other)
 for(const name of ROYAL_CROWN_01_SLOTS){
  const m=new THREE.Mesh(
   new THREE.BoxGeometry(.1,.1,.1),
   new THREE.MeshPhysicalMaterial({name,color:0xffffff,metalness:.05}))
  m.name=name
  root.add(m)
 }
 return {root,other}
}

describe('Royal Crown 01 material slots',()=>{
 it('offers exactly eight selectable palettes',()=>{
  expect(Object.keys(ROYAL_CROWN_01_PRESETS)).toHaveLength(8)
  expect(ROYAL_CROWN_01_PRESETS['royal-rainbow'].main).toBe('#FFFFFF')
 })
 it('covers all five intentional PBR zones without touching another prop',()=>{
  const {root,other}=fixture()
  const untouched=other.material
  const result=applyRoyalCrown01Palette(root,'royal-rainbow')
  expect(result.updatedMeshes).toBe(5)
  expect(result.missingSlots).toEqual([])
  expect(other.material).toBe(untouched)
  const metal=root.getObjectByName('metal_base') as THREE.Mesh
  expect((metal.material as THREE.MeshStandardMaterial).metalness).toBeCloseTo(.92)
 })
 it('reuses its private materials when switching colors, without leaks',()=>{
  const {root}=fixture()
  applyRoyalCrown01Palette(root,'sapphire')
  const gem=root.getObjectByName('gem_main_center') as THREE.Mesh
  const instance=gem.material
  const blue=(instance as THREE.MeshStandardMaterial).color.getHex()
  applyRoyalCrown01Palette(root,'ruby')
  expect(gem.material).toBe(instance)
  expect((gem.material as THREE.MeshStandardMaterial).color.getHex()).not.toBe(blue)
 })
 it('does not invent missing gem slots for an incompatible GLB',()=>{
  const root=new THREE.Group()
  const first=new THREE.Mesh(new THREE.BoxGeometry(),new THREE.MeshStandardMaterial())
  first.name='metal_base'
  root.add(first)
  const original=first.material
  const originalColor=(first.material as THREE.MeshStandardMaterial).color.getHex()
  const result=applyRoyalCrown01Palette(root,'ice-queen')
  expect(result.updatedMeshes).toBe(0)
  expect(result.missingSlots).toContain('gem_main_center')
  expect(first.material).toBe(original)
  expect((first.material as THREE.MeshStandardMaterial).color.getHex()).toBe(originalColor)
 })
})
