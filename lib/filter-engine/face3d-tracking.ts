/** Fast face stabilization in MediaPipe normalized source-video coordinates.
 * Rigid head translation / roll / zoom must NOT be smoothed behind the video.
 * Only non-rigid, landmark-local jitter should be temporally filtered.
 * All 478 landmarks, 3D pose and the depth mask use the same output.
 */
export type FaceMeshPoint=Readonly<{x:number;y:number;z:number}>
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v))
const valid=(p:FaceMeshPoint|undefined)=>Boolean(p&&
 Number.isFinite(p.x)&&Number.isFinite(p.y)&&Number.isFinite(p.z))
const EYE_LEFT=33,EYE_RIGHT=263

export function stabilizeFaceMesh(
 previous:ReadonlyArray<FaceMeshPoint>|null,
 next:ReadonlyArray<FaceMeshPoint>,
 deltaMs:number,
 aspect:number,
):FaceMeshPoint[]{
 if(next.length<468)return []
 const current=next.map(p=>({...p}))
 if(!previous||previous.length!==next.length||deltaMs<=0||deltaMs>300||
  !Number.isFinite(aspect)||aspect<=0)return current
 const oldL=previous[EYE_LEFT],oldR=previous[EYE_RIGHT]
 const newL=next[EYE_LEFT],newR=next[EYE_RIGHT]
 if(![oldL,oldR,newL,newR].every(valid))return current
 const pCenter={x:(oldL.x+oldR.x)/2,y:(oldL.y+oldR.y)/2,
  z:(oldL.z+oldR.z)/2}
 const nCenter={x:(newL.x+newR.x)/2,y:(newL.y+newR.y)/2,
  z:(newL.z+newR.z)/2}
 const px=(oldR.x-oldL.x)*aspect,py=oldR.y-oldL.y
 const nx=(newR.x-newL.x)*aspect,ny=newR.y-newL.y
 const priorSpan=Math.hypot(px,py),newSpan=Math.hypot(nx,ny)
 // Bad detections / face switches should snap to new data rather than
 // creating a stretched or oscillating mask from invalid history.
 if(priorSpan<.045||newSpan<.045)return current
 const scale=newSpan/priorSpan
 const roll=Math.atan2(ny,nx)-Math.atan2(py,px)
 const wrapped=Math.atan2(Math.sin(roll),Math.cos(roll))
 if(!Number.isFinite(scale)||scale<.65||scale>1.55||
    Math.abs(wrapped)>.7)return current
 const c=Math.cos(wrapped)*scale, s=Math.sin(wrapped)*scale
 // Optical rigid motion passes immediately; micro-expression jitter
 // is smoothed without dragging the entire 3D accessory behind the head.
 const residualAlpha=clamp(deltaMs/75,.34,.72)
 return next.map((point,i)=>{
  const prev=previous[i]
  if(!valid(prev)||!valid(point))return {...point}
  const ox=(prev.x-pCenter.x)*aspect,oy=prev.y-pCenter.y
  const rigidX=nCenter.x+(ox*c-oy*s)/aspect
  const rigidY=nCenter.y+ox*s+oy*c
  const rigidZ=nCenter.z+(prev.z-pCenter.z)*scale
  return {
   x:rigidX+(point.x-rigidX)*residualAlpha,
   y:rigidY+(point.y-rigidY)*residualAlpha,
   z:rigidZ+(point.z-rigidZ)*residualAlpha,
  }
 })
}
/** Ignore stale pose data; never leave a ghost GLB attached to an old face. */
export function hasFreshFace(timestamp:number,now:number,maxAgeMs=375){
 return timestamp>0&&now>=timestamp&&now-timestamp<=maxAgeMs
}
