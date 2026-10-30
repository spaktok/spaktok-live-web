import {describe,expect,it} from 'vitest'
import {
 avatarLandmarkExpression,avatarLuminance,chooseAvatarTrackerIssue,
 avatarTrackingIssueArabic,
} from './reality-avatar-detection'
const points=()=>{
 const a=Array.from({length:478},()=>({x:.5,y:.5,z:0}))
 const set=(i:number,x:number,y:number)=>{a[i]={x,y,z:0}}
 set(33,.3,.4);set(133,.4,.4);set(159,.35,.385);set(145,.35,.415)
 set(362,.6,.4);set(263,.7,.4);set(386,.65,.385);set(374,.65,.415)
 set(61,.42,.65);set(291,.58,.65);set(13,.5,.645);set(14,.5,.655)
 return a
}
describe('Live avatar on-device diagnostic and no-coefficient expression fallback',()=>{
 it('reads a bright neutral frame and identifies low light',()=>{
  expect(avatarLuminance(new Uint8Array([255,255,255,255,0,0,0,255]))).toBeCloseTo(127.5,10)
  expect(avatarLuminance(new Uint8Array([0,0,0,0]))).toBeNull()
  expect(avatarLuminance(new Uint8Array([255,255,255]))).toBeNull()
  expect(chooseAvatarTrackerIssue({videoReady:true,hasFace:false,poseValid:false,brightness:25,inferenceFailed:false})).toBe('too-dark')
  expect(avatarTrackingIssueArabic['too-dark']).toContain('الإضاءة')
 })
 it('distinguishes camera failure, inference crash, missing face and bad pose',()=>{
  const base={videoReady:true,hasFace:false,poseValid:false,brightness:100,inferenceFailed:false}
  expect(chooseAvatarTrackerIssue({...base,videoReady:false})).toBe('no-video')
  expect(chooseAvatarTrackerIssue({...base,inferenceFailed:true})).toBe('model-error')
  expect(chooseAvatarTrackerIssue(base)).toBe('no-face')
  expect(chooseAvatarTrackerIssue({...base,hasFace:true})).toBe('pose-unavailable')
  expect(chooseAvatarTrackerIssue({...base,hasFace:true,poseValid:true})).toBe('ok')
 })
 it('infers blink/jaw when MediaPipe blendshape array is empty',()=>{
  const p=points()
  const a=avatarLandmarkExpression(p,1)!
  expect(a).not.toBeNull()
  expect(a.eyeBlinkLeft).toBeLessThan(.3)
  const closed=points()
  closed[145]={x:.35,y:.386,z:0}
  const b=avatarLandmarkExpression(closed,1)!
  expect(b.eyeBlinkLeft).toBeGreaterThan(a.eyeBlinkLeft)
  const jaw=points()
  jaw[14]={x:.5,y:.70,z:0}
  const c=avatarLandmarkExpression(jaw,1)!
  expect(c.jawOpen).toBeGreaterThan(a.jawOpen)
 })
 it('rejects missing landmarks and malformed sizes',()=>{
  expect(avatarLandmarkExpression(points().slice(0,100),1)).toBeNull()
  expect(avatarLandmarkExpression(points(),-1)).toBeNull()
  const missing=points();missing[13]={x:NaN,y:1,z:0}
  expect(avatarLandmarkExpression(missing,1)).toBeNull()
 })
})
