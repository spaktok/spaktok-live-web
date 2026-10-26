import {describe,expect,it} from 'vitest'
import * as THREE from 'three'
import {FaceMakeupLayer} from './makeup3d-render'
import {makePremiumAccessory} from './face3d-premium'
import {makeupLooks} from './makeup3d'
const vertices=Array.from({length:478},()=>({x:.5,y:.5,z:0}))
const put=(id:number,x:number,y:number)=>vertices[id]={x,y,z:0}
for(const [id,x,y] of [[33,.36,.4],[133,.45,.4],[159,.4,.38],[145,.4,.42],[362,.55,.4],[263,.64,.4],[386,.6,.38],[374,.6,.42],
 [234,.22,.53],[454,.78,.53],[61,.43,.7],[40,.45,.68],[37,.47,.66],[0,.5,.66],[267,.53,.66],[270,.55,.68],[291,.57,.7],
 [321,.55,.72],[314,.53,.73],[17,.5,.735],[84,.47,.73],[91,.45,.72],
 [50,.37,.55],[101,.34,.56],[205,.36,.6],[117,.32,.59],
 [280,.63,.55],[330,.66,.56],[425,.64,.6],[346,.68,.59],
 [123,.28,.65],[147,.25,.65],[187,.30,.63],
 [352,.72,.65],[376,.75,.65],[411,.70,.63],
 [6,.5,.5],[168,.5,.53],[197,.5,.56]] as const)put(id,x,y)
describe('GPU 3D face cosmetics and premium accessories',()=>{
 it('allocates one transparent physical mesh anchored to the same face positions',()=>{
  const positions=new THREE.BufferAttribute(new Float32Array(478*3),3)
  const source=new THREE.BufferGeometry()
  source.setAttribute('position',positions);source.setIndex([0,1,2])
  const layer=new FaceMakeupLayer(source,[0,1,2])
  expect(layer.mesh.geometry.getAttribute('position')).toBe(positions)
  expect(layer.mesh.material.transparent).toBe(true)
  expect(layer.mesh.material.depthWrite).toBe(false)
  layer.setStyle('3d-makeup-glam',true)
  expect(layer.mesh.visible).toBe(true)
  const originalLip=(layer.mesh.material.uniforms.uCoverageA.value as THREE.Vector4).y
  expect(originalLip).toBeGreaterThan(.5)
  layer.setStyle('3d-makeup-glam',true,{lips:0,eyeliner:.2})
  expect((layer.mesh.material.uniforms.uCoverageA.value as THREE.Vector4).y).toBe(0)
  expect((layer.mesh.material.uniforms.uCoverageA.value as THREE.Vector4).w).toBeLessThan(.2)
  layer.setStyle('3d-makeup-glam',true,{lips:1,eyeliner:1})
  layer.update(vertices,9/16)
  expect([...layer.masksA.array as Float32Array].some(v=>v>.05)).toBe(true)
  expect([...layer.masksB.array as Float32Array].some(v=>v>.05)).toBe(true)
  layer.setStyle('3d-lux-glasses',true)
  expect(layer.mesh.visible).toBe(false)
  layer.dispose();source.dispose()
 })
 it('supports all eight original makeup palettes without extra 3D geometries',()=>{
  const source=new THREE.BufferGeometry()
  source.setAttribute('position',new THREE.BufferAttribute(new Float32Array(478*3),3))
  const layer=new FaceMakeupLayer(source,[0,1,2])
  for(const look of makeupLooks){
   layer.setStyle(look.id,true)
   expect(layer.mesh.visible).toBe(true)
   expect(layer.mesh.material.uniforms.uLip.value).toBeInstanceOf(THREE.Color)
  }
  layer.dispose();source.dispose()
 })
 it('builds detailed PBR accessories, rather than plain single geometric primitives',()=>{
  for(const id of ['3d-lux-glasses','3d-gold-crown','3d-space-visor','3d-metal-cap']){
   const group=makePremiumAccessory(id)
   expect(group).not.toBeNull()
   const meshes:THREE.Mesh[]=[]
   group!.traverse(node=>{if(node instanceof THREE.Mesh)meshes.push(node)})
   if(id==='3d-gold-crown'){
     // A polished mobile scene must batch static filigree instead of
     // issuing hundreds of draws for individual diamonds/prongs.
     expect(meshes.length,id).toBeLessThan(45)
     expect(meshes.length,id).toBeGreaterThan(6)
     expect(meshes.reduce((n,m)=>n+(m.geometry.index?m.geometry.index.count/3:m.geometry.getAttribute('position').count/3),0)).toBeGreaterThan(20000)
   }else expect(meshes.length,id).toBeGreaterThan(9)
   expect(meshes.some(mesh=>mesh.material instanceof THREE.MeshPhysicalMaterial),id).toBe(true)
   for(const mesh of meshes)mesh.geometry.dispose()
   for(const mat of new Set(meshes.flatMap(m=>Array.isArray(m.material)?m.material:[m.material])))mat.dispose()
  }
 })
})
