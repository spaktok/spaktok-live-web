import { describe,expect,it,vi } from 'vitest'
vi.mock('server-only',()=>({}))
import {parseCredentials,parseRecovery,newRecoveryCode,safeEqual} from './auth'
describe('native auth input validation',()=>{
  it('requires email and strong passwords',()=>{
    expect(parseCredentials({email:'broken',password:'012345678901',username:'valid_user'})).toBeNull()
    expect(parseCredentials({email:'test@example.org',password:'short',username:'valid_user'})).toBeNull()
  })
  it('normalizes username and email',()=>{
    expect(parseCredentials({email:' USER@EXAMPLE.ORG ',password:'long-password-strong',username:'User_123'}))
      .toMatchObject({email:'user@example.org',username:'user_123'})
  })
  it('generates 256-bit one-time recovery secrets and validates them',()=>{
    const code=newRecoveryCode()
    expect(code).toMatch(/^spak1_[A-Za-z0-9_-]{43}$/)
    expect(code).not.toEqual(newRecoveryCode())
    expect(parseRecovery({email:' User@Example.org ',password:'long-secure-pass',
      recoveryCode:code})).toMatchObject({email:'user@example.org',recoveryCode:code})
    expect(parseRecovery({email:'user@example.org',password:'long-secure-pass',
      recoveryCode:'bad'})).toBeNull()
  })
  it('compares fixed-length secrets safely',()=>{
    expect(safeEqual('abcdef','abcdef')).toBe(true)
    expect(safeEqual('abcdef','ABCDEF')).toBe(false)
    expect(safeEqual('abcdef','abc')).toBe(false)
  })
})
