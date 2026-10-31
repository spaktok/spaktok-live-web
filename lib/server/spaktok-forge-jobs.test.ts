import {describe,expect,it} from 'vitest'
import {
 forgeJobsBase,parseForgeGpuJobStatus,signForgeJobHandle,
 signForgeJobReadTicket,verifyForgeJobHandle,
} from './spaktok-forge-jobs'

const secret='k'.repeat(48)
const jobId='AbCdEfGhIjKlMnOpQrStUvWx'
const now=1_800_000_000

describe('forge async job handles',()=>{
 it('round-trips only for the owning user',()=>{
  const h=signForgeJobHandle(secret,{jobId,uid:'user-1',profile:'studio-ultra'},now)
  expect(verifyForgeJobHandle(secret,h,'user-1',now+10))
   .toEqual({jobId,profile:'studio-ultra'})
  expect(verifyForgeJobHandle(secret,h,'user-2',now+10)).toBeNull()
 })
 it('rejects expired, tampered and wrong-secret handles',()=>{
  const h=signForgeJobHandle(secret,{jobId,uid:'u',profile:'studio-hd'},now)
  expect(verifyForgeJobHandle(secret,h,'u',now+3601)).toBeNull()
  expect(verifyForgeJobHandle('x'.repeat(48),h,'u',now)).toBeNull()
  const [p,b,s]=h.split('.')
  expect(verifyForgeJobHandle(secret,[p,b,s.slice(0,-2)+'AA'].join('.'),'u',now)).toBeNull()
 })
 it('does not accept a read ticket as a handle (domain separation)',()=>{
  const t=signForgeJobReadTicket(secret,{jobId,origin:'https://a.example.org'},now)
  expect(verifyForgeJobHandle(secret,t.replace(/^sj1/,'sh1'),'u',now)).toBeNull()
 })
 it('refuses invalid job ids and non-https origins',()=>{
  expect(()=>signForgeJobHandle(secret,{jobId:'../x',uid:'u',profile:'studio-hd'})).toThrow()
  expect(()=>signForgeJobReadTicket(secret,{jobId,origin:'http://a'})).toThrow()
 })
 it('derives jobs base from the pinned generate URL',()=>{
  expect(forgeJobsBase('https://gpu.example.org/v1/generate'))
   .toBe('https://gpu.example.org/v1/jobs')
 })
 it('sanitizes upstream status',()=>{
  expect(parseForgeGpuJobStatus({id:jobId,state:'failed',error:'Traceback /root/x'})?.error)
   .toBe('inference_exception')
  expect(parseForgeGpuJobStatus({id:'bad id',state:'queued'})).toBeNull()
  expect(parseForgeGpuJobStatus({id:jobId,state:'hacked'})).toBeNull()
 })
})

import {sniffForgeMesh,signForgeJobHandle as signH,verifyForgeJobHandle as verifyH} from './spaktok-forge-jobs'
describe('retexture contract',()=>{
 const glb=(n:number,v=2)=>{const b=new Uint8Array(n);b.set([0x67,0x6c,0x54,0x46]);const d=new DataView(b.buffer);d.setUint32(4,v,true);d.setUint32(8,n,true);return b}
 it('sniffs GLB v2 with exact length and PLY only',()=>{
  expect(sniffForgeMesh(glb(128))).toBe('glb')
  expect(sniffForgeMesh(glb(128,1))).toBeNull()
  const bad=glb(128);new DataView(bad.buffer).setUint32(8,999,true)
  expect(sniffForgeMesh(bad)).toBeNull()
  expect(sniffForgeMesh(new TextEncoder().encode('ply\n'+'x'.repeat(80)))).toBe('ply')
  expect(sniffForgeMesh(new TextEncoder().encode('obj '+'x'.repeat(80)))).toBeNull()
 })
 it('signs retexture handles',()=>{
  const s='s'.repeat(40)
  const h=signH(s,{jobId:'a'.repeat(24),uid:'u1',profile:'retexture'})
  expect(verifyH(s,h,'u1')?.profile).toBe('retexture')
 })
})
