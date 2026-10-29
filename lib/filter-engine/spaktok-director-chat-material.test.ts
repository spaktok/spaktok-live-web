import {describe,it,expect} from 'vitest'
import {detectDirectorMaterialStyle} from './spaktok-director-chat-material'

describe('Spaktok Studio real material edit command parser',()=>{
 it('detects an explicit gold PBR material edit',()=>{
  const style=detectDirectorMaterialStyle('اجعل المجسم ذهبيًا')
  expect(style?.id).toBe('gold')
  expect(style?.metallic).toBeGreaterThan(.7)
 })
 it('supports an English physical color update',()=>{
  expect(detectDirectorMaterialStyle('Recolor the gift blue')?.id).toBe('blue')
 })
 it('does not silently modify a GLB when the user only names a color',()=>{
  expect(detectDirectorMaterialStyle('أريد تاجًا ذهبيًا لعالم Spaktok')).toBeNull()
  expect(detectDirectorMaterialStyle('Create a blue World')).toBeNull()
 })
 it('does not pretend arbitrary avatar rigging or animation is material editing',()=>{
  expect(detectDirectorMaterialStyle('حرّك هذا الأفاتار وتتبّع الوجه')).toBeNull()
 })
})
