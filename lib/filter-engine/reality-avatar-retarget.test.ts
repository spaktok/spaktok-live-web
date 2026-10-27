import {describe,expect,it} from 'vitest'
import {
 avatarExpressionFromMediaPipe,avatarPoseFromLandmarks,
 getAvatarMorphBindings,NEUTRAL_AVATAR_EXPRESSION,
 smoothAvatarExpression,hasExpressiveAvatarTargets,
} from './reality-avatar-retarget'
describe('Reality Studio avatar live facial retargeting',()=>{
 it('maps measured MediaPipe blendshape coefficients to rig channels',()=>{
  expect(avatarExpressionFromMediaPipe({
   jawOpen:.75,eyeBlinkLeft:.92,eyeBlinkRight:1.2,
   mouthSmileLeft:.42,mouthSmileRight:.38,browInnerUp:.19,
   mouthPucker:-5,
  })).toEqual({
   jawOpen:.75,eyeBlinkLeft:.92,eyeBlinkRight:1,
   mouthSmileLeft:.42,mouthSmileRight:.38,browInnerUp:.19,
   mouthPucker:0,
  })
 })
 it('treats missing/invalid inputs as neutral, not an invented smile',()=>{
  expect(avatarExpressionFromMediaPipe(null)).toEqual(NEUTRAL_AVATAR_EXPRESSION)
  expect(avatarExpressionFromMediaPipe({jawOpen:Infinity,eyeBlinkLeft:NaN}))
   .toEqual(NEUTRAL_AVATAR_EXPRESSION)
 })
 it('retargets ARKit names and a small family of normalized GLB aliases without duplicates',()=>{
  const bindings=getAvatarMorphBindings({
   'jawOpen':0,'eyeBlink_L':1,'eyeBlink_R':2,
   'mouthSmileLeft':3,'mouthSmileRight':4,'viseme_O':5,'unsupported':9,
  })
  expect(bindings.map(x=>x.index)).toEqual([0,1,2,3,4,5])
  expect(hasExpressiveAvatarTargets([{'jawOpen':0,'blink_L':1,'blink_R':2}]))
   .toBe(true)
  expect(hasExpressiveAvatarTargets([{mouthOpen:0}])).toBe(false)
  expect(getAvatarMorphBindings({jawOpen:-1,eyeBlinkLeft:Infinity}))
   .toEqual([])
 })
 it('smooths outputs but keeps neutral frame available for tracking loss',()=>{
  const next=avatarExpressionFromMediaPipe({jawOpen:1,eyeBlinkLeft:1})
  const halfway=smoothAvatarExpression(NEUTRAL_AVATAR_EXPRESSION,next,.5)
  expect(halfway.jawOpen).toBe(.5)
  expect(halfway.eyeBlinkLeft).toBe(.5)
  expect(halfway.eyeBlinkRight).toBe(0)
 })
 it('uses each tracked face measurements for pose and rejects incomplete points',()=>{
  const face=Array.from({length:478},()=>({x:.5,y:.5,z:0}))
  face[33]={x:.35,y:.42,z:0}
  face[263]={x:.65,y:.42,z:0}
  face[4]={x:.51,y:.57,z:0}
  face[168]={x:.5,y:.37,z:0}
  face[152]={x:.5,y:.78,z:0}
  face[1]={x:.5,y:.58,z:0}
  const pose=avatarPoseFromLandmarks(face,true)
  expect(pose).not.toBeNull()
  expect(Math.abs(pose!.roll)).toBeLessThan(.01)
  expect(pose!.pitch).toBeLessThan(.5)
  expect(avatarPoseFromLandmarks(face.slice(0,50))).toBeNull()
  const broken=[...face];broken[4]={x:NaN,y:.5,z:0}
  expect(avatarPoseFromLandmarks(broken)).toBeNull()
 })
})
