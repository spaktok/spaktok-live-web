import {describe,expect,it} from 'vitest'
import {resolveForgeGpuBackend} from './spaktok-forge-provider'

const origin='https://studio.example.org'
const base={
 SPAKTOK_FORGE_GPU_ENABLED:'true',
 SPAKTOK_FORGE_GPU_DIRECT_ENABLED:'true',
 SPAKTOK_FORGE_GPU_DAILY_LIMIT:'1',
 SPAKTOK_FORGE_GPU_BROWSER_ORIGIN:origin,
 SPAKTOK_FORGE_GPU_TOKEN:'z'.repeat(48),
 SPAKTOK_FORGE_GPU_PROVIDER:'vast',
 SPAKTOK_FORGE_GPU_ENGINE:'trellis-v1',
 SPAKTOK_FORGE_GPU_HOST:'gpu.creator-domain.com',
 SPAKTOK_FORGE_GPU_VAST_HOSTNAME:'gpu.creator-domain.com',
 SPAKTOK_FORGE_GPU_URL:'https://gpu.creator-domain.com/v1/generate',
}
describe('Spaktok Forge GPU provider pinning',()=>{
 it('allows explicitly pinned Vast HTTPS tunnel + original TRELLIS',()=>{
  expect(resolveForgeGpuBackend(base,origin)).toMatchObject({
   provider:'vast',engine:'trellis-v1',globalCap:1,
  })
 })
 it('refuses unapproved or insecure Vast endpoints',()=>{
  const bad=[
   {SPAKTOK_FORGE_GPU_VAST_HOSTNAME:'elsewhere.example.org'},
   {SPAKTOK_FORGE_GPU_URL:'http://gpu.creator-domain.com/v1/generate'},
   {SPAKTOK_FORGE_GPU_URL:'https://gpu.creator-domain.com:8443/v1/generate'},
   {SPAKTOK_FORGE_GPU_URL:'https://gpu.creator-domain.com/v1/generate?x=1'},
   {SPAKTOK_FORGE_GPU_HOST:'127.0.0.1',SPAKTOK_FORGE_GPU_VAST_HOSTNAME:'127.0.0.1',
    SPAKTOK_FORGE_GPU_URL:'https://127.0.0.1/v1/generate'},
   {SPAKTOK_FORGE_GPU_HOST:'gpu.trycloudflare.com',
    SPAKTOK_FORGE_GPU_VAST_HOSTNAME:'gpu.trycloudflare.com',
    SPAKTOK_FORGE_GPU_URL:'https://gpu.trycloudflare.com/v1/generate'},
   {SPAKTOK_FORGE_GPU_ENGINE:'untrusted-shell'},
   {SPAKTOK_FORGE_GPU_ENGINE:'trellis2'},
   {SPAKTOK_FORGE_GPU_PROVIDER:'random'},
   {SPAKTOK_FORGE_GPU_ENABLED:'false'},
  ]
  for(const patch of bad)
   expect(resolveForgeGpuBackend({...base,...patch},origin)).toBeNull()
 })
 it('refuses mismatched browser origins and missing auth',()=>{
  expect(resolveForgeGpuBackend(base,'https://malicious.example.org')).toBeNull()
  expect(resolveForgeGpuBackend({...base,SPAKTOK_FORGE_GPU_TOKEN:'short'},origin)).toBeNull()
 })
 it('preserves strictly pinned legacy RunPod behaviour',()=>{
  const cfg={...base,
   SPAKTOK_FORGE_GPU_PROVIDER:'runpod',
   SPAKTOK_FORGE_GPU_ENGINE:'stable-fast-3d',
   SPAKTOK_FORGE_GPU_HOST:'demo-8000.proxy.runpod.net',
   SPAKTOK_FORGE_GPU_URL:'https://demo-8000.proxy.runpod.net/v1/generate',
  }
  expect(resolveForgeGpuBackend(cfg,origin)?.provider).toBe('runpod')
 })
})
