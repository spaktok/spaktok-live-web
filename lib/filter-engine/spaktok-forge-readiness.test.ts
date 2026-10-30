import {describe,expect,it} from 'vitest'
import {FORGE_GPU_READINESS_AR,forgeGpuReadiness,parseForgeModelAccess} from './spaktok-forge-readiness'
describe('Spaktok Forge fail-closed operator readiness',()=>{
 it('requires explicit model access approval even when GPU claims online',()=>{
  expect(forgeGpuReadiness({enabled:true,modelAccess:'unknown',online:true}))
   .toBe('model-access-unverified')
  expect(forgeGpuReadiness({enabled:true,modelAccess:'pending',online:true}))
   .toBe('awaiting-model-access')
 })
 it('does not spend GPU calls when configuration disabled',()=>{
  expect(forgeGpuReadiness({enabled:false,modelAccess:'approved',online:true}))
   .toBe('disabled')
 })
 it('distinguishes a stopped rental from a ready endpoint',()=>{
  expect(forgeGpuReadiness({enabled:true,modelAccess:'approved',online:false}))
   .toBe('provider-offline')
  expect(forgeGpuReadiness({enabled:true,modelAccess:'approved',online:true}))
   .toBe('ready')
 })
 it('fails closed on missing or malformed operator setting',()=>{
  for(const s of [undefined,'','granted','yes','APPROVED','pending '])
   expect(parseForgeModelAccess(s)).toBe('unknown')
  expect(parseForgeModelAccess('approved')).toBe('approved')
  expect(parseForgeModelAccess('pending')).toBe('pending')
 })
 it('provides an actionable UI message for all states',()=>{
  for(const state of ['disabled','awaiting-model-access','model-access-unverified',
   'provider-offline','ready'] as const)
   expect(FORGE_GPU_READINESS_AR[state].length).toBeGreaterThan(20)
 })
})
