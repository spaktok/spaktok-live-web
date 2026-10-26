import {describe,it,expect} from 'vitest'
import {coverCrop,maskCoordinates,drawFaceMask} from './face-overlay'
import {faceFxCatalog} from './params'
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
 it('renders every on-device lens as physical artwork, not a color filter',()=>{
   // Canvas API mock verifies all catalogue IDs reach drawing commands.
   for(const effect of faceFxCatalog.filter(x=>x.id!=='none'&&!x.id.startsWith('3d-'))){
     let draws=0
     const ctx=new Proxy({},{
       get(_target,name){
         if(name==='canvas')return{width:360,height:640}
         return (..._args:unknown[])=>{if(['ellipse','fill','stroke','fillRect','lineTo','bezierCurveTo'].includes(String(name)))draws++}
       },
       set(){return true},
     }) as unknown as CanvasRenderingContext2D
     const painted=drawFaceMask(ctx,{...face,expression:{mouthOpen:.75,leftEyeOpen:.75,rightEyeOpen:.85}},
       {id:effect.id,strength:1},720,1280,360,640,true,1.5)
     expect(painted,effect.id).toBe(true)
     expect(draws,effect.id).toBeGreaterThan(0)
   }
 })
 it('refuses degenerate camera frames and implausible landmarks',()=>{
   expect(coverCrop(0,1080,360,640)).toBeNull()
   expect(maskCoordinates({...face,width:0},720,1280,360,640)).toBeNull()
 })
})
