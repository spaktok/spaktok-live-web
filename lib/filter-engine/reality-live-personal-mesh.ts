import type {DenseFaceTopology} from './reality-face-topology'

/** Live-only face geometry from this exact user's current MediaPipe landmarks.
 * This is a REAL indexed tessellated triangle mesh with a dynamic XYZ buffer.
 * Refinement interpolates the measurements; it cannot invent camera detail.
 * Pure math: no camera image, biometric data persistence, network or JS GPU.
 */
export const LIVE_MESH_MAX_LEVEL=2 as const
export const LIVE_MESH_SOURCE_POINTS=478
export type LiveMeshTemplate=Readonly<{
 levels:0|1|2
 vertexCount:number
 triangleCount:number
 indices:Uint16Array
 /** Three landmark IDs and their barycentric weights per generated vertex. */
 landmarkIds:Uint16Array
 landmarkWeights:Float32Array
}>
export type LiveMeshViewport=Readonly<{
 sourceWidth:number;sourceHeight:number
 outputWidth:number;outputHeight:number;mirror:boolean
}>
const validSize=(n:number)=>Number.isFinite(n)&&n>0
const finite=(n:number)=>Number.isFinite(n)
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v))
type Influences=Readonly<{ids:readonly number[];weights:readonly number[]}>
const original=(id:number):Influences=>({ids:[id],weights:[1]})
function midpoint(a:Influences,b:Influences):Influences{
 const weights=new Map<number,number>()
 for(let i=0;i<a.ids.length;i++)
  weights.set(a.ids[i],(weights.get(a.ids[i])??0)+a.weights[i]*.5)
 for(let i=0;i<b.ids.length;i++)
  weights.set(b.ids[i],(weights.get(b.ids[i])??0)+b.weights[i]*.5)
 const entries=[...weights].filter(([,w])=>w>1e-8).sort((x,y)=>x[0]-y[0])
 if(entries.length>3)throw Error('reality_mesh_non_triangle_interpolation')
 return {ids:entries.map(([id])=>id),weights:entries.map(([,w])=>w)}
}
/** Shared-edge reuse makes triangles watertight, with no edge cracks.
 * Levels 0,1,2 respectively provide 1x,4x,16x base triangle counts.
 */
export function createLiveFaceMeshTemplate(
 topology:Pick<DenseFaceTopology,'vertexCount'|'indices'|'triangleCount'>,
 levels:0|1|2,
):LiveMeshTemplate{
 if(![0,1,2].includes(levels)||topology.vertexCount!==LIVE_MESH_SOURCE_POINTS||
  topology.indices.length!==topology.triangleCount*3||
  topology.triangleCount<1||topology.triangleCount>1200)
  throw Error('reality_live_mesh_invalid_topology')
 for(let i=0;i<topology.indices.length;i+=3){
  const a=topology.indices[i],b=topology.indices[i+1],c=topology.indices[i+2]
  if(![a,b,c].every(id=>Number.isSafeInteger(id)&&id>=0&&id<topology.vertexCount)||
   a===b||b===c||a===c)throw Error('reality_live_mesh_corrupt_triangle')
 }
 const influences:Influences[]=Array.from({length:topology.vertexCount},(_,i)=>original(i))
 let triangles=Array.from(topology.indices)
 for(let level=0;level<levels;level++){
  const edgeCache=new Map<string,number>()
  const mid=(a:number,b:number)=>{
   const key=(a<b?a+':'+b:b+':'+a)
   const cached=edgeCache.get(key)
   if(cached!==undefined)return cached
   const id=influences.length
   influences.push(midpoint(influences[a],influences[b]))
   edgeCache.set(key,id)
   return id
  }
  const next:number[]=[]
  for(let i=0;i<triangles.length;i+=3){
   const [a,b,c]=triangles.slice(i,i+3)
   if(![a,b,c].every(v=>Number.isSafeInteger(v)&&v>=0&&v<influences.length)||
    a===b||a===c||b===c)throw Error('reality_live_mesh_corrupt_triangle')
   const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a)
   next.push(a,ab,ca, ab,b,bc, ca,bc,c, ab,bc,ca)
  }
  triangles=next
 }
 if(influences.length>65535)throw Error('reality_live_mesh_vertex_budget')
 const ids=new Uint16Array(influences.length*3)
 const weights=new Float32Array(influences.length*3)
 for(let v=0;v<influences.length;v++){
  for(let j=0;j<influences[v].ids.length;j++){
   ids[v*3+j]=influences[v].ids[j]
   weights[v*3+j]=influences[v].weights[j]
  }
 }
 return {levels,vertexCount:influences.length,triangleCount:triangles.length/3,
  indices:new Uint16Array(triangles),landmarkIds:ids,landmarkWeights:weights}
}
export type LiveFaceMeshResult=Readonly<{
 positions:Float32Array
 triangleCount:number;vertexCount:number
 /** Preserved 478 source landmarks / not an independent face reconstruction. */
 measuredLandmarks:478
}>
/** Project the live tracked face using the camera's Y-down cover-crop convention.
 * Fail closed on incomplete, stale or corrupt input; NEVER repeat previous face.
 */
export function updateLiveFaceMesh(
 template:LiveMeshTemplate,
 landmarks:ReadonlyArray<Readonly<{x:number;y:number;z:number}>>,
 viewport:LiveMeshViewport,
 output?:Float32Array,
):LiveFaceMeshResult|null{
 if(landmarks.length<478||![viewport.sourceWidth,viewport.sourceHeight,
  viewport.outputWidth,viewport.outputHeight].every(validSize))return null
 for(let i=0;i<478;i++){
  const p=landmarks[i]
  if(!p||![p.x,p.y,p.z].every(finite)||p.x<-.1||p.x>1.1||
   p.y<-.1||p.y>1.1||Math.abs(p.z)>2)return null
 }
 const pos=output??new Float32Array(template.vertexCount*3)
 if(pos.length!==template.vertexCount*3)return null
 const w=viewport.sourceWidth,h=viewport.sourceHeight
 const ow=viewport.outputWidth,oh=viewport.outputHeight
 const scale=Math.max(ow/w,oh/h)
 const cropX=(ow-w*scale)*.5,cropY=(oh-h*scale)*.5
 const projX=w*scale,projY=h*scale
 const projected=new Float32Array(478*3)
 for(let i=0;i<478;i++){
  const p=landmarks[i],idx=i*3
  const x=cropX+p.x*projX
  projected[idx]=viewport.mirror?ow-x:x
  projected[idx+1]=cropY+p.y*projY
  projected[idx+2]=clamp(18-p.z*projY*.64,-45,90)
 }
 for(let v=0;v<template.vertexCount;v++){
  const base=v*3
  let x=0,y=0,z=0
  for(let i=0;i<3;i++){
   const weight=template.landmarkWeights[base+i]
   if(weight===0)continue
   const landmark=template.landmarkIds[base+i]*3
   x+=projected[landmark]*weight
   y+=projected[landmark+1]*weight
   z+=projected[landmark+2]*weight
  }
  pos[base]=x;pos[base+1]=y;pos[base+2]=z
 }
 return {positions:pos,triangleCount:template.triangleCount,
  vertexCount:template.vertexCount,measuredLandmarks:478}
}
/** One subdivision level <=1 for weaker phones; max two for faster devices.
 * Based on actual *measured* FPS, not claimed 60FPS.
 */
export function chooseLiveMeshLevel(
 device:'low'|'mid'|'high'|'desktop',fps:number|null,faceValid:boolean,
):0|1|2{
 if(!faceValid)return 0
 if(device==='low'||fps===null||!finite(fps)||fps<23)return 0
 if(device==='mid'||(typeof fps==='number'&&fps<36))return 1
 return 2
}
