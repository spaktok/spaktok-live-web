import {describe,expect,it} from 'vitest'
import {
 createRodinGenerationDraft,parseRodinSubmission,evaluateRodinStatuses,
 RODIN_WORKSPACE_URL,
} from './reality-rodin-integration'
const options={
 assetType:'full-avatar' as const,rights:'original' as const,
 filenames:['owned_front.png'],tier:'Gen-2.5-Medium' as const,
 mesh:'Quad' as const,quality:'medium' as const,material:'PBR' as const,
}
describe('Rodin optional provider safety and production handoff',()=>{
 it('builds a draft without uploads, keys, automatic credits or fake rig promises',()=>{
  const x=createRodinGenerationDraft(options)
  expect(x.provider).toBe('hyper3d-rodin')
  expect(x.stage).toBe('not-submitted')
  expect(x.requiresExplicitUploadConsent).toBe(true)
  expect(x.geometry_file_format).toBe('glb')
  expect(x.indicativeBaseCredits).toBe(.5)
  expect(x.qualityGate.some(t=>t.includes('blendshape'))).toBe(true)
  expect(JSON.stringify(x)).not.toMatch(/Bearer|secret|subscription_key/)
  expect(RODIN_WORKSPACE_URL).toContain('hyper3d.ai')
 })
 it('does not prepare generation from unverified rights or invalid image sources',()=>{
  expect(()=>createRodinGenerationDraft({...options,rights:'unverified'}))
   .toThrow('rodin_rights_not_verified')
  expect(()=>createRodinGenerationDraft({...options,filenames:[]}))
   .toThrow('rodin_invalid_reference_files')
  expect(()=>createRodinGenerationDraft({...options,filenames:Array(6).fill('a.png')}))
   .toThrow('rodin_invalid_reference_files')
  expect(()=>createRodinGenerationDraft({...options,filenames:['..\\danger.png']}))
   .toThrow('rodin_invalid_reference_files')
 })
 it('maps wearable to mobile AR accessory settings',()=>{
  const x=createRodinGenerationDraft({...options,assetType:'wearable'})
  expect(x.intent).toBe('accessory')
  expect(x.qualityGate.some(s=>s.includes('AR mount'))).toBe(true)
 })
 it('rejects vendor HTTP-201 errors and missing task identifiers',()=>{
  expect(()=>parseRodinSubmission({error:'API_INSUFFICIENT_FUNDS'}))
   .toThrow('rodin_provider_rejected')
  expect(()=>parseRodinSubmission({uuid:'some',jobs:{subscription_key:'secret'}}))
   .toThrow('rodin_submission_missing_identifiers')
  const x=parseRodinSubmission({
   uuid:'123e4567-e89b-12d3-a456-426614174000',
   jobs:{subscription_key:'subscription-key-private'},
  })
  expect(x.subscriptionKey).toBe('subscription-key-private')
 })
 it('waits for all jobs and fails fast on any failed job',()=>{
  expect(evaluateRodinStatuses({jobs:[{status:'Done'},{status:'Waiting'}]}))
   .toBe('pending')
  expect(evaluateRodinStatuses({jobs:[{status:'Done'},{status:'Done'}]}))
   .toBe('complete')
  expect(evaluateRodinStatuses({jobs:[{status:'Done'},{status:'Failed'}]}))
   .toBe('failed')
  expect(()=>evaluateRodinStatuses({jobs:[]})).toThrow('rodin_status_no_jobs')
  expect(()=>evaluateRodinStatuses({error:'NO_SUCH_TASK'}))
   .toThrow('rodin_provider_status_error')
 })
})
