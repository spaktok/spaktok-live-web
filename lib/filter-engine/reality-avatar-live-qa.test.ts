import {describe,it,expect} from 'vitest'
import {evaluateLiveFaceQA} from './reality-avatar-live-qa'
const frame=(i:number,overrides:Record<string,unknown>={})=>({
 timestampMs:i*80,inferenceMs:22,hasFace:true,validPose:true,
 blendshapeCount:52,...overrides,
})
describe('Reality avatar camera QA is evidence based',()=>{
 it('never approves without enough measured frames',()=>{
  expect(evaluateLiveFaceQA([frame(0)],51).verdict).toBe('insufficient')
 })
 it('marks measured stable tracking as review, not production certified',()=>{
  const result=evaluateLiveFaceQA(Array.from({length:120},(_,i)=>frame(i)),51)
  expect(result.verdict).toBe('review')
  expect(result.p95InferenceMs).toBe(22)
  expect(result.usableRate).toBe(1)
 })
 it('fails low detection, missing rig, and slow inference',()=>{
  const frames=Array.from({length:120},(_,i)=>frame(i,{
   hasFace:i<80,inferenceMs:i>100?120:20,
  }))
  const result=evaluateLiveFaceQA(frames,3)
  expect(result.verdict).toBe('fail')
  expect(result.warnings.length).toBeGreaterThanOrEqual(3)
 })
 it('rejects invalid samples and refuses to infer a benchmark',()=>{
  const result=evaluateLiveFaceQA([frame(0,{inferenceMs:NaN})],51)
  expect(result.samples).toBe(0)
  expect(result.p95InferenceMs).toBeNull()
 })
})
