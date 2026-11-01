import {describe,expect,it} from 'vitest'
import {readLimitedJson,trustedVercelClientIp} from './request-security'

describe('native API request guards',()=>{
 it('uses the proxy-owned client IP and ignores spoofable X-Forwarded-For',()=>{
  expect(trustedVercelClientIp(new Headers({'x-forwarded-for':'8.8.8.8'}))).toBe('unknown')
  expect(trustedVercelClientIp(new Headers({
   'x-vercel-forwarded-for':'2001:db8::1, 10.0.0.1','x-forwarded-for':'8.8.8.8',
  }))).toBe('2001:db8::1')
  expect(trustedVercelClientIp(new Headers({'x-vercel-forwarded-for':'bad-ip'}))).toBe('unknown')
 })
 it('parses normal small JSON bodies',async()=>{
  const req=new Request('https://spaktok.example/api/native/auth',{
   method:'POST',body:JSON.stringify({action:'login',email:'test@example.org'}),
  })
  expect(await readLimitedJson(req,4096)).toEqual({ok:true,value:{action:'login',email:'test@example.org'}})
 })
 it('rejects a forged small Content-Length when the stream exceeds its limit',async()=>{
  const oversized=new Request('https://spaktok.example/api/native/chat',{
   method:'POST',body:JSON.stringify({content:'a'.repeat(5000)}),
  })
  expect(await readLimitedJson(oversized,100)).toEqual({ok:false,reason:'too_large'})
 })
 it('rejects declared oversized payloads, invalid JSON and empty bodies',async()=>{
  const tooLarge=new Request('https://spaktok.example/api/native/auth',{
   method:'POST',headers:{'content-length':'9999'},body:'{}',
  })
  expect(await readLimitedJson(tooLarge,100)).toEqual({ok:false,reason:'too_large'})
  const invalid=new Request('https://spaktok.example/api/native/auth',{method:'POST',body:'{bad'})
  expect(await readLimitedJson(invalid,100)).toEqual({ok:false,reason:'invalid_json'})
  const empty=new Request('https://spaktok.example/api/native/auth',{method:'POST'})
  expect(await readLimitedJson(empty,100)).toEqual({ok:false,reason:'invalid_json'})
 })
})
