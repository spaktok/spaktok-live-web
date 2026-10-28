import {describe,expect,it} from 'vitest'
import {createHash,createHmac} from 'node:crypto'
// @ts-ignore: Cloudflare standalone module intentionally has no TypeScript declaration.
import worker from '../../cloudflare/workers/spaktok-word-rodin.mjs'
const endpoint='https://spaktok-word-rodin.spaktok.workers.dev'
const secret='spaktok-test-signing-key-must-be-long-and-private'
const owner='123e4567-e89b-42d3-a456-426614174000'
const env={
 WORD_PAID_ENABLED:'false',WORD_SIGNING_SECRET:secret,
 WORD_DB:{},WORD_ASSETS:{},WORD_QUEUE:{},
}
describe('Spaktok Word Cloudflare paid generation safety',()=>{
 it('reports paid generation off without disclosing keys',async()=>{
  const r=await worker.fetch(new Request(endpoint+'/health'),env)
  expect(r.status).toBe(200)
  const body=await r.json()
  expect(body.paidEnabled).toBe(false)
  expect(JSON.stringify(body)).not.toContain(secret)
 })
 it('rejects an unauthenticated job request before performing any D1/R2 operation',async()=>{
  const data=new Uint8Array(128);data.set([137,80,78,71])
  const r=await worker.fetch(new Request(endpoint+'/v1/jobs',{
   method:'POST',headers:{'content-length':'128'},
   body:data,
  }),env)
  expect(r.status).toBe(401)
  expect((await r.json()).error).toBe('unauthorized')
 })
 it('requires creator ownership even for status / result inspection',async()=>{
  const id='123e4567-e89b-42d3-a456-426614174000'
  const r=await worker.fetch(new Request(endpoint+'/v1/jobs/'+id),env)
  expect(r.status).toBe(401)
 })
 it('never presents vendor in-progress work as cancelled or refunded',async()=>{
  const id='123e4567-e89b-42d3-a456-426614174000'
  const expires=String(Math.floor(Date.now()/1000)+50)
  const path='/v1/jobs/'+id
  const signature=createHmac('sha256',secret)
   .update(['DELETE',path,owner,expires,'',''].join('\\n')).digest('hex')
  const database={
   prepare:()=>({bind:()=>({first:async()=>({
    id,status:'processing',source_key:'private/source',result_key:null,
   })})}),
  }
  const response=await worker.fetch(new Request(endpoint+path,{
   method:'DELETE',headers:{
    'x-word-owner':owner,'x-word-expires':expires,
    'x-word-signature':signature,
   },
  }),{...env,WORD_DB:database})
  expect(response.status).toBe(409)
  expect((await response.json()).error)
   .toBe('vendor_task_in_progress_cannot_cancel_or_refund')
 })
 it('rejects replay of same idempotency key with different source bytes',async()=>{
  const source=Buffer.alloc(128);source.set([137,80,78,71],0)
  const expires=String(Math.floor(Date.now()/1000)+50)
  const metadata={idempotency:'spaktokTestOnce0123',rights:'original',
   acceptTerms:true,confirmCharge:true,approvedCredits:.5,
   tier:'Gen-2.5-Medium',mesh:'Quad',quality:'medium',material:'PBR'}
  const info=Buffer.from(JSON.stringify(metadata)).toString('base64url')
  const digest=createHash('sha256').update(source).digest('hex')
  const payload=['POST','/v1/jobs',owner,expires,digest,info].join('\\n')
  const sig=createHmac('sha256',secret).update(payload).digest('hex')
  const response=await worker.fetch(new Request(endpoint+'/v1/jobs',{
   method:'POST',headers:{
    'content-length':'128','x-word-owner':owner,
    'x-word-expires':expires,'x-word-info':info,'x-word-signature':sig,
   },body:source,
  }),{...env,WORD_PAID_ENABLED:'true',RODIN_API_KEY:'test-not-real',
   RODIN_FIXED_JOB_CREDITS:'0.5',RODIN_DOWNLOAD_HOSTS:'cdn.example.org',
   WORD_DB:{prepare:()=>({bind:()=>({first:async()=>({
    id:'123e4567-e89b-42d3-a456-426614174000',
    status:'needs_review',source_sha256:'f'.repeat(64),
   })})})},
  })
  expect(response.status).toBe(409)
  expect((await response.json()).error)
   .toBe('idempotency_key_reused_for_different_image')
 })
 it('fails closed on genuine signed consent when operator paid gate is off',async()=>{
  const source=Buffer.alloc(128);source.set([137,80,78,71],0)
  const expires=String(Math.floor(Date.now()/1000)+50)
  const metadata={idempotency:'spaktokTestOnce0123',rights:'original',
   acceptTerms:true,confirmCharge:true,approvedCredits:.5,
   tier:'Gen-2.5-Medium',mesh:'Quad',quality:'medium',material:'PBR'}
  const info=Buffer.from(JSON.stringify(metadata)).toString('base64url')
  const digest=createHash('sha256').update(source).digest('hex')
  const payload=['POST','/v1/jobs',owner,expires,digest,info].join('\n')
  const sig=createHmac('sha256',secret).update(payload).digest('hex')
  const r=await worker.fetch(new Request(endpoint+'/v1/jobs',{
   method:'POST',headers:{
    'content-length':'128','x-word-owner':owner,
    'x-word-expires':expires,'x-word-info':info,'x-word-signature':sig,
   },body:source,
  }),env)
  expect(r.status).toBe(503)
  expect((await r.json()).error).toBe('paid_generation_disabled')
 })
})
