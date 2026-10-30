import {describe,it,expect} from 'vitest'
import {agentRequestSchema,agentStepSchema,normalizeAgentDecision,validateAgentStep,requiredAgentAction,creatorClarification,
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
 it('asks for one unambiguous material color before spending AI quota',()=>{
  expect(creatorClarification('غيّر لون المجسم')).toContain('ما اللون')
  expect(creatorClarification('اجعل المجسم أحمر وأزرق')).toContain('أكثر من لون')
  expect(creatorClarification('Färbe das GLB gelb')).toContain('ما اللون')
  expect(creatorClarification('أريد تغيير حجم المجسم')).toBeNull()
  expect(creatorClarification('Färbe dieses GLB blau für die Welt')).toBeNull()
 })
 it('enforces edit then inspect then dispatch then finish for a real GLB',()=>{
  const prompt='اجعل المجسم ذهبيا وصدّره كهدية'
  const base=req({prompt})
  const edit=step({action:'recolor_asset',targets:['gift'],color:'gold'})
  expect(requiredAgentAction(base)).toBe('recolor_asset')
  expect(validateAgentStep(step({action:'dispatch_asset',targets:['gift']}),base).reason)
   .toBe('required_next_action_recolor_asset')
  expect(validateAgentStep(edit,base).ok).toBe(true)
  const afterEdit=req({prompt,steps:[{action:'recolor_asset',ok:true,detail:'new GLB hash'}]})
  expect(requiredAgentAction(afterEdit)).toBe('inspect_asset')
  expect(validateAgentStep(step({action:'dispatch_asset',targets:['gift']}),afterEdit).reason)
   .toBe('required_next_action_inspect_asset')
  const afterAudit=req({prompt,steps:[...afterEdit.steps,
   {action:'inspect_asset',ok:true,detail:'GLB UV+PBR verified'}]})
  expect(requiredAgentAction(afterAudit)).toBe('dispatch_asset')
  const afterDispatch=req({prompt,steps:[...afterAudit.steps,
   {action:'dispatch_asset',ok:true,detail:'SHA256 verified in private store'}]})
  expect(requiredAgentAction(afterDispatch)).toBe('finish')
  expect(validateAgentStep(step({action:'finish',targets:['gift']}),afterDispatch).ok)
   .toBe(true)
 })
 it('enforces full 360 generation for a real image and no fake relief',()=>{
  const prompt='حوّل الصورة إلى أفاتار ثلاثي الأبعاد'
  const start=req({prompt,originalSource:'image',workingSource:'image'})
  expect(requiredAgentAction(start)).toBe('generate_3d_gpu')
  expect(validateAgentStep(step({action:'finish',targets:['avatar']}),start).reason)
   .toBe('cannot_claim_result_without_tool')
  const generated=req({prompt,originalSource:'image',workingSource:'glb',
   steps:[{action:'generate_3d_gpu',ok:true,detail:'generated GLB'}]})
  expect(requiredAgentAction(generated)).toBe('inspect_asset')
  const inspected=req({...generated,steps:[...generated.steps,
   {action:'inspect_asset',ok:true,detail:'valid 28000 triangles'}]})
  expect(requiredAgentAction(inspected)).toBe('dispatch_asset')
 })
 it('neutralizes a hallucinated Live destination when user asks only for a local result',()=>{
  const prompt='اجعل المجسم ذهبيًا فقط، لا ترسله إلى أي قسم'
  const corrected=normalizeAgentDecision(step({
   action:'present_asset',targets:['live'],color:null,
  }),prompt)
  expect(corrected.targets).toEqual(['world'])
  const state=req({prompt,steps:[
   {action:'recolor_asset',ok:true,detail:'real edited GLB'},
   {action:'inspect_asset',ok:true,detail:'verified GLB'},
  ]})
  expect(requiredAgentAction(state)).toBe('present_asset')
  expect(validateAgentStep(corrected,state).ok).toBe(true)
 })
 it('returns a real recolored file in chat without distributing it',()=>{
  const prompt='اجعل المجسم ذهبيًا'
  const steps=[
   {action:'recolor_asset' as const,ok:true,detail:'gold GLB created'},
   {action:'inspect_asset' as const,ok:true,detail:'QA valid'},
  ]
  const request=req({prompt,steps})
  expect(requiredAgentAction(request)).toBe('present_asset')
  expect(validateAgentStep(step({action:'dispatch_asset',targets:['world']}),request).reason)
   .toBe('required_next_action_present_asset')
  expect(validateAgentStep(step({action:'present_asset',targets:['world']}),request).ok)
   .toBe(true)
  const done=req({prompt,steps:[...steps,{
   action:'present_asset' as const,ok:true,detail:'only in chat',
  }]})
  expect(requiredAgentAction(done)).toBe('finish')
  expect(validateAgentStep(step({action:'finish',targets:['world']}),done).ok).toBe(true)
 })
 it('returns a generated 3D to chat when no studio was requested',()=>{
  const request=req({prompt:'حوّل هذه الصورة إلى مجسم ثلاثي الأبعاد',
   originalSource:'image',workingSource:'glb',steps:[
    {action:'generate_3d_gpu',ok:true,detail:'glb created'},
    {action:'inspect_asset',ok:true,detail:'QA good'},
   ]})
  expect(requiredAgentAction(request)).toBe('present_asset')
 })
 it('does not distribute merely because inspection mentions a target',()=>{
  const prompt='افحص المجسم للأفاتار فقط ولا ترسله'
  const request=req({prompt,steps:[{
   action:'inspect_asset',ok:true,detail:'QA good',
  }]})
  expect(requiredAgentAction(request)).toBe('finish')
 })
 it('permits an inspection-only user request without distributing media',()=>{
  const p=req({prompt:'افحص هذا الملف لمعرفة عدد المثلثات'})
  expect(requiredAgentAction(p)).toBe('inspect_asset')
  const done=req({prompt:p.prompt,steps:[
   {action:'inspect_asset',ok:true,detail:'23k triangles'},
  ]})
  expect(requiredAgentAction(done)).toBe('finish')
  expect(validateAgentStep(step({action:'dispatch_asset',targets:['world']}),done).reason)
   .toBe('required_next_action_finish')
 })
 it('executes a German World recolor with matching color and target',()=>{
  const prompt='Färbe dieses GLB blau für die Welt'
  const req1=req({prompt})
  expect(requiredAgentAction(req1)).toBe('recolor_asset')
  const normalized=normalizeAgentDecision(step({
   action:'recolor_asset',color:'blue',targets:['gift'],
  }),prompt)
  expect(normalized.targets).toEqual(['world'])
  expect(validateAgentStep(normalized,req1).ok).toBe(true)
 })
 it('aborts agent tool retries after a failed material edit',()=>{
  const prompt='اجعل المجسم ذهبيا'
  const p=req({prompt,steps:[{action:'recolor_asset',ok:false,detail:'GLB exporter failed'}]})
  expect(requiredAgentAction(p)).toBe('finish')
  expect(validateAgentStep(step({action:'recolor_asset',color:'gold'}),p).reason)
   .toBe('required_next_action_finish')
 })
 it('stops after a verified private fanout, rejecting all additional edits',()=>{
  const p=req({steps:[{action:'inspect_asset',ok:true,detail:'ok'},
   {action:'dispatch_asset',ok:true,detail:'SHA verified'}]})
  expect(requiredAgentAction(p)).toBe('finish')
 })
 it('permits a text-only missing-source response but not a fake file operation',()=>{
  const p=req({prompt:'اصنع لي شخصية 3D',originalSource:'none',workingSource:'none'})
  expect(requiredAgentAction(p)).toBe('finish')
  expect(validateAgentStep(step({action:'finish',targets:['avatar']}),p).ok).toBe(true)
 })
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
 it('respects a German all-except-Live request',()=>{
  const prompt='Sende an alle Bereiche außer Live'
  const p=req({prompt,steps:[{action:'inspect_asset',ok:true,detail:'verified'}]})
  const normalized=normalizeAgentDecision(step({
   action:'dispatch_asset',
   targets:['gift','gift','gift','gift','gift','gift'],
  }),prompt)
  expect(normalized.targets).toEqual(['avatar','filter','gift','world','video'])
  expect(validateAgentStep(normalized,p).ok).toBe(true)
 })
 it('clears unrequested color data from hallucinated non-recolor commands',()=>{
  const normalized=normalizeAgentDecision(step({
   action:'inspect_asset',targets:['world'],color:'green',
  }),'افحص GLB للعالم')
  expect(normalized.color).toBeNull()
 })
 it('never distributes to a studio explicitly excluded by the creator',()=>{
  const step0=step({action:'dispatch_asset',
   targets:['avatar','live','filter','gift','world','video']})
  const route=normalizeAgentDecision(step0,'أرسل المجسم إلى جميع الأقسام ما عدا اللايف')
  expect(route.targets).toEqual(['avatar','filter','gift','world','video'])
 })
 it('allows all departments EXCEPT Live when creator explicitly excludes it',()=>{
  const prompt='أرسل المجسم إلى جميع الأقسام ما عدا اللايف'
  const p=req({prompt,steps:[{action:'inspect_asset',ok:true,detail:'QA verified'}]})
  const normalized=normalizeAgentDecision(step({
   action:'dispatch_asset',targets:['gift','gift','gift','gift','gift','gift'],
  }),prompt)
  expect(normalized.targets).toEqual(['avatar','filter','gift','world','video'])
  expect(validateAgentStep(normalized,p).ok).toBe(true)
  expect(validateAgentStep(step({action:'dispatch_asset',
   targets:['avatar','live','filter','gift','world','video']}),p).reason)
   .toBe('all_studios_requested')
 })
 it('rejects unauthorized destinations even if model proposed them confidently',()=>{
  const p=req({prompt:'جهّز المجسم للعالم والفلاتر',
   steps:[{action:'inspect_asset',ok:true,detail:'passed'}]})
  expect(validateAgentStep(step({action:'dispatch_asset',
   targets:['avatar','filter','world']}),p).reason)
   .toBe('creator_destinations_mismatch')
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
