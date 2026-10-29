import {describe,it,expect} from 'vitest'
import {agentRequestSchema,agentStepSchema,normalizeAgentDecision,validateAgentStep,
 type AgentRequest,type AgentStep} from './spaktok-director-agent-contract'
const req=(patch:Partial<AgentRequest>={}):AgentRequest=>({
 prompt:'أرسل المجسم إلى جميع الأقسام',
 originalSource:'glb',workingSource:'glb',history:[],steps:[],imagePreview:null,
 ...patch,
})
const step=(patch:Partial<AgentStep>={}):AgentStep=>({
 action:'inspect_asset',targets:['world'],color:null,message:'أفحص المجسم',
 ...patch,
})
describe('Real Spaktok AI tool execution guards',()=>{
 it('accepts a legitimate GLB inspect followed by all-six-studios dispatch',()=>{
  const p=req({steps:[{action:'inspect_asset',ok:true,detail:'QA passed'}]})
  const s=step({action:'dispatch_asset',targets:['avatar','live','filter','gift','world','video']})
  expect(validateAgentStep(s,p).ok).toBe(true)
 })
 it('repairs a REAL observed free Llama duplicate-target hallucination',()=>{
  // Llama returned six copies of gift for an all-departments request.
  const hallucinated=step({action:'inspect_asset',
   targets:['gift','gift','gift','gift','gift','gift'],
   color:null,message:'تم إرسال المجسم إلى جميع الأقسام'})
  const normalized=normalizeAgentDecision(hallucinated,
   'أرسل المجسم إلى جميع الأقسام')
  expect(normalized.targets).toEqual([
   'avatar','live','filter','gift','world','video',
  ])
  expect(validateAgentStep(normalized,req()).ok).toBe(true)
 })
 it('preserves exactly the two specialized departments user explicitly asked for',()=>{
  const normalized=normalizeAgentDecision(step({
   action:'dispatch_asset',targets:['gift','gift'],
  }), 'جهّز المجسم للعالم والفلاتر')
  expect(normalized.targets).toEqual(['filter','world'])
 })
 it('prevents AI from dropping targets when user requests all studios',()=>{
  const p=req({steps:[{action:'inspect_asset',ok:true,detail:'verified'}]})
  expect(validateAgentStep(step({action:'dispatch_asset',targets:['world']}),p).reason)
   .toBe('all_studios_requested')
 })
 it('denies silent 2.5D downgrade from full 360 requests',()=>{
  const p=req({prompt:'أريد شخصية كاملة 360',originalSource:'image',workingSource:'image'})
  expect(validateAgentStep(step({action:'generate_relief'}),p).ok).toBe(false)
 })
 it('denies paid GPU when relief was explicitly requested',()=>{
  const p=req({prompt:'اصنع 2.5D بارز',originalSource:'image',workingSource:'image'})
  expect(validateAgentStep(step({action:'generate_3d_gpu'}),p).ok).toBe(false)
 })
 it('denies repeated GPU spend even if the previous call failed',()=>{
  const p=req({prompt:'اصنع شخصية 360',originalSource:'image',workingSource:'image',
   steps:[{action:'generate_3d_gpu',ok:false,detail:'network error'}]})
  expect(validateAgentStep(step({action:'generate_3d_gpu'}),p).ok).toBe(false)
 })
 it('rejects inventing material edits not in the creator instruction',()=>{
  const p=req({prompt:'اجعل المجسم أزرق'})
  expect(validateAgentStep(step({action:'recolor_asset',color:'gold'}),p).ok).toBe(false)
  expect(validateAgentStep(step({action:'recolor_asset',color:'blue'}),p).ok).toBe(true)
 })
 it('rejects made-up tools and injected extras',()=>{
  expect(agentStepSchema.safeParse({...step(),action:'delete_accounts'}).success).toBe(false)
  expect(agentStepSchema.safeParse({...step(),code:'eval(...)'}).success).toBe(false)
 })
 it('rejects oversized image payloads and oversized observation history',()=>{
  expect(agentRequestSchema.safeParse(req({imagePreview:'x'.repeat(231000)})).success).toBe(false)
  expect(agentRequestSchema.safeParse(req({steps:Array.from({length:7},()=>({
   action:'inspect_asset',ok:true,detail:'passed',
  }))})).success).toBe(false)
 })
 it('refuses to claim a generated model is delivered without handoff',()=>{
  const p=req({prompt:'اصنع شخصية 3D وأرسلها للأفاتار',
   originalSource:'image',workingSource:'glb',
   steps:[{action:'generate_3d_gpu',ok:true,detail:'real GLB'}]})
  expect(validateAgentStep(step({action:'finish'}),p).reason)
   .toBe('generated_file_must_be_delivered')
 })
 it('refuses unrequested extra tool calls after a successful handoff',()=>{
  const p=req({steps:[{action:'inspect_asset',ok:true,detail:'ok'},
   {action:'dispatch_asset',ok:true,detail:'signed'}]})
  expect(validateAgentStep(step({action:'recolor_asset',color:'gold'}),p).reason)
   .toBe('dispatch_already_complete')
 })
 it('refuses repeated inspection of an unchanged GLB',()=>{
  expect(validateAgentStep(step(),req({steps:[{
   action:'inspect_asset',ok:true,detail:'passed',
  }]})).reason).toBe('already_inspected_unchanged_asset')
 })
})
