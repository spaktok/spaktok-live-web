import type { RealityAnchor } from './reality-effect-manifest'

/** MediaPipe 478 landmark anchors in normalized source-video coordinates.
 * Ear anchors are TEMPORAL approximations, not actual tracked ear geometry.
 * They require additional head/ear tracking before production placement.
 */
export type RealityLandmark = Readonly<{x:number;y:number;z?:number}>
export type RealityAnchorPoint = Readonly<{x:number;y:number;approximate:boolean}>
const POINTS:Readonly<Record<Exclude<RealityAnchor,'eyes_center'|'head_top'>,readonly number[]>>={
  forehead_center:[10],
  left_temple:[127],
  right_temple:[356],
  left_ear:[127,234],
  right_ear:[356,454],
  nose_bridge:[168,6],
  nose_tip:[1],
  upper_lip:[0],
  lower_lip:[17],
  chin:[152],
  jaw_left:[234],
  jaw_right:[454],
}

function meanPoint(indices:readonly number[],landmarks:ReadonlyArray<RealityLandmark>){
 let x=0,y=0
 for(const i of indices){
  const p=landmarks[i]
  if(!p||!Number.isFinite(p.x)||!Number.isFinite(p.y))return null
  x+=p.x;y+=p.y
 }
 return {x:x/indices.length,y:y/indices.length}
}

/** Resolve a named anatomical anchor using EXACTLY the same object-fit:cover
 * crop and one-X-mirror convention as the depth mask and the head pose.
 * No absolute fixed-screen positions or texture stickers.
 */
export function resolveRealityAnchor(
  anchor:RealityAnchor,
  landmarks:ReadonlyArray<RealityLandmark>,
  sourceW:number,sourceH:number,outW:number,outH:number,mirror:boolean,
  eyesCenter?:Readonly<{x:number;y:number}>,
):RealityAnchorPoint|null {
 if(landmarks.length<468||
    ![sourceW,sourceH,outW,outH].every(n=>Number.isFinite(n)&&n>0))
  return null
 if(anchor==='eyes_center'&&eyesCenter){
  return Number.isFinite(eyesCenter.x)&&Number.isFinite(eyesCenter.y)
   ?{x:eyesCenter.x,y:eyesCenter.y,approximate:false}:null
 }
 let normalized:Readonly<{x:number;y:number}>|null
 if(anchor==='eyes_center'){
  normalized=meanPoint([33,263],landmarks)
 }else if(anchor==='head_top'){
  const forehead=meanPoint([10],landmarks)
  const nose=meanPoint([1],landmarks)
  // Estimated cranial point; hair/hat silhouette is not measured by 478 mesh.
  normalized=forehead&&nose?{
   x:forehead.x+(forehead.x-nose.x)*.17,
   y:forehead.y+(forehead.y-nose.y)*.21,
  }:null
 }else normalized=meanPoint(POINTS[anchor],landmarks)
 if(!normalized)return null
 const scale=Math.max(outW/sourceW,outH/sourceH)
 const scaledW=sourceW*scale,scaledH=sourceH*scale
 const cropX=(outW-scaledW)/2,cropY=(outH-scaledH)/2
 const x=cropX+normalized.x*scaledW
 const y=cropY+normalized.y*scaledH
 return {
  x:mirror?outW-x:x,y,
  approximate:anchor==='left_ear'||anchor==='right_ear'||anchor==='head_top',
 }
}

/** Pivot binding in head-width units. Rotations are the same Euler XYZ
 * convention as the existing head mesh (pitch*.7, yaw*.75, roll).
 * This is pure math for repeatable pose tests without WebGL or browser APIs.
 */
export function solveRealityMount(
  anchor:RealityAnchorPoint,
  headWidth:number,
  rotations:Readonly<{pitch:number;yaw:number;roll:number}>,
  localAnchor:readonly [number,number,number]=[0,0,0],
  bias:readonly [number,number]=[0,0],
){
 if(!Number.isFinite(headWidth)||headWidth<=0||
   ![rotations.pitch,rotations.yaw,rotations.roll,...localAnchor,...bias].every(Number.isFinite))
  return null
 const x0=localAnchor[0]*headWidth,y0=localAnchor[1]*headWidth,z0=localAnchor[2]*headWidth
 const a=rotations.pitch*.7,b=rotations.yaw*.75,c=rotations.roll
 // Three.js Euler XYZ quaternion = Rx * Ry * Rz (apply Z, then Y,
 // then X to the vector). Preserve this exact order across all devices.
 const x1=x0*Math.cos(c)-y0*Math.sin(c)
 const y1=x0*Math.sin(c)+y0*Math.cos(c),z1=z0
 const x2=x1*Math.cos(b)+z1*Math.sin(b)
 const y2=y1,z2=-x1*Math.sin(b)+z1*Math.cos(b)
 const rx=x2
 const ry=y2*Math.cos(a)-z2*Math.sin(a)
 const rz=y2*Math.sin(a)+z2*Math.cos(a)
 return {x:anchor.x-rx+bias[0]*headWidth,
  y:anchor.y-ry+bias[1]*headWidth,
  z:18-rz}
}
