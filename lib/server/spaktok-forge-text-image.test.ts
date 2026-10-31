import {describe,expect,it} from 'vitest'
import {buildForgeConceptPrompt,normalizeForgeTextPrompt} from './spaktok-forge-text-image'

describe('forge text prompt',()=>{
 it('normalizes whitespace and control characters',()=>{
  expect(normalizeForgeTextPrompt('  a\n\tred\u0007  helmet ')).toBe('a red helmet')
 })
 it('rejects non-strings, too short and too long',()=>{
  expect(normalizeForgeTextPrompt(42)).toBeNull()
  expect(normalizeForgeTextPrompt(' a ')).toBeNull()
  expect(normalizeForgeTextPrompt('x'.repeat(601))).toBeNull()
  expect(normalizeForgeTextPrompt('x'.repeat(600))).toHaveLength(600)
 })
 it('builds a single-object, clean-background concept prompt',()=>{
  const p=buildForgeConceptPrompt('a knight helmet')
  expect(p).toContain('a knight helmet')
  expect(p).toMatch(/Exactly one object/)
  expect(p).toMatch(/Plain seamless light-gray studio background/)
 })
})
