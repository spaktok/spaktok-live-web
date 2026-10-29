#!/usr/bin/env node
// Read-only canary for Spaktok free Workers AI router: no model invocation,
// no auth token, no credits, no uploaded photo and NO change in billing.
import assert from 'node:assert/strict'
const url='https://spaktok-director-ai.spaktok.workers.dev'
const checks=[]
const get=async(path,options)=>fetch(url+path,{
 redirect:'error',cache:'no-store',
 signal:AbortSignal.timeout(10000),...options,
})
try{
 const health=await get('/health')
 assert.equal(health.status,200)
 const data=await health.json()
 assert.equal(data.ok,true)
 assert.equal(data.provider,'cloudflare-workers-ai')
 assert.equal(data.auth,'signed-server-only')
 checks.push('health: pass, no token required')
 const blocked=await get('/v1/agent/step',{
  method:'POST',headers:{'content-type':'application/json'},
  body:JSON.stringify({system:'test',instruction:'test'}),
 })
 assert.equal(blocked.status,401)
 assert.equal((await blocked.json()).error,'unauthorized')
 checks.push('unsigned model decision: rejected')
 const wrong=await get('/not-found')
 assert.equal(wrong.status,404)
 checks.push('unlisted routes: rejected')
 for(const check of checks)console.log('PASS:',check)
 console.log('Safe canary passed. Signed model execution and private creator session still require end-to-end tests.')
}catch(e){
 console.error('Spaktok free AI canary FAILED:',e instanceof Error?e.message:String(e))
 process.exitCode=1
}
