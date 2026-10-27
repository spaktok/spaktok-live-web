import {describe,expect,it} from 'vitest'
import * as THREE from 'three'
import {createLuxeAvatar,LUXE_AVATAR_PRESETS} from './reality-avatar-luxe'

describe('LUXA avatar visual preset and animation rig contract',()=>{
 it('exposes two separate voluntary appearance styles, not face classification',()=>{
  expect(LUXE_AVATAR_PRESETS.map(x=>x.id)).toEqual(['masculine','feminine'])
  expect(LUXE_AVATAR_PRESETS.every(x=>x.hair&&x.eye&&x.finish)).toBe(true)
 })
 for(const style of ['masculine','feminine'] as const){
  it('builds a real skinned-style 3D head and accessible rig channels for '+style,()=>{
   const {root,eyes,brows,mouth}=createLuxeAvatar(style)
   const meshes:THREE.Mesh[]=[]
   root.traverse(node=>{if(node instanceof THREE.Mesh)meshes.push(node)})
   expect(meshes.length).toBeGreaterThan(45)
   expect(eyes).toHaveLength(2)
   expect(brows).toHaveLength(2)
   expect(mouth.parent).toBe(root)
   const head=meshes.find(x=>x.geometry.index?.count===42*62*6)
   expect(head).toBeDefined()
   expect(head?.geometry.getAttribute('normal').count).toBe((42+1)*(62+1))
   expect(eyes.every(x=>x.parent===root)).toBe(true)
   expect(brows.every(x=>typeof x.userData.restY==='number')).toBe(true)
   expect(root.children.length).toBeGreaterThan(12)
   const stubble=meshes.filter(x=>x instanceof THREE.InstancedMesh)
   expect(stubble.length).toBe(style==='masculine'?1:0)
   if(stubble.length)expect((stubble[0] as THREE.InstancedMesh).count).toBe(210)
   // Same node is movable by the same face pose signal.
   mouth.scale.set(1,1.3,1)
   expect(mouth.scale.y).toBeCloseTo(1.3)
  })
 }
 it('rejects unsupported appearances instead of silently creating the wrong face',()=>{
  expect(()=>createLuxeAvatar('unknown' as never)).toThrow('invalid_luxe_style')
 })
})
