import {describe,expect,it,vi} from 'vitest'
vi.mock('server-only',()=>({}))
import {httpSqlParams} from './d1'
describe('Cloudflare D1 HTTP parameter encoding',()=>{
 it('sends finite integer SQLite params using REST string convention',()=>{
   expect(httpSqlParams(['abc',1777777777,0,-4])).toEqual(['abc','1777777777','0','-4'])
 })
 it('preserves NULL and prevents nonsensical numeric input',()=>{
   expect(httpSqlParams([null])).toEqual([null])
   expect(()=>httpSqlParams([Number.NaN])).toThrow('invalid_database_parameter')
   expect(()=>httpSqlParams([0.5])).toThrow('invalid_database_parameter')
 })
})
