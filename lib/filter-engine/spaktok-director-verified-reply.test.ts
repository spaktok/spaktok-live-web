import {describe,it,expect} from 'vitest'
import {verifiedDirectorReply} from './spaktok-director-verified-reply'
import type {AgentAssetResult} from './spaktok-director-agent-client'
import type {AgentEvent} from './spaktok-director-agent-contract'
const asset={
 file:{size:2842496},
 qa:{triangles:28379},
 manifest:{source:{sha256:'a'.repeat(64)}},
 handoffStored:true,
 dispatch:{publication:'private-draft',
  steps:[{target:'world'},{target:'gift'}]},
} as unknown as AgentAssetResult
const success:AgentEvent[]=[
 {action:'recolor_asset',ok:true,detail:'gold output'},
 {action:'inspect_asset',ok:true,detail:'UV/PBR and triangles checked'},
 {action:'dispatch_asset',ok:true,detail:'SHA256 verified'},
]
describe('Spaktok AI Director must report only verified results',()=>{
 it('does not repeat a model hallucination; includes evidence-backed results',()=>{
  const text=verifiedDirectorReply(asset,success)
  expect(text).toContain('تعديل خامة')
  expect(text).toContain('28379')
  expect(text).toContain('world')
  expect(text).toContain('gift')
  expect(text).toContain('لم تُنفَّذ')
 })
 it('does not report successful asset delivery if dispatch was never done',()=>{
  const message=verifiedDirectorReply(asset,success.slice(0,2))
  expect(message).toContain('لم يكتمل التحقق')
  expect(message).not.toContain('تم فحص GLB وحفظ المسودة')
 })
 it('shows edited GLB to the creator without claiming distribution',()=>{
  const preview={...asset,handoffStored:false} as AgentAssetResult
  const acts:AgentEvent[]=[
   {action:'recolor_asset',ok:true,detail:'gold GLB'},
   {action:'inspect_asset',ok:true,detail:'QA passed'},
   {action:'present_asset',ok:true,detail:'local preview only'},
  ]
  const result=verifiedDirectorReply(preview,acts)
  expect(result).toContain('لم يُوزَّع')
  expect(result).not.toContain('حفظ المسودة الخاصة لـ')
 })
 it('clearly explains an actual failed tool instead of a fake success',()=>{
  const message=verifiedDirectorReply(null,[
   {action:'recolor_asset',ok:false,detail:'texture export blocked'},
  ])
  expect(message).toContain('لم تكتمل')
  expect(message).toContain('texture export blocked')
 })
 it('does not send a valid inspection-only file to any department',()=>{
  const message=verifiedDirectorReply(null,[{
   action:'inspect_asset',ok:true,detail:'valid mesh',
  }])
  expect(message).toContain('الفحص البنيوي')
  expect(message).toContain('لا توجد')
 })
 it('does not claim a product from an empty tool history',()=>{
  expect(verifiedDirectorReply(null,[])).toContain('لم أنشئ')
 })
})
