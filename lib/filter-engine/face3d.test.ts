import {describe,expect,it} from 'vitest'
import {FaceLandmarker} from '@mediapipe/tasks-vision'
import {face3DPresets,isFace3DId,viewportCrop,getHeadPose,trianglesFromConnections} from './face3d'
import type {Face3DFrame} from './face3d'
import {faceFxCatalog} from './params'
const geometry={
 leftEye:{x:.38,y:.41},rightEye:{x:.62,y:.41},
 center:{x:.50,y:.49},leftCheek:{x:.28,y:.53},rightCheek:{x:.72,y:.53},
 leftJaw:{x:.35,y:.67},rightJaw:{x:.65,y:.67},chin:{x:.50,y:.79},
 nose:{x:.50,y:.51},mouth:{x:.5,y:.65},
 leftBlush:{x:.35,y:.56},rightBlush:{x:.65,y:.56},
 mouthWidth:.12,width:.44,
 expression:{mouthOpen:.8,leftEyeOpen:.3,rightEyeOpen:.9},
}
const frame:Face3DFrame={
 landmarks:Array.from({length:478},()=>({x:.5,y:.5,z:0})),
 geometry,timestamp:1,blendshapes:{jawOpen:.8,eyeBlinkLeft:.7},
}
describe('SpakTok tracked 3D lenses',()=>{
 it('binds six native 3D choices to the face effect catalog',()=>{
   expect(face3DPresets).toHaveLength(6)
   for(const fx of face3DPresets){
     expect(isFace3DId(fx.id)).toBe(true)
     expect(faceFxCatalog.some(x=>x.id===fx.id)).toBe(true)
   }
   expect(isFace3DId('neon-glasses')).toBe(false)
 })
 it('projects onto the camera CSS cover crop and flips selfies once',()=>{
   const crop=viewportCrop(1280,720,360,640)!
   expect(crop.width).toBeGreaterThan(360)
   const unmirrored=getHeadPose(frame,1280,720,360,640,false)!
   const mirrored=getHeadPose(frame,1280,720,360,640,true)!
   expect(unmirrored.x+mirrored.x).toBeCloseTo(360)
   expect(unmirrored.y).toBeCloseTo(mirrored.y)
   expect(mirrored.width).toBeGreaterThan(100)
 })
 it('rejects invalid face geometry and incomplete tracked meshes',()=>{
   expect(viewportCrop(0,720,360,640)).toBeNull()
   expect(getHeadPose({...frame,landmarks:[]},720,1280,360,640,false)).toBeNull()
 })
 it('constructs a real triangle depth mesh from MediaPipe connections',()=>{
   const edges=FaceLandmarker.FACE_LANDMARKS_TESSELATION
   const triangles=trianglesFromConnections(edges,478)
   expect(triangles.length).toBeGreaterThan(2000)
   expect(triangles.length%3).toBe(0)
   expect(Math.max(...triangles)).toBeLessThan(478)
 })
})
