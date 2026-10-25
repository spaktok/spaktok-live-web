import { describe,expect,it,vi } from 'vitest'
vi.mock('server-only',()=>({}))
import {parseCredentials,safeEqual} from './auth'
describe('native auth input validation',()=>{
  it('requires email and strong passwords',()=>{
    expect(parseCredentials({email:'broken',password:'012345678901',username:'valid_user'})).toBeNull()
    expect(parseCredentials({email:'test@example.org',password:'short',username:'valid_user'})).toBeNull()
  })
  it('normalizes username and email',()=>{
    expect(parseCredentials({email:' USER@EXAMPLE.ORG ',password:'long-password-strong',username:'User_123'}))
      .toMatchObject({email:'user@example.org',username:'user_123'})
  })
  it('compares fixed-length secrets safely',()=>{
    expect(safeEqual('abcdef','abcdef')).toBe(true)
    expect(safeEqual('abcdef','ABCDEF')).toBe(false)
    expect(safeEqual('abcdef','abc')).toBe(false)
  })
})
