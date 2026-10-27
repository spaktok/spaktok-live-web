import {describe,expect,it} from 'vitest'
import {
 createStudioProductionPackage,withStudioProductionSource,
} from './reality-production-pipeline'
import {buildSpaktokWordPlan,executeWordParallelChecks} from './spaktok-word'

describe('Spaktok Word unified production graph',()=>{
 it('blocks external generation and release until owned source is reviewed',()=>{
  const p=withStudioProductionSource(createStudioProductionPackage(),
   'reference.png',5000,'image')
  const first=buildSpaktokWordPlan(p)
  expect(first.format).toBe('SpaktokWordPlan')
  expect(first.lanes.map(l=>l.id)).toHaveLength(11)
  expect(first.lanes.find(l=>l.id==='rights')?.status).toBe('blocked')
  expect(first.lanes.find(l=>l.id==='rodin')?.status).toBe('blocked')
  expect(first.lanes.find(l=>l.id==='release')?.status).toBe('blocked')
  expect(first.canPublish).toBe(false)
  const owned={...p,rights:'original' as const,
   tests:{...p.tests,sourceReviewed:true}}
  expect(buildSpaktokWordPlan(owned).lanes.find(l=>l.id==='rodin')?.status)
   .toBe('external')
  expect(buildSpaktokWordPlan(owned).canPublish).toBe(false)
 })
 it('detects GLB PBR, face rig, attachment and distinct local live shortcomings',()=>{
  const p=withStudioProductionSource(createStudioProductionPackage(),
   'rigged.glb',20000,'glb')
  const ready={...p,rights:'original' as const,
   tests:{sourceReviewed:true,animationVerified:true,mobileVisualApproved:true,
    deviceFpsVerified:true},
   metrics:{triangleCount:12000,materialCount:2,
    uvReady:true,normalReady:true,pbrReady:true,
    textureCount:2,rigTargets:52,animationCount:1,
    selfContained:true,validated:true}}
  const plan=buildSpaktokWordPlan(ready)
  for(const lane of ['source','rights','geometry','materials','facial-rig',
   'placement','camera','video']){
   expect(plan.lanes.find(l=>l.id===lane)?.status).toBe('ready')
  }
  expect(plan.lanes.find(l=>l.id==='live')?.status).toBe('manual')
  expect(plan.lanes.find(l=>l.id==='release')?.status).toBe('blocked')
  expect(plan.canPublish).toBe(false)
 })
 it('cannot mark a face-mask rigged merely because a GLB contains geometry',()=>{
  const p=withStudioProductionSource(createStudioProductionPackage(),
   'face.glb',12000,'glb')
  const plan=buildSpaktokWordPlan({...p,rights:'original',
   metrics:{...p.metrics,validated:true,triangleCount:1400}})
  expect(plan.lanes.find(x=>x.id==='facial-rig')?.status).toBe('manual')
  expect(plan.lanes.find(x=>x.id==='camera')?.status).toBe('manual')
 })
 it('reports failures independently and starts independent async work concurrently',async()=>{
  const events:string[]=[]
  let finishA!:()=>void
  const a=new Promise<void>(resolve=>{finishA=resolve})
  const running=executeWordParallelChecks([
   {id:'metadata',label:'A',run:async()=>{events.push('A-start');await a;return 'done'}},
   {id:'sha256',label:'B',run:async()=>{events.push('B-start');throw Error('unavailable')}},
  ],r=>events.push('finish-'+r.id))
  expect(events).toEqual(['A-start','B-start'])
  finishA()
  const results=await running
  expect(results.map(x=>x.status)).toEqual(['passed','failed'])
  expect(results[1].detail).toContain('unavailable')
  expect(events).toContain('finish-metadata')
  expect(events).toContain('finish-sha256')
 })
 it('rejects repeated job identifiers so status cards cannot impersonate each other',async()=>{
  await expect(executeWordParallelChecks([
   {id:'metadata',label:'first',run:async()=>''},
   {id:'metadata',label:'second',run:async()=>''},
  ])).rejects.toThrow('spaktok_word_duplicate_job')
 })
})
