import {describe,expect,it} from 'vitest'
import {classifyNativeAuthResponse} from './auth-response'

describe('native session readiness',()=>{
 it('recognizes an available configured service',()=>{
  expect(classifyNativeAuthResponse(200,{configured:true})).toBe('ready')
 })
 it('keeps unconfigured state separate from a temporary D1 outage',()=>{
  expect(classifyNativeAuthResponse(503,{configured:false})).toBe('not_configured')
  expect(classifyNativeAuthResponse(503,{configured:true})).toBe('unavailable')
  expect(classifyNativeAuthResponse(502,null)).toBe('unavailable')
  expect(classifyNativeAuthResponse(200,{})).toBe('unavailable')
 })
 it('does not treat an HTTP failure as a signed-in session',()=>{
  expect(classifyNativeAuthResponse(401,{configured:true})).toBe('unavailable')
  expect(classifyNativeAuthResponse(503,{configured:'true'})).toBe('unavailable')
 })
})
