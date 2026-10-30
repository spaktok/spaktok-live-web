// Security regression for the actual owner-private Worker source, not a
// public R2 deployment. Uses a fresh ephemeral Ed25519 key and in-memory
// synthetic bytes only. No user IDs, production keys or GLB assets involved.
import test from 'node:test'
import assert from 'node:assert/strict'
import {createPrivateKey,generateKeyPairSync,sign,webcrypto} from 'node:crypto'
import worker from './spaktok-private-studio-asset.mjs'

globalThis.crypto ??= webcrypto

const ORIGIN='https://qa.spaktok.example'
const DOMAIN='spaktok-studio-pilot-read-v1'
const USER='123e4567-e89b-42d3-a456-426614174000'
const BASE='https://worker.invalid/v1/pilot/'
const pair=generateKeyPairSync('ed25519')
const spki=pair.publicKey.export({type:'spki',format:'der'}).toString('base64')
const pkcs8Pem=pair.privateKey.export({type:'pkcs8',format:'pem'}).toString('utf8')
// Mirror the Next.js ticket's PEM -> base64 env -> Node createPrivateKey path.
const pemBase64=Buffer.from(pkcs8Pem,'utf8').toString('base64')
const signingKey=createPrivateKey(Buffer.from(pemBase64,'base64').toString('utf8'))
const expected={
 lod1c:{bytes:5_087_128,key:'studio/private/pilot-20261030/professional-candidates-v1/lod1-conservative.glb'},
 lod2c:{bytes:4_992_732,key:'studio/private/pilot-20261030/professional-candidates-v1/lod2-conservative.glb'},
}
const expiry=()=>String(Math.floor(Date.now()/1000)+60)

function ticket(assetId,{user=USER,expires=expiry(),origin=ORIGIN,claimAssetId=assetId}={}){
 const payload=[DOMAIN,'GET',user,claimAssetId,expires,origin].join('\n')
 const signature=sign(null,Buffer.from(payload),signingKey).toString('base64url')
 return {
  Origin:origin,
  'X-Spaktok-Studio-Signature':signature,
  'X-Spaktok-Studio-Expires':expires,
  'X-Spaktok-Studio-User':user,
 }
}

function makeEnv({sizeOverride,missingAsset=false,noR2=false,origin=ORIGIN,publicKey=spki}={}){
 const reads=[]
 const binding={
  async get(key){
   reads.push(key)
   if(missingAsset)return null
   const record=Object.values(expected).find(x=>x.key===key)
   if(!record)return null
   const bytes=sizeOverride??record.bytes
   return {size:bytes,body:new Response(new Uint8Array(bytes)).body}
  },
 }
 return {
  env:{
   SPAKTOK_WEB_ORIGIN:origin,
   SPAKTOK_STUDIO_ED25519_PUBLIC_KEY:publicKey,
   ...(noR2?{}:{STUDIO_ASSETS:binding}),
  },
  reads,
 }
}

const run=(id,headers={},options={},method='GET',suffix='')=>{
 const {env,reads}=makeEnv(options)
 const req=new Request(BASE+id+'.glb'+suffix,{method,headers})
 return worker.fetch(req,env).then(response=>({response,reads}))
}

test('valid short-lived PEM-compatible owner tickets load the exact private R2 objects',async()=>{
 for(const id of ['lod1c','lod2c']){
  const {response,reads}=await run(id,ticket(id))
  assert.equal(response.status,200)
  assert.deepEqual(reads,[expected[id].key])
  assert.equal(response.headers.get('content-type'),'model/gltf-binary')
  assert.equal(response.headers.get('content-length'),String(expected[id].bytes))
  assert.equal(response.headers.get('access-control-allow-origin'),ORIGIN)
  assert.equal(response.headers.get('cache-control'),'private,no-store')
  assert.equal(response.headers.get('cross-origin-resource-policy'),'cross-origin')
  assert.equal((await response.arrayBuffer()).byteLength,expected[id].bytes)
 }
})

test('invalid owner tickets are always rejected BEFORE any R2 reads',async(t)=>{
 const expired=String(Math.floor(Date.now()/1000)-2)
 const farFuture=String(Math.floor(Date.now()/1000)+180)
 const cases=[
  {label:'missing origin',headers:{},status:403},
  {label:'wrong origin',headers:ticket('lod1c',{origin:'https://evil.example'}),status:403},
  {label:'missing signature',headers:{Origin:ORIGIN},status:401},
  {label:'invalid signature',headers:{...ticket('lod1c'),'X-Spaktok-Studio-Signature':'x'.repeat(86)},status:401},
  {label:'expired signature',headers:ticket('lod1c',{expires:expired}),status:401},
  {label:'future signature',headers:ticket('lod1c',{expires:farFuture}),status:401},
  {label:'wrong user id',headers:ticket('lod1c',{user:'not-a-uuid'}),status:401},
  {label:'missing verify key',headers:ticket('lod1c'),options:{publicKey:''},status:401},
  {label:'untrusted operator origin',headers:ticket('lod1c'),options:{origin:'https://other.example'},status:403},
 ]
 for(const item of cases){
  await t.test(item.label,async()=>{
   const {response,reads}=await run('lod1c',item.headers,item.options||{})
   assert.equal(response.status,item.status)
   assert.equal(reads.length,0)
   assert.equal(response.headers.get('cache-control'),'private,no-store')
  })
 }
})

test('signatures are bound to the exact LOD, path, query, and GET method',async(t)=>{
 const cases=[
  {label:'signature for lod1c cannot load lod2c',id:'lod2c',headers:ticket('lod1c'),status:401},
  {label:'query strings forbidden',id:'lod1c',headers:ticket('lod1c'),suffix:'?copy=1',status:404},
  {label:'path traversal forbidden',id:'../../lod1c',headers:ticket('lod1c'),status:404},
  {label:'POST cannot use a GET ticket',id:'lod1c',headers:ticket('lod1c'),method:'POST',status:401},
  {label:'unknown LOD forbidden',id:'lod3',headers:ticket('lod3'),status:404},
 ]
 for(const item of cases){
  await t.test(item.label,async()=>{
   const {response,reads}=await run(item.id,item.headers,{},item.method||'GET',item.suffix||'')
   assert.equal(response.status,item.status)
   assert.deepEqual(reads,[])
  })
 }
})

test('CORS preflight is exact-origin and never touches R2',async()=>{
 const yes=await run('lod1c',{Origin:ORIGIN}, {},'OPTIONS')
 assert.equal(yes.response.status,204)
 assert.equal(yes.response.headers.get('access-control-allow-origin'),ORIGIN)
 assert.deepEqual(yes.reads,[])
 const no=await run('lod1c',{Origin:'https://evil.example'}, {},'OPTIONS')
 assert.equal(no.response.status,403)
 assert.deepEqual(no.reads,[])
})

test('valid signature still fails closed on missing/incorrect private object',async()=>{
 const missing=await run('lod1c',ticket('lod1c'),{missingAsset:true})
 assert.equal(missing.response.status,503)
 assert.deepEqual(missing.reads,[expected.lod1c.key])
 const mismatch=await run('lod1c',ticket('lod1c'),{sizeOverride:10})
 assert.equal(mismatch.response.status,503)
 assert.deepEqual(mismatch.reads,[expected.lod1c.key])
 const noBinding=await run('lod2c',ticket('lod2c'),{noR2:true})
 assert.equal(noBinding.response.status,503)
 assert.deepEqual(noBinding.reads,[])
})
