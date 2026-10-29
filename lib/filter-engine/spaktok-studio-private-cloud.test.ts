import {describe,it,expect} from 'vitest'
import {requireTrustedStudioR2Endpoint} from './spaktok-studio-private-cloud'
const owner='123e4567-e89b-42d3-a456-426614174000'
const asset='123e4567-e89b-42d3-a456-426614174001'
const valid=`https://spaktok-private-studio-assets.spaktok.workers.dev/v1/studio/${owner}/${asset}.glb`
describe('Spaktok owner-private R2 URL pinning',()=>{
 it('allows only exact signed owner/UUID model URLs',()=>{
  expect(requireTrustedStudioR2Endpoint(valid)).toBe(valid)
 })
 it('rejects public, private-network, insecure, redirected or query-bearing destinations',()=>{
  for(const url of [
   valid.replace('https:','http:'),
   valid.replace('spaktok-private-studio-assets.spaktok.workers.dev','example.com'),
   valid+'?token=secret',
   valid+'#hash',
   valid.replace('.workers.dev','.workers.dev.evil.com'),
   valid.replace('/v1/studio/','/v1/face/'),
   valid.replace('/'+asset+'.glb','/../../secret.glb'),
   valid.replace('https://','https://user:pass@'),
   valid.replace('.workers.dev/','.workers.dev:8443/'),
   'https://127.0.0.1/v1/studio/'+owner+'/'+asset+'.glb',
  ])expect(()=>requireTrustedStudioR2Endpoint(url)).toThrow('studio_r2_untrusted_destination')
 })
})
