import type {DenseFaceTopology} from './reality-face-topology'
import type {FaceSemanticAtlas,FaceSemanticRegion} from './reality-face-regions'
import type {RealityLandmark} from './reality-effect-anchors'

export type SurfaceBarycentric=readonly [number,number,number]
export type FaceSurfaceBinding=Readonly<{
 triangleId:number
 vertices:readonly [number,number,number]
 weights:SurfaceBarycentric
 region:FaceSemanticRegion
}>
export type FaceSurfaceFrame=Readonly<{
 sourceWidth:number;sourceHeight:number
 outputWidth:number;outputHeight:number
 mirror:boolean
}>
export type FaceSurfaceSample=Readonly<{
 x:number;y:number;z:number
 nx:number;ny:number;nz:number
 triangleId:number
}>

const finite=(n:number)=>Number.isFinite(n)
const clip=(x:number,a:number,b:number)=>Math.max(a,Math.min(b,x))
function barycentric2d(
 target:Readonly<{x:number;y:number}>,
 p:readonly [RealityLandmark,RealityLandmark,RealityLandmark],
 aspect:number,
):SurfaceBarycentric|null{
 const [a,b,c]=p
 const ax=a.x*aspect,ay=a.y,bx=b.x*aspect,by=b.y,cx=c.x*aspect,cy=c.y
 const tx=target.x*aspect,ty=target.y
 const denominator=(by-cy)*(ax-cx)+(cx-bx)*(ay-cy)
 if(!finite(denominator)||Math.abs(denominator)<1e-10)return null
 const u=((by-cy)*(tx-cx)+(cx-bx)*(ty-cy))/denominator
 const v=((cy-ay)*(tx-cx)+(ax-cx)*(ty-cy))/denominator
 const w=1-u-v
 if(![u,v,w].every(finite))return null
 // Clamp to the triangle and renormalize. These weights then stay fixed
 // while the real face moves/deforms over subsequent frames.
 const cu=clip(u,0,1),cv=clip(v,0,1),cw=clip(w,0,1)
 const sum=cu+cv+cw
 if(sum<=1e-10)return null
 return [cu/sum,cv/sum,cw/sum]
}

/** One-time authoring-stage projection of a semantic target onto the real
 * tesselated face, with stable triangle identity & barycentric coordinates.
 */
export function createRegionSurfaceBinding(
 topology:DenseFaceTopology,
 atlas:FaceSemanticAtlas,
 region:FaceSemanticRegion,
 target:Readonly<{x:number;y:number}>,
 landmarks:ReadonlyArray<RealityLandmark>,
 aspect:number,
):FaceSurfaceBinding|null{
 if(landmarks.length<468||!finite(aspect)||aspect<=0||
    !finite(target.x)||!finite(target.y))return null
 let nearest:null|FaceSurfaceBinding=null
 let error=Infinity
 for(const id of atlas[region].triangleIds){
  const vertices=topology.triangles[id]
  if(!vertices)continue
  const [a,b,c]=vertices.map(i=>landmarks[i]) as [RealityLandmark|undefined,RealityLandmark|undefined,RealityLandmark|undefined]
  if(!a||!b||!c||![a.x,a.y,b.x,b.y,c.x,c.y].every(finite))continue
  const weights=barycentric2d(target,[a,b,c],aspect)
  if(!weights)continue
  const px=a.x*weights[0]+b.x*weights[1]+c.x*weights[2]
  const py=a.y*weights[0]+b.y*weights[1]+c.y*weights[2]
  const score=Math.pow((px-target.x)*aspect,2)+Math.pow(py-target.y,2)
  if(score<error){
   error=score
   nearest={triangleId:id,vertices,weights,region}
  }
 }
 return nearest
}

function projected(
 p:RealityLandmark,
 frame:FaceSurfaceFrame,
):[number,number,number]|null{
 if(![p.x,p.y,p.z??0].every(finite))return null
 const {sourceWidth:w,sourceHeight:h,outputWidth:ow,outputHeight:oh}=frame
 if(![w,h,ow,oh].every(n=>finite(n)&&n>0))return null
 const scale=Math.max(ow/w,oh/h)
 const x=(ow-w*scale)*.5+p.x*w*scale
 const y=(oh-h*scale)*.5+p.y*h*scale
 const z=clip(18-(p.z??0)*h*scale*.64,-45,90)
 return [frame.mirror?ow-x:x,y,z]
}

/** Evaluate an attached point/normal at any frame, using the SAME world
 * space/depth convention as the existing 478-vertex depth occluder.
 * Positive normal Z always points toward the camera. If the chosen
 * triangle degenerates, DO NOT reuse the last valid frame.
 */
export function evaluateFaceSurfaceBinding(
 binding:FaceSurfaceBinding,
 landmarks:ReadonlyArray<RealityLandmark>,
 frame:FaceSurfaceFrame,
 offsetPixels=0,
):FaceSurfaceSample|null{
 const p=binding.vertices.map(i=>landmarks[i]&&projected(landmarks[i],frame))
 if(p.some(v=>!v))return null
 const [a,b,c]=p as [[number,number,number],[number,number,number],[number,number,number]]
 const weights=binding.weights
 if(Math.abs(weights[0]+weights[1]+weights[2]-1)>1e-5||
   weights.some(w=>!finite(w)||w<0||w>1))return null
 const ab=[b[0]-a[0],b[1]-a[1],b[2]-a[2]]
 const ac=[c[0]-a[0],c[1]-a[1],c[2]-a[2]]
 let nx=ab[1]*ac[2]-ab[2]*ac[1]
 let ny=ab[2]*ac[0]-ab[0]*ac[2]
 let nz=ab[0]*ac[1]-ab[1]*ac[0]
 const length=Math.hypot(nx,ny,nz)
 if(length<1e-7||!finite(length)||!finite(offsetPixels))return null
 nx/=length;ny/=length;nz/=length
 // Face visible to camera at +Z; arbitrary triangle winding should not
 // project wearables behind the skin. Preserve surface tilt from 3D vertices.
 if(nz<0){nx=-nx;ny=-ny;nz=-nz}
 return {
  x:a[0]*weights[0]+b[0]*weights[1]+c[0]*weights[2]+nx*offsetPixels,
  y:a[1]*weights[0]+b[1]*weights[1]+c[1]*weights[2]+ny*offsetPixels,
  z:a[2]*weights[0]+b[2]*weights[1]+c[2]*weights[2]+nz*offsetPixels,
  nx,ny,nz,triangleId:binding.triangleId,
 }
}
