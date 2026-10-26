import {describe,expect,it} from 'vitest'
import {faceSvgPose,svgPoseTransform} from './svg-ar-overlay'
import type {FaceGeometry} from './renderer'
const face:FaceGeometry={
 leftEye:{x:.40,y:.39},rightEye:{x:.60,y:.39},
 center:{x:.5,y:.5},leftCheek:{x:.3,y:.54},rightCheek:{x:.7,y:.54},
 leftJaw:{x:.3,y:.64},rightJaw:{x:.7,y:.64},
 chin:{x:.5,y:.76},nose:{x:.5,y:.5},mouth:{x:.5,y:.64},
 leftBlush:{x:.32,y:.55},rightBlush:{x:.68,y:.55},
 mouthWidth:.12,width:.4
}
describe('SVG camera presentation coordinates',()=>{
 it('aligns crown highlights to camera cover crop',()=>{
  const pose=faceSvgPose(face,1280,720,360,640,false)
  expect(pose).not.toBeNull()
  expect(pose!.x).toBeCloseTo(180)
  expect(pose!.y).toBeCloseTo(249.6)
  expect(pose!.size).toBeGreaterThan(100)
  expect(svgPoseTransform(pose!)).toContain('translate(')
 })
 it('selfie mirror only flips horizontal position and rotation',()=>{
  const shifted={...face,leftEye:{x:.25,y:.35},rightEye:{x:.5,y:.43}}
  const a=faceSvgPose(shifted,1280,720,360,640,false)!
  const b=faceSvgPose(shifted,1280,720,360,640,true)!
  expect(a.x+b.x).toBeCloseTo(360)
  expect(a.y).toBeCloseTo(b.y)
  expect(a.rotationDeg).toBeCloseTo(-b.rotationDeg)
 })
 it('does not render without a face or valid camera metadata',()=>{
  expect(faceSvgPose(null,1280,720,360,640,false)).toBeNull()
  expect(faceSvgPose(face,0,720,360,640,false)).toBeNull()
 })
})
