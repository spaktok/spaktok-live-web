import {describe,expect,it} from 'vitest'
import {isGlb,isUsdzZip,usdzFileName} from './spaktok-usdz-export'

describe('spaktok usdz export helpers',()=>{
 it('derives a safe usdz name',()=>{
  expect(usdzFileName('spaktok-forge-studio-hd.glb')).toBe('spaktok-forge-studio-hd.usdz')
  expect(usdzFileName('../evil name.GLB')).toBe('-evil-name.usdz')
  expect(usdzFileName('.glb')).toBe('spaktok-model.usdz')
 })
 it('sniffs GLB magic',()=>{
  const b=new Uint8Array(24);b.set([0x67,0x6c,0x54,0x46])
  expect(isGlb(b.buffer)).toBe(true)
  expect(isGlb(new Uint8Array(24).buffer)).toBe(false)
  expect(isGlb(new Uint8Array(4).buffer)).toBe(false)
 })
 it('sniffs zip local header',()=>{
  const z=new Uint8Array(40);z.set([0x50,0x4b,0x03,0x04])
  expect(isUsdzZip(z)).toBe(true)
  expect(isUsdzZip(new Uint8Array(40))).toBe(false)
 })
})
