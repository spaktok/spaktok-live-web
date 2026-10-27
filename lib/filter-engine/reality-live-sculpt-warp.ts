import type {LiveMeshViewport} from './reality-live-personal-mesh'

/** Per-creator, source-UV mesh warp. This operates on the current 478
 * MediaPipe points, not an averaged or supposedly 'ideal' face.
 *
 * Each target (deformed) face triangle is rasterized into a low-resolution
 * inverse-displacement texture mapping destination pixels back to the
 * person's own input image. The existing camera color shader samples this
 * texture, so crop, recording and color passes remain shared.
 *
 * This is a bounded appearance editor, NOT a biometric scan or an
 * anatomical reconstruction. No landmarks or pixels leave the browser.
 */
export const LIVE_SCULPT_GRID_SIZE=160
export const LIVE_SCULPT_MAX_OFFSET=.055
export type LiveSculptControls=Readonly<{
 jaw:number;chin:number;eyes:number;nose:number
}>
export const NEUTRAL_LIVE_SCULPT:LiveSculptControls=Object.freeze({
 jaw:0,chin:0,eyes:0,nose:0,
})
export type LiveSculptFrame=Readonly<{
 width:number;height:number;data:Uint8Array
 triangleCount:number;sourcePoints:478
}>
type Point=Readonly<{x:number;y:number;z:number}>
type Point2=Readonly<{x:number;y:number}>
const bounded=(v:number)=>Number.isFinite(v)?Math.max(0,Math.min(.65,v)):0
export function normalizeLiveSculpt(
 value:Partial<LiveSculptControls>|null|undefined,
):LiveSculptControls{
 return {
  jaw:bounded(value?.jaw??0),chin:bounded(value?.chin??0),
  eyes:bounded(value?.eyes??0),nose:bounded(value?.nose??0),
 }
}
export function hasLiveSculpt(value:LiveSculptControls):boolean{
 return value.jaw>.001||value.chin>.001||value.eyes>.001||value.nose>.001
}
const gauss=(d:number,r:number)=>Math.exp(-3*(d/r)*(d/r))
const dist=(a:Point2,b:Point2,aspect:number)=>
 Math.hypot((a.x-b.x)*aspect,a.y-b.y)
const avg=(a:Point2,b:Point2):Point2=>({x:(a.x+b.x)/2,y:(a.y+b.y)/2})
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v))
const BLUR_NEIGHBORS:readonly (readonly [number,number])[]=[[-1,0],[1,0],[0,-1],[0,1]]
const triArea=(a:Point2,b:Point2,c:Point2)=>
 (b.x-a.x)*(c.y-a.y)-(b.y-a.y)*(c.x-a.x)

/** Unlike a global beauty ratio, every amount is normalized by this
 * actual person's tracked cheek width, iris/eye geometry and nose bridge.
 * XY keeps MediaPipe source-video normalized UV convention.
 */
export function sculptLiveFaceVertices(
 landmarks:ReadonlyArray<Point>,
 controls:LiveSculptControls,sourceAspect:number,
):Point2[]|null{
 if(landmarks.length<478||!Number.isFinite(sourceAspect)||sourceAspect<=0)return null
 const ids=[1,4,33,133,263,362,234,454,172,397,152,94,168]
 for(const i of ids){
  const p=landmarks[i]
  if(!p||![p.x,p.y,p.z].every(Number.isFinite))return null
 }
 const cheeks=avg(landmarks[234],landmarks[454])
 const leftEye=avg(landmarks[33],landmarks[133])
 const rightEye=avg(landmarks[362],landmarks[263])
 const nose=avg(landmarks[1],landmarks[4])
 const jawLeft=landmarks[172],jawRight=landmarks[397],chin=landmarks[152]
 const width=dist(landmarks[234],landmarks[454],sourceAspect)
 if(width<.065||width>.95)return null
 const c=normalizeLiveSculpt(controls)
 const rJaw=width*.58,rEyes=width*.255,rNose=width*.265
 const eyeDistance=dist(leftEye,rightEye,sourceAspect)
 if(eyeDistance<width*.22||eyeDistance>width*.9)return null
 if(landmarks.some(p=>!p||![p.x,p.y,p.z].every(Number.isFinite)))return null
 return landmarks.map(p=>{
  let x=p.x,y=p.y
  // Jaw: symmetrically contract only lower facial regions, taper toward
  // cheeks and temples. Screen-left/right reversal is handled by the model.
  const jw=Math.max(gauss(dist(p,jawLeft,sourceAspect),rJaw),
   gauss(dist(p,jawRight,sourceAspect),rJaw))
  const lower=clamp((p.y-(leftEye.y+rightEye.y)*.5)/(Math.max(.04,chin.y-(leftEye.y+rightEye.y)*.5)),0,1)
  x+=(cheeks.x-x)*c.jaw*.33*jw*lower
  // Chin width has its own smaller, symmetric region; slight vertical
  // shortening is bounded by face width and doesn't shift lips.
  const cw=gauss(dist(p,chin,sourceAspect),width*.29)
  x+=(chin.x-x)*c.chin*.42*cw
  y-=(Math.max(0,p.y-nose.y))*c.chin*.16*cw
  // Eye enlargement expands local radii around each actual eye center.
  const eLeft=gauss(dist(p,leftEye,sourceAspect),rEyes)
  const eRight=gauss(dist(p,rightEye,sourceAspect),rEyes)
  const e=eLeft>=eRight?leftEye:rightEye
  const ew=Math.max(eLeft,eRight)
  x+=(p.x-e.x)*c.eyes*.34*ew
  y+=(p.y-e.y)*c.eyes*.34*ew
  // Narrow bridge/nose near the actual nose axis without sliding the tip.
  const nw=gauss(dist(p,nose,sourceAspect),rNose)
  x+=(nose.x-x)*c.nose*.36*nw
  // Clamp per-vertex total displacement to avoid sudden artifacts.
  const dx=(x-p.x)*sourceAspect,dy=y-p.y
  const length=Math.hypot(dx,dy)
  const multiplier=length>LIVE_SCULPT_MAX_OFFSET?
   LIVE_SCULPT_MAX_OFFSET/length:1
  return {x:p.x+(x-p.x)*multiplier,y:p.y+dy*multiplier}
 })
}

/** Build inverse source displacement at actual destination triangles, then
 * feather warp into the unchanged outer background. No triangle means no
 * displacement. Degenerate/inverted triangles fail closed.
 *
 * Use a compact RGBA8 sampling LUT rather than rendering hundreds of
 * geometry passes over the camera/video texture.
 */
export function buildLiveSculptWarp(
 landmarks:ReadonlyArray<Point>,
 triangles:Uint16Array,
 controls:LiveSculptControls,
 viewport:LiveMeshViewport,
 grid=LIVE_SCULPT_GRID_SIZE,
):LiveSculptFrame|null{
 if(!Number.isSafeInteger(grid)||grid<32||grid>256||
  triangles.length===0||triangles.length%3!==0||
  landmarks.length<478||![viewport.sourceWidth,viewport.sourceHeight,
   viewport.outputWidth,viewport.outputHeight].every(v=>Number.isFinite(v)&&v>0))
  return null
 const c=normalizeLiveSculpt(controls)
 if(!hasLiveSculpt(c))return null
 const aspect=viewport.sourceWidth/viewport.sourceHeight
 const destination=sculptLiveFaceVertices(landmarks,c,aspect)
 if(!destination)return null
 // Source UV only. The legacy shader applies mirror/crop just once,
 // AFTER the warp, preventing mirrored contours or doubled distortion.
 const dx=new Float32Array(grid*grid)
 const dy=new Float32Array(grid*grid)
 const counts=new Uint8Array(grid*grid)
 let used=0,invalid=0
 for(let i=0;i<triangles.length;i+=3){
  const ia=triangles[i],ib=triangles[i+1],ic=triangles[i+2]
  if(ia>=478||ib>=478||ic>=478||ia===ib||ib===ic||ia===ic)return null
  const a=landmarks[ia],b=landmarks[ib],e=landmarks[ic]
  const A=destination[ia],B=destination[ib],C=destination[ic]
  if(![a,b,e,A,B,C].every(p=>Number.isFinite(p.x)&&Number.isFinite(p.y)))
   return null
  const original=triArea(a,b,e),target=triArea(A,B,C)
  if(Math.abs(original)<1e-9||Math.abs(target)<1e-9||
   Math.sign(original)!==Math.sign(target)){
   invalid++
   // A local pose can be edge-on; skip degenerate triangles instead of
   // failing the whole face. A larger fraction should disable the warp.
   continue
  }
  const x0=Math.max(0,Math.floor(Math.min(A.x,B.x,C.x)*grid)-1)
  const x1=Math.min(grid-1,Math.ceil(Math.max(A.x,B.x,C.x)*grid)+1)
  const y0=Math.max(0,Math.floor(Math.min(A.y,B.y,C.y)*grid)-1)
  const y1=Math.min(grid-1,Math.ceil(Math.max(A.y,B.y,C.y)*grid)+1)
  const den=target
  used++
  for(let py=y0;py<=y1;py++)for(let px=x0;px<=x1;px++){
   const qx=(px+.5)/grid,qy=(py+.5)/grid
   // Signed barycentric coefficients work for either face winding.
   const u=triArea(B,C,{x:qx,y:qy})/den
   const v=triArea(C,A,{x:qx,y:qy})/den
   const w=1-u-v
   if(u<-.00001||v<-.00001||w<-.00001)continue
   const sx=u*a.x+v*b.x+w*e.x,sy=u*a.y+v*b.y+w*e.y
   const k=py*grid+px
   const wx=clamp(sx-qx,-LIVE_SCULPT_MAX_OFFSET,LIVE_SCULPT_MAX_OFFSET)
   const wy=clamp(sy-qy,-LIVE_SCULPT_MAX_OFFSET,LIVE_SCULPT_MAX_OFFSET)
   // Shared edges converge; average rounding disagreements.
   dx[k]+=wx;dy[k]+=wy
   counts[k]=Math.min(counts[k]+1,255)
  }
 }
 if(used===0||invalid>Math.ceil(triangles.length/3*.04))return null
 const length=grid*grid
 let fieldX=new Float32Array(length),fieldY=new Float32Array(length)
 for(let i=0;i<length;i++){
  if(counts[i]){fieldX[i]=dx[i]/counts[i];fieldY[i]=dy[i]/counts[i]}
 }
 // Two compact passes fill the triangle boundary using neutral pixels,
 // so warp transitions gradually to the original background and avoids
 // a hard face-shaped line.
 for(let pass=0;pass<2;pass++){
  const outX=new Float32Array(length),outY=new Float32Array(length)
  for(let y=0;y<grid;y++)for(let x=0;x<grid;x++){
   const id=y*grid+x
   let sumX=fieldX[id]*4,sumY=fieldY[id]*4,weight=4
   for(const [ox,oy] of BLUR_NEIGHBORS){
    const xx=x+ox,yy=y+oy
    if(xx<0||xx>=grid||yy<0||yy>=grid)continue
    const idx=yy*grid+xx
    sumX+=fieldX[idx];sumY+=fieldY[idx];weight++
   }
   outX[id]=sumX/weight;outY[id]=sumY/weight
  }
  fieldX=outX;fieldY=outY
 }
 const data=new Uint8Array(length*4)
 for(let i=0;i<length;i++){
  // Neutral zero = 127.5 in RGBA8 (interpolates exactly with GPU LINEAR).
  data[i*4]=Math.round(clamp(.5+fieldX[i]/(2*LIVE_SCULPT_MAX_OFFSET),0,1)*255)
  data[i*4+1]=Math.round(clamp(.5+fieldY[i]/(2*LIVE_SCULPT_MAX_OFFSET),0,1)*255)
  data[i*4+2]=0
  data[i*4+3]=255
 }
 return {width:grid,height:grid,data,
  triangleCount:used,sourcePoints:478}
}
