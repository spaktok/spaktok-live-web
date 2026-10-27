/** Local-first video 3D authoring. Models and video never enter this JSON contract.
 * A project draft references local file names only; not a published effect.
 */
import {filterPresets} from './params'
export const VIDEO_3D_PROJECT_VERSION=1 as const
export const VIDEO_3D_MAX_DURATION_MS=120_000
export const VIDEO_3D_MAX_VIDEO_BYTES=250*1024*1024
export const VIDEO_3D_MAX_GLB_BYTES=15*1024*1024
export const VIDEO_3D_MAX_LAYERS=12
export const VIDEO_3D_MAX_KEYFRAMES=80
export type Video3DKind='box'|'sphere'|'torus'|'cone'|'octahedron'|'glb'
export type Video3DFrame=Readonly<{
 timeMs:number
 /** Normalized screen coordinates: 0,0=center; -0.5 left/up; +0.5 right/down. */
 x:number;y:number
 scale:number
 rotationX:number;rotationY:number;rotationZ:number
 opacity:number
}>
export type Video3DLayer=Readonly<{
 id:string;name:string;kind:Video3DKind;color:string
 /** Local-only reference; imported GLB bytes are not in draft JSON. */
 assetName:string|null
 keyframes:readonly Video3DFrame[]
}>
export type Video3DSource=Readonly<{
 name:string;width:number;height:number;durationMs:number
}>
export type Video3DProject=Readonly<{
 format:'SpakTokVideo3DProject';version:1
 name:string;source:Video3DSource|null
 colorPresetId:string
 layers:readonly Video3DLayer[]
 published:false
}>
export type Video3DFrameProperty=Exclude<keyof Video3DFrame,'timeMs'>
const ID=/^[a-z][a-z0-9-]{0,39}$/
const COLOR=/^#[a-f0-9]{6}$/i
const kinds:readonly Video3DKind[]=['box','sphere','torus','cone','octahedron','glb']
const isFiniteRange=(n:number,min:number,max:number)=>
 Number.isFinite(n)&&n>=min&&n<=max

export const DEFAULT_VIDEO_3D_FRAME:Video3DFrame={
 timeMs:0,x:0,y:0,scale:.23,
 rotationX:0,rotationY:0,rotationZ:0,opacity:1,
}
export function createVideo3DProject():Video3DProject{
 return {format:'SpakTokVideo3DProject',version:1,
  name:'SpakTok Video 3D',source:null,colorPresetId:'original',layers:[],published:false}
}
export function createVideo3DLayer(id:string,kind:Video3DKind,
 name:string=kind,assetName:string|null=null):Video3DLayer{
 if(!ID.test(id)||!kinds.includes(kind)||!name.trim()||name.length>80||
  (kind==='glb'?!assetName||assetName.length>180:assetName!==null))
  throw Error('video3d_invalid_layer')
 return {id,name,kind,color:'#59dfff',assetName,
  keyframes:[{...DEFAULT_VIDEO_3D_FRAME}]}
}
export function validateVideo3DProject(value:Video3DProject):void{
 if(value.format!=='SpakTokVideo3DProject'||value.version!==1||
  value.published!==false||!value.name?.trim()||value.name.length>90||
  !filterPresets.some(p=>p.id===value.colorPresetId)||
  !Array.isArray(value.layers)||value.layers.length>VIDEO_3D_MAX_LAYERS)
  throw Error('video3d_invalid_project')
 const source=value.source
 if(source&&(!source.name||source.name.length>180||
  !Number.isSafeInteger(source.width)||source.width<2||source.width>8192||
  !Number.isSafeInteger(source.height)||source.height<2||source.height>8192||
  !Number.isSafeInteger(source.durationMs)||source.durationMs<1||
  source.durationMs>VIDEO_3D_MAX_DURATION_MS))
  throw Error('video3d_invalid_video')
 const ids=new Set<string>()
 for(const layer of value.layers){
  if(!ID.test(layer.id)||ids.has(layer.id)||!layer.name?.trim()||
   layer.name.length>80||!kinds.includes(layer.kind)||
   !COLOR.test(layer.color)||!Array.isArray(layer.keyframes)||
   layer.keyframes.length<1||layer.keyframes.length>VIDEO_3D_MAX_KEYFRAMES||
   (layer.kind==='glb'?
     !layer.assetName||layer.assetName.length>180:layer.assetName!==null))
   throw Error('video3d_invalid_layer')
  ids.add(layer.id)
  let previous=-1
  for(const f of layer.keyframes){
   if(!Number.isSafeInteger(f.timeMs)||f.timeMs<0||f.timeMs<=previous||
    f.timeMs>VIDEO_3D_MAX_DURATION_MS||
    (source!==null&&f.timeMs>source.durationMs)||
    !isFiniteRange(f.x,-.5,.5)||!isFiniteRange(f.y,-.5,.5)||
    !isFiniteRange(f.scale,.02,2)||
    !isFiniteRange(f.rotationX,-720,720)||
    !isFiniteRange(f.rotationY,-720,720)||
    !isFiniteRange(f.rotationZ,-720,720)||
    !isFiniteRange(f.opacity,0,1))
    throw Error('video3d_invalid_keyframes')
   previous=f.timeMs
  }
 }
}
const lerp=(a:number,b:number,t:number)=>a+(b-a)*t
/** Scrubbing and export must use the same deterministic interpolation. */
export function sampleVideo3DLayer(layer:Video3DLayer,timeMs:number):Video3DFrame{
 if(!Number.isFinite(timeMs))throw Error('video3d_invalid_time')
 const frames=layer.keyframes
 if(!frames.length)throw Error('video3d_empty_keyframes')
 if(timeMs<=frames[0].timeMs)return {...frames[0]}
 for(let i=1;i<frames.length;i++){
  const b=frames[i]
  if(timeMs<=b.timeMs){
   const a=frames[i-1]
   const t=Math.max(0,Math.min(1,(timeMs-a.timeMs)/(b.timeMs-a.timeMs)))
   const eased=t*t*(3-2*t)
   return {
    timeMs,
    x:lerp(a.x,b.x,eased),y:lerp(a.y,b.y,eased),
    scale:lerp(a.scale,b.scale,eased),
    rotationX:lerp(a.rotationX,b.rotationX,eased),
    rotationY:lerp(a.rotationY,b.rotationY,eased),
    rotationZ:lerp(a.rotationZ,b.rotationZ,eased),
    opacity:lerp(a.opacity,b.opacity,eased),
   }
  }
 }
 return {...frames[frames.length-1]}
}
export function upsertVideo3DFrame(
 layer:Video3DLayer,frame:Video3DFrame,durationMs:number,
):Video3DLayer{
 if(!Number.isFinite(durationMs)||durationMs<=0||durationMs>VIDEO_3D_MAX_DURATION_MS)
  throw Error('video3d_invalid_duration')
 const timeMs=Math.max(0,Math.min(Math.round(durationMs),Math.round(frame.timeMs)))
 const current=layer.keyframes.findIndex(f=>Math.abs(f.timeMs-timeMs)<=33)
 const safeFrame={...frame,timeMs:current>=0?layer.keyframes[current].timeMs:timeMs}
 const keyframes=[...layer.keyframes]
 if(current>=0)keyframes[current]=safeFrame
 else keyframes.push(safeFrame)
 keyframes.sort((a,b)=>a.timeMs-b.timeMs)
 if(keyframes.length>VIDEO_3D_MAX_KEYFRAMES)throw Error('video3d_too_many_keyframes')
 return {...layer,keyframes}
}
/** Choose an even-sized rendering target and bound long-edge resolution. */
export function video3DOutputSize(width:number,height:number,longEdge=1280){
 if(![width,height,longEdge].every(Number.isFinite)||width<2||height<2||
  longEdge<64||longEdge>4096)throw Error('video3d_invalid_dimensions')
 const s=Math.min(1,longEdge/Math.max(width,height))
 const even=(n:number)=>Math.max(2,Math.round(n/2)*2)
 return {width:even(width*s),height:even(height*s)}
}
/** Reject GLBs with external textures/buffers before GLTFLoader sees the bytes. */
export function assertSelfContainedVideo3DGlb(buffer:ArrayBuffer):void{
 if(buffer.byteLength<28||buffer.byteLength>VIDEO_3D_MAX_GLB_BYTES)
  throw Error('video3d_invalid_glb_size')
 const view=new DataView(buffer)
 if(view.getUint32(0,true)!==0x46546c67||view.getUint32(4,true)!==2||
  view.getUint32(8,true)!==buffer.byteLength||
  view.getUint32(16,true)!==0x4e4f534a)
  throw Error('video3d_invalid_glb_header')
 const bytes=view.getUint32(12,true)
 if(bytes<=0||bytes>buffer.byteLength-20)
  throw Error('video3d_invalid_glb_json')
 let gltf:{asset?:{version?:string};images?:{uri?:string}[];
  buffers?:{uri?:string}[];extensionsUsed?:string[]}
 try{gltf=JSON.parse(new TextDecoder().decode(new Uint8Array(buffer,20,bytes)))}
 catch{throw Error('video3d_invalid_glb_json')}
 if(gltf.asset?.version!=='2.0')throw Error('video3d_invalid_glb_version')
 for(const resource of [...(gltf.images??[]),...(gltf.buffers??[])]){
  if(resource.uri&&!/^data:[a-z0-9.+/-]+;base64,/i.test(resource.uri))
   throw Error('video3d_external_resources_blocked')
 }
}
