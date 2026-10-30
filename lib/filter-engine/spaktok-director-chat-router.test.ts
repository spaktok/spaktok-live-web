import {describe,it,expect} from 'vitest'
import {DIRECTOR_TARGETS} from './spaktok-ai-director'
import {
 routeDirectorChat,directorChatReplyForTargets,requiresSeparatePublishingReview,
} from './spaktok-director-chat-router'

describe('AI Director single-chat specialist orchestration',()=>{
 it('recognizes Arabic all departments and dispatches all six as one GLB job',()=>{
  const r=routeDirectorChat('أرسل المجسم إلى جميع الأقسام','glb')
  expect(r.targets).toEqual(DIRECTOR_TARGETS)
  expect(r.execution).toBe('existing-glb')
  expect(r.needsPaidCompute).toBe(false)
 })
 it('routes explicit filters, gifts, world and video without five navigation clicks',()=>{
  const r=routeDirectorChat('اجعل المجسم هدية وفلتر وعناصر للعالم والفيديو','glb')
  expect(r.targets).toEqual(['filter','gift','world','video'])
  expect(r.execution).toBe('existing-glb')
 })
 it('never silently calls 2.5D full 360 or spends GPU on image requests',()=>{
  const r=routeDirectorChat('حوّل صورة إلى شخصية 3D للأفاتار واللايف','image')
  expect(r.targets).toEqual(['avatar','live'])
  expect(r.execution).toBe('gpu-360')
  expect(r.wants360).toBe(true)
  expect(r.needsPaidCompute).toBe(true)
 })
 it('only uses free local relief when specifically requested',()=>{
  const r=routeDirectorChat('اصنع 2.5D بارز للفلتر','image')
  expect(r.targets).toEqual(['filter'])
  expect(r.execution).toBe('local-relief')
  expect(r.wants360).toBe(false)
 })
 it('requires real source for text-only 3D requests',()=>{
  const r=routeDirectorChat('اصنع هدية ثلاثية الأبعاد','none')
  expect(r.execution).toBe('needs-file')
  expect(r.targets).toEqual(['gift'])
 })
 it('defaults a decorative object to World, a human to Avatar',()=>{
  expect(routeDirectorChat('أريد تاجًا ثلاثي الأبعاد','glb').targets).toEqual(['world'])
  expect(routeDirectorChat('هذه شخصية لرجل','glb').targets).toEqual(['avatar'])
 })
 it('does not implicitly approve publishing requested in natural language',()=>{
  expect(requiresSeparatePublishingReview('انشر الهدية للجمهور')).toBe(true)
  expect(requiresSeparatePublishingReview('جهز معاينة خاصة')).toBe(false)
  expect(directorChatReplyForTargets(['avatar','live'])).toContain('الأفاتار')
 })
})
