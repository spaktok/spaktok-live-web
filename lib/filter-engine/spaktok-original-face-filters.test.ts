import {describe,expect,it} from 'vitest'
import {SPAKTOK_ORIGINAL_FACE_FINISHES,getOriginalFaceFinish,SPAKTOK_ORIGINAL_PACK_INFO} from './spaktok-original-face-filters'
import {LIVE_FILTER_IMPORT_BUDGET,reviewLiveFilterImport} from './spaktok-live-filter-import-qa'
import type {StudioGlbAudit} from './reality-production-glb-audit'
const valid:StudioGlbAudit={
 valid:true,selfContained:true,triangles:8000,materials:1,meshCount:1,
 primitives:1,textures:1,hasUV:true,hasNormals:true,hasPBR:true,
 rigTargets:0,animations:0,skins:0,requiredExtensions:[],warnings:[],
}
const candidate={
 fileBytes:2*1024*1024,glb:valid,
 textureFiles:[{bytes:200*1024,width:512,height:512}],
 license:{status:'original',source:'Spaktok Studio',evidence:'Original by Spaktok'},
} as const
describe('rights-safe mobile original filter pack',()=>{
 it('contains exactly 12 original PBR face presets without external downloads',()=>{
  expect(SPAKTOK_ORIGINAL_FACE_FINISHES).toHaveLength(12)
  expect(SPAKTOK_ORIGINAL_PACK_INFO.remoteGlbDownloads).toBe(0)
  expect(SPAKTOK_ORIGINAL_PACK_INFO.deviceCertified).toBe(false)
  expect(new Set(SPAKTOK_ORIGINAL_FACE_FINISHES.map(x=>x.id)).size).toBe(12)
  for(const look of SPAKTOK_ORIGINAL_FACE_FINISHES){
   expect(getOriginalFaceFinish(look.id)).toBe(look)
   expect(look.id.startsWith('3d-premium-')).toBe(true)
   for(const value of [
    look.metalness,look.roughness,look.clearcoat,look.subsurface,
    look.opacity,look.accentAmount,
   ])expect(value>=0&&value<=1).toBe(true)
  }
 })
 it('uses strict bounds inspired by TikTok Effect House optimization guidance',()=>{
  expect(LIVE_FILTER_IMPORT_BUDGET.maxPackageBytes).toBe(8*1024*1024)
  expect(LIVE_FILTER_IMPORT_BUDGET.maxImageSide).toBe(1024)
  expect(LIVE_FILTER_IMPORT_BUDGET.preferredStaticTriangles).toBe(12000)
  expect(LIVE_FILTER_IMPORT_BUDGET.targetFps).toBe(30)
 })
 it('can only advance vetted GLB candidates to device QA, never publish them',()=>{
  const reviewed=reviewLiveFilterImport(candidate)
  expect(reviewed.status).toBe('device-qa-required')
  expect(reviewed.published).toBe(false)
  expect(reviewed.deviceFpsVerified).toBe(false)
  expect(reviewed.tikTokCertified).toBe(false)
 })
 it('rejects unlicensed, oversized, untextured and heavy downloads',()=>{
  expect(reviewLiveFilterImport({
   ...candidate,license:{status:'unverified',source:'TikTok',evidence:''},
  }).status).toBe('blocked')
  expect(reviewLiveFilterImport({
   ...candidate,fileBytes:10*1024*1024,
  }).reasons).toContain('package_exceeds_8mb_or_invalid')
  expect(reviewLiveFilterImport({
   ...candidate,glb:{...valid,triangles:18000,hasNormals:false},
  }).status).toBe('blocked')
  expect(reviewLiveFilterImport({
   ...candidate,textureFiles:[{bytes:2*1024*1024,width:2048,height:2048}],
  }).status).toBe('blocked')
 })
 it('does not silently approve unsupported extensions',()=>{
  const status=reviewLiveFilterImport({
   ...candidate,glb:{...valid,requiredExtensions:['KHR_foo_bar']},
  })
  expect(status.status).toBe('device-qa-required')
  expect(status.reasons).toContain('extension_compatibility_device_qa_required')
 })
})
