import {describe,expect,it} from 'vitest'
import {isForgeGpuEndpoint} from './spaktok-forge-gpu-endpoint'

describe('GPU provider outbound and browser destination controls',()=>{
 const runpod='testpod-8000.proxy.runpod.net'
 const vast='rain-donations-courier-magical.trycloudflare.com'
 it('allows only the configured exact HTTPS provider URL',()=>{
  expect(isForgeGpuEndpoint('https://'+runpod+'/v1/generate',runpod,'runpod')).toBe(true)
  expect(isForgeGpuEndpoint('https://'+vast+'/v1/generate',vast,'vast-quick-tunnel')).toBe(true)
 })
 it('rejects tunnel to portal, non-TLS and arbitrary domain',()=>{
  expect(isForgeGpuEndpoint('https://'+vast+'/#/apps',vast,'vast-quick-tunnel')).toBe(false)
  expect(isForgeGpuEndpoint('http://'+vast+'/v1/generate',vast,'vast-quick-tunnel')).toBe(false)
  expect(isForgeGpuEndpoint('https://evil.example/v1/generate','evil.example','vast-quick-tunnel')).toBe(false)
  expect(isForgeGpuEndpoint('https://127.0.0.1/v1/generate','127.0.0.1','vast-quick-tunnel')).toBe(false)
 })
 it('rejects cross-provider mixups, alternate ports, query or credentials',()=>{
  expect(isForgeGpuEndpoint('https://'+vast+'/v1/generate',vast,'runpod')).toBe(false)
  expect(isForgeGpuEndpoint('https://'+runpod+'/v1/generate',runpod,'vast-quick-tunnel')).toBe(false)
  expect(isForgeGpuEndpoint('https://'+vast+':8000/v1/generate',vast,'vast-quick-tunnel')).toBe(false)
  expect(isForgeGpuEndpoint('https://'+vast+'/v1/generate?x=1',vast,'vast-quick-tunnel')).toBe(false)
  expect(isForgeGpuEndpoint('https://x@'+vast+'/v1/generate',vast,'vast-quick-tunnel')).toBe(false)
 })
})
