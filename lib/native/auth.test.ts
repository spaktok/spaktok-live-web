import { describe, expect, it } from 'vitest'
import { parseCredentials, safeEqual } from './auth'
describe('native account validation',()=>{
  it('rejects short passwords and invalid email',()=>{
    expect(parseCredentials({email:'test@invalid',password:'1234567890',username:'alex'})).toBeNull()
    expect(parseCredentials({email:'test@example.org',password:'123',username:'alex'})).toBeNull()
  })
  it('accepts a normalized new account',()=>{
    expect(parseCredentials({email:' X@EXAMPLE.org ',password:'strong-phrase-2026',username:'Spak_User'}))
      .toMatchObject({email:'x@example.org',username:'spak_user'})
  })
  it('matches secrets without string equality shortcuts',()=>{
    expect(safeEqual('secret','secret')).toBe(true)
    expect(safeEqual('secret','SECREt')).toBe(false)
    expect(safeEqual('s','ssss')).toBe(false)
  })
})
