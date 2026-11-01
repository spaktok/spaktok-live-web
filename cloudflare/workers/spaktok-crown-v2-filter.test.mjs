// Contract tests for the owner-only V2 crown Worker using ephemeral keys.
// No production secrets, user accounts, or actual crown geometry.
import test from 'node:test'
import assert from 'node:assert/strict'
import {generateKeyPairSync,sign,webcrypto} from 'node:crypto'
import worker from './spaktok-crown-v2-filter.mjs'

globalThis.crypto ??= webcrypto
const ORIGIN='https://v0-spaktok-elite-app.vercel.app'
const USER='123e4567-e89b-42d3-a456-426614174000'
const PATH='https://crown.example/v1/crown-v2/draft.glb'
const DOMAIN='spaktok-crown-v2-owner-filter-v1'
const pair=generateKeyPairSync('ed25519')
const PUBLIC=pair.publicKey.export({type:'spki',format:'der'}).toString('base64')

function ticket({user=USER,origin=ORIGIN,expiry=String(Math.floor(Date.now()/1000)+60),
                 method='GET',privateKey=pair.privateKey}={}){
 const message=[DOMAIN,method,user,'crown-v2',expiry,origin].join('\n')
 return {
  Origin:origin,
  'X-Spaktok-Crown-User':user,
  'X-Spaktok-Crown-Expires':expiry,
  'X-Spaktok-Crown-Signature':sign(null,Buffer.from(message),privateKey).toString('base64url'),
 }
}
function run({url=PATH,headers=ticket(),method='GET',noStorage=false,
              size=3324548,hash='ee5ec583041a9e2b55e31f718e42670ba5526d2cccfa249b549dece4ad81f129'}={}){
 const reads=[]
 const env={
  SPAKTOK_WEB_ORIGIN:ORIGIN,
  SPAKTOK_CROWN_V2_ED25519_PUBLIC_KEY:PUBLIC,
  ...(!noStorage?{STUDIO_ASSETS:{async get(key){
   reads.push(key)
   // Invalid metadata must fail before any content can be sent.
   return {size,customMetadata:{sha256:hash},arrayBuffer:async()=>{
    throw Error('should-not-open-r2-object')
   }}
  }}}:{}),
 }
 return worker.fetch(new Request(url,{method,headers}),env)
   .then(response=>({response,reads}))
}

test('the V2 owner ticket is required before reading private R2 objects',async(t)=>{
 const invalid=[
  {label:'missing origin',headers:{},status:403},
  {label:'wrong origin',headers:ticket({origin:'https://evil.example'}),status:403},
  {label:'missing signature',headers:{Origin:ORIGIN},status:401},
  {label:'invalid signature',headers:{...ticket(),'X-Spaktok-Crown-Signature':'a'.repeat(86)},status:401},
  {label:'expired signature',headers:ticket({expiry:String(Math.floor(Date.now()/1000)-10)}),status:401},
  {label:'future signature',headers:ticket({expiry:String(Math.floor(Date.now()/1000)+1000)}),status:401},
  {label:'wrong user',headers:ticket({user:'not-a-uuid'}),status:401},
  {label:'wrong method in signed payload',headers:ticket({method:'POST'}),status:401},
 ]
 for(const item of invalid){
  await t.test(item.label,async()=>{
   const {response,reads}=await run(item)
   assert.equal(response.status,item.status)
   assert.deepEqual(reads,[])
   assert.equal(response.headers.get('cache-control'),'private,no-store')
  })
 }
})

test('valid owner ticket reads only the exact source-locked V2 key',async()=>{
 const {response,reads}=await run({size:123})
 assert.equal(response.status,503)
 assert.deepEqual(reads,['studio/private/filters/crown/royal-crown-01/v2-source-locked/master.glb'])
})

test('valid ticket still rejects unverified object hash and missing bucket',async()=>{
 const mismatch=await run({hash:'0'.repeat(64)})
 assert.equal(mismatch.response.status,503)
 assert.equal(mismatch.reads.length,1)
 const missing=await run({noStorage:true})
 assert.equal(missing.response.status,503)
 assert.deepEqual(missing.reads,[])
})

test('only exact path and origin receive preflight approval',async()=>{
 const allowed=await run({method:'OPTIONS',headers:{Origin:ORIGIN}})
 assert.equal(allowed.response.status,204)
 assert.equal(allowed.response.headers.get('access-control-allow-origin'),ORIGIN)
 assert.equal(allowed.response.headers.get('access-control-allow-methods'),'GET, OPTIONS')
 assert.deepEqual(allowed.reads,[])
 const wrongPath=await run({url:PATH+'-old',headers:ticket()})
 assert.equal(wrongPath.response.status,404)
 assert.deepEqual(wrongPath.reads,[])
 const query=await run({url:PATH+'?download=1',headers:ticket()})
 assert.equal(query.response.status,404)
 assert.deepEqual(query.reads,[])
 const rejected=await run({method:'OPTIONS',headers:{Origin:'https://preview.example'}})
 assert.equal(rejected.response.status,403)
})
