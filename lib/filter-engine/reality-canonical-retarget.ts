/** Source-agnostic offline retarget map from a static OBJ head template to
 * MediaPipe's 468-vertex canonical neutral face.
 * Mapping is projected/approximate, NOT a new set of tracked measurements.
 * The source OBJ geometry/UVs remain copyright of their respective owners.
 */
export type Vec3=readonly [number,number,number]
export type CanonicalMesh=Readonly<{vertices:readonly Vec3[];triangles:readonly (readonly [number,number,number])[]}>
export type CanonicalAttachment=Readonly<{
 sourceVertex:number
 targetTriangle:number
 indices:readonly [number,number,number]
 weights:readonly [number,number,number]
 offsetZ:number
 projectionError:number
}>
export type CanonicalRetargetMap=Readonly<{
 version:1
 sourceVertices:number
 targetVertices:468
 targetTriangles:number
 matches:readonly CanonicalAttachment[]
 meanProjectionError:number
 worstProjectionError:number
 confidence:'approximate-neutral-projection'
}>
export function parseCanonicalOBJ(text:string,maxVertices=15000):CanonicalMesh{
 const vertices:Vec3[]=[],triangles:[number,number,number][]=[]
 for(const raw of text.split(/\r?\n/)){
  const line=raw.trim()
  if(line.startsWith('v ')){
   const values=line.split(/\s+/).slice(1,4).map(Number)
   if(values.length!==3||!values.every(Number.isFinite))throw Error('reality_obj_invalid_vertex')
   vertices.push(values as unknown as Vec3)
   if(vertices.length>maxVertices)throw Error('reality_obj_oversized')
  }else if(line.startsWith('f ')){
   const ids=line.split(/\s+/).slice(1).map(t=>Number(t.split('/')[0])-1)
   if(ids.length<3||ids.length>16||ids.some(i=>!Number.isSafeInteger(i)||i<0||i>=vertices.length))
    throw Error('reality_obj_invalid_face')
   for(let i=1;i+1<ids.length;i++){
    triangles.push([ids[0],ids[i],ids[i+1]])
    if(triangles.length>30000)throw Error('reality_obj_oversized')
   }
  }
 }
 if(vertices.length<3||triangles.length<1)throw Error('reality_obj_incomplete')
 return {vertices,triangles}
}
function normalizer(vertices:readonly Vec3[]){
 const xs=vertices.map(p=>p[0]).sort((a,b)=>a-b),ys=vertices.map(p=>p[1]).sort((a,b)=>a-b)
 const pct=(nums:number[],v:number)=>nums[Math.floor((nums.length-1)*v)]
 const xmin=pct(xs,.025),xmax=pct(xs,.975),ymin=pct(ys,.025),ymax=pct(ys,.975)
 const scale=Math.max(xmax-xmin,ymax-ymin)
 if(!Number.isFinite(scale)||scale<=.000001)throw Error('reality_mesh_zero_extent')
 return (p:Vec3):Vec3=>[
  (p[0]-(xmin+xmax)/2)/scale,(p[1]-(ymin+ymax)/2)/scale,p[2]/scale,
 ]
}
function closestBarycentric(p:Vec3,a:Vec3,b:Vec3,c:Vec3){
 const ax=a[0],ay=a[1],bx=b[0],by=b[1],cx=c[0],cy=c[1]
 const den=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy)
 if(Math.abs(den)<1e-12)return null
 const u=((by-cy)*(p[0]-cx)+(cx-bx)*(p[1]-cy))/den
 const v=((cy-ay)*(p[0]-cx)+(ax-cx)*(p[1]-cy))/den
 const w=1-u-v
 const raw=[u,v,w],clamped=raw.map(x=>Math.max(0,Math.min(1,x)))
 const sum=clamped.reduce((a,b)=>a+b,0)
 if(sum<=1e-12)return null
 const weights=clamped.map(x=>x/sum) as [number,number,number]
 const x=weights[0]*ax+weights[1]*bx+weights[2]*cx
 const y=weights[0]*ay+weights[1]*by+weights[2]*cy
 return {weights,error:Math.hypot(x-p[0],y-p[1])}
}
/** Complexity O(source vertices × canonical triangles), authoring-time only.
 * No CPU work or complex search is added to the actual camera frame loop.
 */
export function buildCanonicalRetarget(
 source:CanonicalMesh,target:CanonicalMesh,
):CanonicalRetargetMap{
 if(target.vertices.length!==468||target.triangles.length<600||
    source.vertices.length>15000)throw Error('reality_retarg_invalid_topology')
 const normSource=normalizer(source.vertices),normTarget=normalizer(target.vertices)
 const targetPoints=target.vertices.map(normTarget)
 const sourcePoints=source.vertices.map(normSource)
 const matches:CanonicalAttachment[]=[]
 let errorSum=0,worst=0
 for(let index=0;index<sourcePoints.length;index++){
  const p=sourcePoints[index]
  let best:{triangle:number;weights:[number,number,number];error:number}|null=null
  for(let id=0;id<target.triangles.length;id++){
   const [ia,ib,ic]=target.triangles[id]
   const a=targetPoints[ia],b=targetPoints[ib],c=targetPoints[ic]
   if(!a||!b||!c)throw Error('reality_retarg_bad_face_index')
   const result=closestBarycentric(p,a,b,c)
   if(result&&(!best||result.error<best.error))
    best={triangle:id,weights:result.weights,error:result.error}
  }
  if(!best)throw Error('reality_retarg_no_projection')
  const tri=target.triangles[best.triangle]
  const offsetZ=p[2]-tri.reduce((a,v,i)=>a+targetPoints[v][2]*best!.weights[i],0)
  matches.push({
   sourceVertex:index,targetTriangle:best.triangle,indices:tri,
   weights:best.weights,offsetZ,projectionError:best.error,
  })
  errorSum+=best.error;worst=Math.max(worst,best.error)
 }
 return {
  version:1,sourceVertices:source.vertices.length,targetVertices:468,
  targetTriangles:target.triangles.length,
  matches,meanProjectionError:errorSum/matches.length,worstProjectionError:worst,
  confidence:'approximate-neutral-projection',
 }
}
export function retargetTrackedFace(
 map:CanonicalRetargetMap,
 landmarks:ReadonlyArray<Vec3>,
 outputDepthScale=1,
):Vec3[]|null{
 if(landmarks.length<468||!Number.isFinite(outputDepthScale))return null
 const result:Vec3[]=[]
 for(const attach of map.matches){
  const [a,b,c]=attach.indices.map(i=>landmarks[i])
  if(!a||!b||!c||![...a,...b,...c].every(Number.isFinite))return null
  const w=attach.weights
  result.push([
   a[0]*w[0]+b[0]*w[1]+c[0]*w[2],
   a[1]*w[0]+b[1]*w[1]+c[1]*w[2],
   a[2]*w[0]+b[2]*w[1]+c[2]*w[2]+attach.offsetZ*outputDepthScale,
  ])
 }
 return result
}
