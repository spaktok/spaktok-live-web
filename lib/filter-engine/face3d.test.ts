import {describe,expect,it} from 'vitest'
import * as THREE from 'three'
import {FaceLandmarker} from '@mediapipe/tasks-vision'
import {face3DPresets,isFace3DId,viewportCrop,getHeadPose,getForeheadPixel,trianglesFromConnections,createVideoAlignedCamera,resizeVideoAlignedCamera} from './face3d'
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
 it('binds six accessory and eight makeup 3D choices to the catalog',()=>{
   expect(face3DPresets).toHaveLength(14)
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
 it('projects 3D vertices to the same unflipped Y as the camera video',()=>{
   // Regression for the upside-down floating phantom face on Android.
   const width=360,height=640
   const camera=createVideoAlignedCamera(width,height)
   const toScreen=(x:number,y:number)=>{
     const ndc=new THREE.Vector3(x,y,18).project(camera)
     return {x:(ndc.x+1)*width/2,y:(1-ndc.y)*height/2}
   }
   // Eye/cheek lower down must stay lower down, not jump to the ceiling.
   expect(toScreen(120,510).y).toBeCloseTo(510)
   expect(toScreen(120,510).x).toBeCloseTo(120)
   expect(toScreen(190,580).y).toBeGreaterThan(toScreen(190,360).y)
   expect(toScreen(120,510).y).not.toBeCloseTo(130)
   // The selfie mirror only reflects X; never Y.
   expect(toScreen(width-120,510).x).toBeCloseTo(width-120)
   expect(toScreen(width-120,510).y).toBeCloseTo(510)
   resizeVideoAlignedCamera(camera,720,1280)
   const projected=new THREE.Vector3(120,1020,18).project(camera)
   expect((1-projected.y)*1280/2).toBeCloseTo(1020)
   expect((projected.x+1)*720/2).toBeCloseTo(120)
 })
 it('pins the crown to the actual forehead with exactly one selfie X mirror',()=>{
   const landmarks=frame.landmarks.map(p=>({...p}))
   landmarks[10]={x:.34,y:.18,z:-.03}
   const shifted={...frame,landmarks}
   const normal=getForeheadPixel(shifted,720,1280,360,640,false)!
   const mirrored=getForeheadPixel(shifted,720,1280,360,640,true)!
   expect(normal.y).toBeCloseTo(mirrored.y)
   expect(normal.x+mirrored.x).toBeCloseTo(360)
   expect(normal.y).toBeCloseTo(.18*640)
   const moved=landmarks.map(p=>({...p}))
   moved[10]={...moved[10],y:.43}
   const displaced=getForeheadPixel({...shifted,landmarks:moved},720,1280,360,640,false)!
   expect(displaced.y-normal.y).toBeCloseTo(.25*640)
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
