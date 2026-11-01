import {describe,it,expect,vi} from 'vitest'
import * as THREE from 'three'
import {CROWN_V2_FILTER_ID,CROWN_V2_ASSET,verifiedCrownV2Buffer,
 crownV2ArabicError} from './crown-v2-private-live'
import {applyCrownV2DraftColors,CROWN_V2_COLOR_PRESETS} from './crown-v2-draft-colors'

describe('owner Crown V2 draft security',()=>{
 it('points only at immutable validated private V2 GLB',()=>{
  expect(CROWN_V2_FILTER_ID).toBe('3d-royal-crown-v2')
  expect(CROWN_V2_ASSET.sha256).toHaveLength(64)
  expect(CROWN_V2_ASSET.bytes).toBe(3324548)
  expect(CROWN_V2_ASSET.approvedForPublicLive).toBe(false)
  expect(CROWN_V2_ASSET.ownerDraftOnly).toBe(true)
 })
 it('rejects unrelated local GLB without making network calls',async()=>{
  const wrong=new File([new Uint8Array(28)],'other.glb',{type:'model/gltf-binary'})
  await expect(verifiedCrownV2Buffer(wrong)).rejects.toThrow('crown_v2_wrong_size')
 })
 it('gives specific login and owner errors in Arabic',()=>{
  expect(crownV2ArabicError(new Error('crown_v2_login'))).toContain('سجّل الدخول')
  expect(crownV2ArabicError(new Error('crown_v2_owner_only'))).toContain('المالك')
 })
})

describe('Crown V2 reversible material preview',()=>{
 function make(){
  const root=new THREE.Group()
  const labels=['metal_base','gem_main_center','gem_secondary','diamond_small',
    'sparkle_layer','gold_backing_headband']
  const originals=new Map<string,THREE.MeshBasicMaterial|THREE.MeshStandardMaterial>()
  for(const label of labels){
   const mat=label==='gold_backing_headband'
    ?new THREE.MeshStandardMaterial({name:label,color:'#d49b35'})
    :new THREE.MeshBasicMaterial({name:label,color:'#ffffff'})
   originals.set(label,mat)
   const mesh=new THREE.Mesh(new THREE.BoxGeometry(),mat)
   mesh.name=label
   root.add(mesh)
  }
  return {root,originals}
 }
 it('has eight experimental looks, and neutral look preserves source material colors',()=>{
  const {root,originals}=make()
  expect(Object.keys(CROWN_V2_COLOR_PRESETS)).toHaveLength(8)
  const neutral=applyCrownV2DraftColors(root,'royal-rainbow')
  expect(neutral.applied).toBe(true)
  expect(neutral.updatedMeshes).toBe(6)
  for(const mesh of root.children as THREE.Mesh[]){
   const original=originals.get(mesh.name)!
   expect((mesh.material as THREE.MeshBasicMaterial).color.getHex())
    .toBe(original.color.getHex())
   expect(mesh.material).not.toBe(original)
  }
 })
 it('tints a gem then restores original source colors',()=>{
  const {root}=make()
  const gem=root.getObjectByName('gem_main_center') as THREE.Mesh
  applyCrownV2DraftColors(root,'emerald')
  const modified=(gem.material as THREE.MeshBasicMaterial).color.getHex()
  applyCrownV2DraftColors(root,'royal-rainbow')
  expect((gem.material as THREE.MeshBasicMaterial).color.getHex()).toBe(0xffffff)
  expect(modified).not.toBe(0xffffff)
 })
 it('never touches a partial or unverified one-material asset',()=>{
  const root=new THREE.Group()
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(),
   new THREE.MeshStandardMaterial({name:'metal_base',color:'#ffffff'}))
  root.add(mesh)
  const original=mesh.material
  const out=applyCrownV2DraftColors(root,'ruby')
  expect(out.applied).toBe(false)
  expect(out.updatedMeshes).toBe(0)
  expect(out.missing).toContain('gem_main_center')
  expect(mesh.material).toBe(original)
 })
})
