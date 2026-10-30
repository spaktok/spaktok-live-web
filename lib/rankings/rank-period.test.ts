import {describe,expect,it} from 'vitest'
import {parseRankWindow} from './rank-period'
describe('ranking period whitelist',()=>{
 it('defaults to last seven days',()=>expect(parseRankWindow(null)).toBe('week'))
 it('accepts only known periods',()=>{
  for(const p of ['week','month','all'] as const)expect(parseRankWindow(p)).toBe(p)
  for(const p of ['',"week';DROP TABLE videos",'yesterday','week%20all'])
   expect(parseRankWindow(p)).toBeNull()
 })
})
