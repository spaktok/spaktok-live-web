/** Geometric alignment for the live camera: track face motion without lag.
 * Coordinates are MediaPipe normalized image-space, never DOM/CSS coordinates.
 * All 478 landmarks and the 3D mount must use this SAME stabilized frame.
 */
export type FaceMeshPoint = Readonly<{x:number;y:number;z:number}>
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v))
export function stabilizeFaceMesh(
 previous:ReadonlyArray<FaceMeshPoint>|null,
 next:ReadonlyArray<FaceMeshPoint>,
 deltaMs:number,
 aspect:number,
):FaceMeshPoint[]{
 if(next.length<468)return []
 if(!previous||previous.length!==next.length||deltaMs<=0||deltaMs>300)return next.map(p=>({...p}))
 // Eye/nose displacement controls the response rate for a fast-moving head.
 const anchors=[33,133,362,263,4,152] as const
 let maxShift=0
 for(const id of anchors){
  const a=previous[id],b=next[id]
  if(!a||!b)continue
  const shift=Math.hypot((a.x-b.x)*aspect,a.y-b.y)
  maxShift=Math.max(maxShift,shift)
 }
 // Small noise is smoothed; real head movement must follow immediately.
 const baseline=clamp(deltaMs/62,.30,.76)
 const alpha=maxShift>.12?1:maxShift>.035?Math.max(.88,baseline):baseline
 return next.map((p,i)=>{
  const q=previous[i]
  if(!q)return {...p}
  return {x:q.x+(p.x-q.x)*alpha,y:q.y+(p.y-q.y)*alpha,
   z:q.z+(p.z-q.z)*alpha}
 })
}
export function hasFreshFace(timestamp:number,now:number,maxAgeMs=375){
 return timestamp>0&&now>=timestamp&&now-timestamp<=maxAgeMs
}
