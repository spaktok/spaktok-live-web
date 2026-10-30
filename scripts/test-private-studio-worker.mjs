#!/usr/bin/env node
/**
 * Read-only remote canary for the isolated Spaktok Studio R2 Worker.
 * Does not log secrets, does not upload assets and does not use GPU.
 *
 * Run (no account key needed):
 *   node scripts/test-private-studio-worker.mjs
 * With the configured Vercel Preview origin, also checks CORS preflight:
 *   SPAKTOK_STUDIO_PREVIEW_ORIGIN=https://... node scripts/test-private-studio-worker.mjs
 */
import assert from 'node:assert/strict'

const base='https://spaktok-private-studio-assets.spaktok.workers.dev'
const owner='123e4567-e89b-42d3-a456-426614174000'
const id='123e4567-e89b-42d3-a456-426614174001'
const path=`/v1/studio/${owner}/${id}.glb`
const url=base+path
const sha='a'.repeat(64)
let checks=0
const request=async(method,endpoint,headers={})=>{
 const res=await fetch(endpoint,{
  method,headers,redirect:'error',cache:'no-store',
  signal:AbortSignal.timeout(15_000),
 })
 return res
}
const ok=(condition,message)=>{
 assert.ok(condition,message)
 checks+=1
 console.log('PASS',message)
}
try{
 const health=await request('GET',base+'/health')
 ok(health.status===200,'health returns HTTP 200')
 const payload=await health.json()
 ok(payload.ok===true&&payload.storage==='private-r2'&&
    payload.modelAssets==='not-public','reports private-only R2 service')
 ok(health.headers.get('cache-control')?.includes('no-store'),
    'health response cannot be cached')
 const bad=await request('GET',url)
 ok(bad.status===422,'unsigned GET without metadata denied')
 const badData=await bad.json()
 ok(badData.error==='bad_claim','unsigned GET returns bad_claim')
 const forged=await request('GET',url,{
  'X-SpakTok-Studio-Sha256':sha,
  'X-SpakTok-Studio-Size':'256',
  'X-SpakTok-Studio-Expires':String(Math.floor(Date.now()/1000)+30),
  'X-SpakTok-Studio-Signature':'A'.repeat(86),
 })
 ok(forged.status===401,'well-formed but forged signature denied')
 const forgedData=await forged.json()
 ok(forgedData.error==='invalid_signature','signature verification fails closed')
 const evil='https://malicious.example'
 const rejected=await request('OPTIONS',url,{
  Origin:evil,'Access-Control-Request-Method':'PUT',
  'Access-Control-Request-Headers':'content-type,x-spaktok-studio-signature',
 })
 ok(rejected.status===403,'unapproved Origin CORS preflight rejected')
 ok(rejected.headers.get('access-control-allow-origin')!==evil,
    'forbidden Origin receives no CORS grant')
 const origin=process.env.SPAKTOK_STUDIO_PREVIEW_ORIGIN
 if(origin){
  const parsed=new URL(origin)
  assert.equal(parsed.protocol,'https:')
  assert.equal(parsed.origin,origin)
  const allowed=await request('OPTIONS',url,{
   Origin:origin,'Access-Control-Request-Method':'PUT',
   'Access-Control-Request-Headers':'content-type,x-spaktok-studio-signature',
  })
  ok(allowed.status===204,'configured preview Origin preflight allowed')
  ok(allowed.headers.get('access-control-allow-origin')===origin,
     'exact preview Origin returned')
  ok(allowed.headers.get('access-control-allow-methods')?.includes('PUT'),
     'private PUT allowed only after preflight')
 }
 console.log(`Spaktok private Studio Worker: ${checks} read-only checks passed.`)
}catch(error){
 console.error('Worker canary FAILED:',error?.message||String(error))
 process.exitCode=1
}
