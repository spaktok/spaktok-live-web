import assert from 'node:assert/strict';
import test from 'node:test';
import worker from './spaktok-vast-operator.mjs';

const url='https://spaktok-vast-operator.spaktok.workers.dev';
const request=(path,method='GET',body)=>
 new Request(url+path,{method,...(body?{headers:{'content-type':'application/json'},body:JSON.stringify(body)}:{})});
const fakeEnv=()=>({
 VAST_DB:{prepare(){throw Error('unexpected_database_access')}},
 VAST_ASSETS:{get(){throw Error('unexpected_storage_access')}},
 VAST_ENROLL_ENABLED:'false',
});

test('health reveals no secrets, and enrolling is closed by default',async()=>{
 const r=await worker.fetch(request('/health'),fakeEnv());
 assert.equal(r.status,200);
 const d=await r.json();
 assert.equal(d.enrollment,false);
 assert.equal(d.configured,true);
 assert.equal(d.publicCommandSubmission,false);
 assert.equal(d.gpuRented,false);
 assert.ok(!JSON.stringify(d).includes('token'));
 const enroll=await worker.fetch(request('/v1/agent/enroll','POST',{
  deviceId:'a'.repeat(32),tokenSha256:'b'.repeat(64),pairCode:'ABCD1234',
 }),fakeEnv());
 assert.equal(enroll.status,403);
 assert.equal((await enroll.json()).error,'enrollment_closed');
});

test('unauthenticated claim and file endpoints are denied',async()=>{
 for(const path of ['/v1/agent/claim','/v1/agent/jobs/00000000-0000-0000-0000-000000000000/input']){
  const r=await worker.fetch(request(path,'POST'),fakeEnv());
  assert.equal(r.status,401);
 }
});

test('enroll validates strictly and never writes bad device records',async()=>{
 const env=fakeEnv();
 env.VAST_ENROLL_ENABLED='true';
 env.VAST_ENROLL_EXPIRES_AT=String(Math.floor(Date.now()/1000)+600);
 const invalids=[
  {deviceId:'abc',tokenSha256:'b'.repeat(64),pairCode:'ABCD1234'},
  {deviceId:'a'.repeat(32),tokenSha256:'nothex',pairCode:'ABCD1234'},
  {deviceId:'a'.repeat(32),tokenSha256:'b'.repeat(64),pairCode:'FOO'},
 ];
 for(const item of invalids){
  const r=await worker.fetch(request('/v1/agent/enroll','POST',item),env);
  assert.equal(r.status,422);
 }
});

test('no arbitrary command, shell or public operator job endpoint is exposed',async()=>{
 const env=fakeEnv();
 for(const path of ['/v1/operator/execute','/v1/admin/jobs','/api/run-shell']){
  const r=await worker.fetch(request(path,'POST',{command:'rm -rf /'}),env);
  assert.equal(r.status,404);
 }
});

test('missing bindings fails closed even when enrollment is enabled',async()=>{
 const r=await worker.fetch(request('/v1/agent/enroll','POST',{foo:'bar'}),{
   VAST_ENROLL_ENABLED:'true',
 });
 assert.equal(r.status,503);
});
