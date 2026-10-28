import {describe,expect,it} from 'vitest'
import * as THREE from 'three'
import {buildForgeReliefGeometry,DEFAULT_FORGE_RELIEF,
 validateForgeReliefOptions} from './spaktok-forge-relief'
const image=(width:number,height:number,value=64)=>{
 const pixels=new Uint8ClampedArray(width*height*4)
 for(let i=0;i<pixels.length;i+=4){
  pixels[i]=value;pixels[i+1]=value;pixels[i+2]=value;pixels[i+3]=255
 }
 return pixels
}
describe('Spaktok Forge local relief: no GPU, no vendor calls',()=>{
 it('generates finite self-contained mesh attributes and under-budget indexed triangles',()=>{
  const result=buildForgeReliefGeometry(image(64,64),64,64)
  const mesh=result.geometry
  expect(result.stats.mode).toBe('browser-2.5d')
  expect(result.stats.triangles).toBeGreaterThan(0)
  expect(result.stats.triangles).toBeLessThan(40000)
  expect(mesh.getAttribute('normal')?.count).toBe(result.stats.vertices)
  expect(mesh.getAttribute('uv')?.count).toBe(result.stats.vertices)
  expect(mesh.index?.count).toBe(result.stats.triangles*3)
  const position=mesh.getAttribute('position')
  for(let i=0;i<position.count;i++)
   expect(Number.isFinite(position.getZ(i))).toBe(true)
  expect(result.stats.maxDisplacement).toBeGreaterThan(0)
  mesh.dispose()
 })
 it('does not move the backside when changing relief strength',()=>{
  const a=buildForgeReliefGeometry(image(24,24),24,24,{...DEFAULT_FORGE_RELIEF,relief:0})
  const b=buildForgeReliefGeometry(image(24,24),24,24,{...DEFAULT_FORGE_RELIEF,relief:.7})
  const count=a.stats.vertices/2
  const pa=a.geometry.getAttribute('position'),pb=b.geometry.getAttribute('position')
  expect(pb.getZ(count)).toBe(pa.getZ(count))
  expect(pb.getZ(Math.floor(count/2)+16)).toBeGreaterThan(pa.getZ(Math.floor(count/2)+16)))
  a.geometry.dispose();b.geometry.dispose()
 })
 it('preserves portrait geometry and handles transparent backgrounds',()=>{
  const pixels=image(32,64,0)
  pixels.fill(0)
  const result=buildForgeReliefGeometry(pixels,32,64)
  expect(result.stats.height).toBeGreaterThan(result.stats.width)
  expect(result.stats.maxDisplacement).toBe(0)
  result.geometry.dispose()
 })
 it('rejects malformed/oversized buffers and invalid costly mesh resolution',()=>{
  expect(()=>buildForgeReliefGeometry(image(8,8),8,8,{...DEFAULT_FORGE_RELIEF,resolution:999 as 32}))
   .toThrow('forge_relief_invalid_settings')
  expect(()=>buildForgeReliefGeometry(new Uint8ClampedArray(32),32,32))
   .toThrow('forge_relief_invalid_pixels')
  expect(()=>validateForgeReliefOptions({...DEFAULT_FORGE_RELIEF,relief:NaN}))
   .toThrow('forge_relief_invalid_settings')
 })
 it('result can be rendered using a standard PBR mesh without generating facial morphs',()=>{
  const {geometry}=buildForgeReliefGeometry(image(16,16),16,16)
  const mesh=new THREE.Mesh(geometry,new THREE.MeshStandardMaterial({roughness:.65}))
  expect(mesh.geometry.morphAttributes.position).toBeUndefined()
  expect(mesh.geometry.getAttribute('uv').itemSize).toBe(2)
  geometry.dispose();(mesh.material as THREE.Material).dispose()
 })
})
