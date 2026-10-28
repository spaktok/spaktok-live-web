import {describe,expect,it} from 'vitest'
import {
 MEDIAPIPE_FACE_BLENDSHAPES,neutralFaceChannelFrame,
 faceChannelFrameFromMediaPipe,faceChannelFrameFromStarter,
 smoothFaceChannelFrame,getFullFaceMorphBindings,inspectFullFaceRig,
} from './reality-avatar-full-retarget'
import {NEUTRAL_AVATAR_EXPRESSION} from './reality-avatar-retarget'

describe('MediaPipe 52 blendshape -> full GLB facial retargeting',()=>{
 it('uses the official 52 labels exactly once; neutral is not a deforming target',()=>{
  expect(MEDIAPIPE_FACE_BLENDSHAPES).toHaveLength(52)
  expect(new Set(MEDIAPIPE_FACE_BLENDSHAPES).size).toBe(52)
  expect(MEDIAPIPE_FACE_BLENDSHAPES[0]).toBe('_neutral')
  expect(Object.keys(neutralFaceChannelFrame())).toHaveLength(51)
  expect('_neutral' in neutralFaceChannelFrame()).toBe(false)
 })
 it('maps all authored canonical rig targets and reports 51/51 coverage',()=>{
  const dictionary=Object.fromEntries(
   MEDIAPIPE_FACE_BLENDSHAPES.slice(1).map((name,index)=>[name,index])
  )
  const bindings=getFullFaceMorphBindings(dictionary)
  expect(bindings).toHaveLength(51)
  expect(new Set(bindings.map(x=>x.index)).size).toBe(51)
  expect(bindings.find(x=>x.key==='jawOpen')?.index).toBe(24)
  const report=inspectFullFaceRig([dictionary])
  expect(report.supported).toBe(51)
  expect(report.missing).toHaveLength(0)
  expect(report.level).toBe('complete')
 })
 it('treats neutral, bad coefficients and unavailable channels as zero',()=>{
  const frame=faceChannelFrameFromMediaPipe({
   _neutral:1,eyeBlinkLeft:1.9,eyeBlinkRight:-2,jawOpen:NaN,
   cheekPuff:.65,noseSneerRight:Infinity,mouthLowerDownLeft:.42,
  })
  expect(frame.eyeBlinkLeft).toBe(1)
  expect(frame.eyeBlinkRight).toBe(0)
  expect(frame.jawOpen).toBe(0)
  expect(frame.cheekPuff).toBe(.65)
  expect(frame.mouthLowerDownLeft).toBe(.42)
  expect(frame.noseSneerRight).toBe(0)
  expect(faceChannelFrameFromMediaPipe(null)).toEqual(neutralFaceChannelFrame())
 })
 it('maps 7-channel procedural calibration without inventing 44 targets',()=>{
  const starter=faceChannelFrameFromStarter({
   ...NEUTRAL_AVATAR_EXPRESSION,jawOpen:.8,eyeBlinkLeft:.3,
  })
  expect(starter.jawOpen).toBe(.8)
  expect(starter.eyeBlinkLeft).toBe(.3)
  expect(starter.cheekPuff).toBe(0)
  expect(starter.mouthFunnel).toBe(0)
  const halfway=smoothFaceChannelFrame(neutralFaceChannelFrame(),starter,.5)
  expect(halfway.jawOpen).toBeCloseTo(.4)
  expect(halfway.eyeBlinkLeft).toBeCloseTo(.15)
  expect(smoothFaceChannelFrame(halfway,neutralFaceChannelFrame(),1).jawOpen).toBe(0)
 })
 it('recognizes VRM aliases while avoiding indices matched by canonical targets',()=>{
  const bindings=getFullFaceMorphBindings({
   eyeBlinkLeft:0,blink_L:0,eyeBlink_R:1,
   mouthOpen:3,mouthSmile_L:4,mouthPout:5,
   cheekPuff:6,'_neutral':7,unused:8,
   bogus:Infinity,illegal:-1,
  })
  expect(bindings.find(x=>x.key==='eyeBlinkLeft')?.index).toBe(0)
  expect(bindings.find(x=>x.key==='eyeBlinkRight')?.index).toBe(1)
  expect(bindings.find(x=>x.key==='jawOpen')?.index).toBe(3)
  expect(bindings.find(x=>x.key==='cheekPuff')?.index).toBe(6)
  expect(new Set(bindings.map(x=>x.index)).size).toBe(bindings.length)
  expect(bindings.some(x=>x.target==='_neutral')).toBe(false)
  expect(inspectFullFaceRig([{eyeBlinkLeft:0,jawOpen:1}]).level).toBe('starter')
 })
})
