import {test} from 'node:test'
import assert from 'node:assert/strict'
import {
 HI3D_PLAN, imageMediaType,getHi3dToken,submitHi3dV3,queryHi3dTask,
 validateResultUrl,downloadHi3dGlb,filenameForTask,
} from './hi3d-api.mjs'

const png=Buffer.alloc(256)
Buffer.from([137,80,78,71,13,10,26,10]).copy(png)
const glb=Buffer.alloc(28)
glb.write('glTF')
glb.writeUInt32LE(2,4)
glb.writeUInt32LE(28,8)
const taskId='528f172b66554be2a2d1e95db4454a5a.test-queued.abc123'
const goodUrl='https://hitem3dstatic.zaohaowu.net/results/demo.glb'
const reply=(data,code=200)=>new Response(JSON.stringify({code,data,msg:'success'}),{
 status:200,headers:{'Content-Type':'application/json'},
})
test('pinned quality 2048 + PBR + GLB plan',()=>{
 assert.equal(HI3D_PLAN.model,'hi3dv3.0')
 assert.equal(HI3D_PLAN.resolution,'2048quality')
 assert.equal(HI3D_PLAN.estimatedCredits,45)
 assert.equal(HI3D_PLAN.format,'2')
})
test('image signature and format, reject invalid/massive file',()=>{
 assert.equal(imageMediaType(png,'owned.png'),'image/png')
 assert.throws(()=>imageMediaType(Buffer.alloc(256),'owned.png'),/format/)
 assert.throws(()=>imageMediaType(png,'owned.txt'),/format/)
})
test('auth uses Basic only to pinned token endpoint',async()=>{
 const fake=async(url,opts)=>{
  assert.equal(url,'https://api.hitem3d.ai/open-api/v1/auth/token')
  assert.equal(opts.method,'POST')
  assert.equal(opts.headers.Authorization,'Basic '+Buffer.from('id:secret').toString('base64'))
  return reply({accessToken:'t'.repeat(32)})
 }
 assert.equal((await getHi3dToken('id','secret',fake)).length,32)
})
test('paid submission uses exactly official model and never requires arbitrary URL',async()=>{
 const fake=async(url,opts)=>{
  assert.equal(url,'https://api.hitem3d.ai/open-api/v1/submit-task')
  assert.equal(opts.method,'POST')
  assert.equal(opts.body.get('model'),'hi3dv3.0')
  assert.equal(opts.body.get('pbr'),'1')
  assert.equal(opts.body.get('format'),'2')
  assert.equal(opts.body.get('resolution'),'2048quality')
  assert.ok(opts.body.get('images') instanceof Blob)
  return reply({task_id:taskId})
 }
 assert.equal(await submitHi3dV3(png,'original.png','t'.repeat(32),fake),taskId)
})
test('query distinguishes processing and success',async()=>{
 const pending=async()=>reply({state:'processing'})
 assert.deepEqual(await queryHi3dTask(taskId,'t'.repeat(32),pending),{state:'processing'})
 const done=async()=>reply({state:'success',url:goodUrl})
 assert.deepEqual(await queryHi3dTask(taskId,'t'.repeat(32),done),{
  state:'success',modelUrl:goodUrl,
 })
})
test('reject untrusted provider output URL',()=>{
 for(const url of [
  'http://hitem3dstatic.zaohaowu.net/results/demo.glb',
  'https://127.0.0.1/results/demo.glb',
  'https://evil.example/results/demo.glb',
  'https://hitem3dstatic.zaohaowu.net.evil.example/secret.glb',
  'https://hitem3dstatic.zaohaowu.net/results/demo.zip',
  'https://hitem3dstatic.zaohaowu.net:8443/results/demo.glb',
 ]){
  assert.throws(()=>validateResultUrl(url))
 }
})
test('GLB download is bounded and has a valid header',async()=>{
 const fake=async(url,opts)=>{
  assert.equal(url,goodUrl)
  assert.equal(opts.redirect,'error')
  return new Response(glb,{status:200,headers:{
   'Content-Type':'model/gltf-binary','Content-Length':'28',
  }})
 }
 const out=await downloadHi3dGlb(goodUrl,fake)
 assert.deepEqual(out,glb)
 assert.match(filenameForTask(taskId),/^spaktok-hi3d-v3-[a-f0-9]{16}\.glb$/)
})
test('malformed GLB rejected without publishing',async()=>{
 const fake=async()=>new Response(Buffer.alloc(32),{status:200})
 await assert.rejects(()=>downloadHi3dGlb(goodUrl,fake),/invalid_glb/)
})
test('invalid token cannot create task',async()=>{
 await assert.rejects(
  ()=>submitHi3dV3(png,'owned.png','short',async()=>{throw Error('unexpected call')}),
  /token_missing/,
 )
})
