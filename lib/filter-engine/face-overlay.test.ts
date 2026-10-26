import {describe,it,expect} from 'vitest'
import {coverCrop,maskCoordinates} from './face-overlay'
import type {FaceGeometry} from './renderer'
const face:FaceGeometry={
 leftEye:{x:.38,y:.39},rightEye:{x:.62,y:.39},
 center:{x:.5,y:.5},leftCheek:{x:.29,y:.53},rightCheek:{x:.71,y:.53},
 leftJaw:{x:.34,y:.64},rightJaw:{x:.66,y:.64},
 chin:{x:.5,y:.76},nose:{x:.5,y:.51},mouth:{x:.5,y:.62},
 leftBlush:{x:.35,y:.55},rightBlush:{x:.65,y:.55},
 mouthWidth:.12,width:.42
}
describe('native video face AR alignment',()=>{
 it('matches CSS object-fit cover on tall screens',()=>{
   expect(coverCrop(1280,720,360,640)).toEqual({x:-388.8888888888889,y:0,w:1137.7777777777778,h:640,scale:8/9})
 })
 it('keeps face center on its real position after crop',()=>{
   const m=maskCoordinates(face,1280,720,360,640)
   expect(m).not.toBeNull()
   expect(m!.center.x).toBeCloseTo(180)
   expect(m!.center.y).toBeCloseTo(249.6)
   expect(m!.size).toBeGreaterThan(100)
 })
 it('refuses degenerate camera frames and implausible landmarks',()=>{
   expect(coverCrop(0,1080,360,640)).toBeNull()
   expect(maskCoordinates({...face,width:0},720,1280,360,640)).toBeNull()
 })
})
