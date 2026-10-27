import {describe,it,expect} from 'vitest'
import {
 VIDEO_3D_MAX_LAYERS,VIDEO_3D_MAX_DURATION_MS,createVideo3DLayer,
 createVideo3DProject,sampleVideo3DLayer,upsertVideo3DFrame,
 validateVideo3DProject,video3DOutputSize,assertSelfContainedVideo3DGlb,
 DEFAULT_VIDEO_3D_FRAME,
} from './reality-video3d-project'

function fixtureGlb(payload:unknown):ArrayBuffer{
 const json=JSON.stringify(payload)
 const encoded=new TextEncoder().encode(json)
 const padded=Math.ceil(encoded.length/4)*4
 const data=new ArrayBuffer(20+padded)
 const view=new DataView(data)
 view.setUint32(0,0x46546c67,true)
 view.setUint32(4,2,true)
 view.setUint32(8,data.byteLength,true)
 view.setUint32(12,padded,true)
 view.setUint32(16,0x4e4f534a,true)
 new Uint8Array(data,20).fill(0x20)
 new Uint8Array(data,20).set(encoded)
 return data
}
const source={name:'offline.mp4',width:1920,height:1080,durationMs:15_000}
const projectWith=(layers:ReturnType<typeof createVideo3DLayer>[])=>({
 ...createVideo3DProject(),source,layers,
})

describe('SpakTok offline video 3D model authoring',()=>{
 it('creates a safe unpublished JSON project and validates different primitives',()=>{
  const layers=['box','sphere','torus','cone','octahedron'].map((kind,i)=>
   createVideo3DLayer('model-'+i,kind as 'box'|'sphere'|'torus'|'cone'|'octahedron'))
  const project=projectWith(layers)
  expect(()=>validateVideo3DProject(project)).not.toThrow()
  expect(project.published).toBe(false)
  expect(project.layers.length).toBe(5)
 })
 it('supports GLB but keeps only local asset names in project export',()=>{
  const layer=createVideo3DLayer('model-glb','glb','My imported head','head.glb')
  expect(layer.assetName).toBe('head.glb')
  expect(()=>validateVideo3DProject(projectWith([layer]))).not.toThrow()
  expect(()=>createVideo3DLayer('model-2','glb','No file')).toThrow()
 })
 it('interpolates 3D rotation, opacity, scale and screen anchors deterministically',()=>{
  const layer=createVideo3DLayer('model-a','box')
  const end={...DEFAULT_VIDEO_3D_FRAME,timeMs:1000,x:.4,y:-.2,
   scale:.6,rotationX:90,rotationY:180,rotationZ:360,opacity:.2}
  const next=upsertVideo3DFrame(layer,end,15_000)
  const midpoint=sampleVideo3DLayer(next,500)
  expect(midpoint.x).toBeCloseTo(.2)
  expect(midpoint.y).toBeCloseTo(-.1)
  expect(midpoint.scale).toBeCloseTo(.415)
  expect(midpoint.rotationX).toBeCloseTo(45)
  expect(midpoint.rotationY).toBeCloseTo(90)
  expect(midpoint.rotationZ).toBeCloseTo(180)
  expect(midpoint.opacity).toBeCloseTo(.6)
  expect(sampleVideo3DLayer(next,-100).timeMs).toBe(0)
  expect(sampleVideo3DLayer(next,2000).timeMs).toBe(1000)
  expect(()=>validateVideo3DProject(projectWith([next]))).not.toThrow()
 })
 it('updates the nearest existing keyframe instead of duplicating it',()=>{
  const first=createVideo3DLayer('model-a','sphere')
  const layer=upsertVideo3DFrame(first,
   {...DEFAULT_VIDEO_3D_FRAME,timeMs:2000,scale:.4},15_000)
  const again=upsertVideo3DFrame(layer,
   {...DEFAULT_VIDEO_3D_FRAME,timeMs:2010,scale:.8},15_000)
  expect(again.keyframes.length).toBe(2)
  expect(again.keyframes[1].timeMs).toBe(2000)
  expect(again.keyframes[1].scale).toBe(.8)
 })
 it('rejects unbounded, unsorted, duplicate and invalid layers/keyframes',()=>{
  const layer=createVideo3DLayer('model-a','box')
  expect(()=>validateVideo3DProject(projectWith([layer,layer]))).toThrow()
  const tooMany=Array.from({length:VIDEO_3D_MAX_LAYERS+1},(_,i)=>
   createVideo3DLayer('model-'+i,'box'))
  expect(()=>validateVideo3DProject(projectWith(tooMany))).toThrow()
  expect(()=>validateVideo3DProject(projectWith([
   {...layer,keyframes:[...layer.keyframes,...layer.keyframes]},
  ]))).toThrow()
  expect(()=>validateVideo3DProject(projectWith([
   {...layer,keyframes:[{...DEFAULT_VIDEO_3D_FRAME,scale:Infinity}]},
  ]))).toThrow()
  expect(()=>validateVideo3DProject({
   ...projectWith([layer]),published:true as false,
  })).toThrow()
  expect(()=>validateVideo3DProject({
   ...projectWith([layer]),source:{...source,durationMs:VIDEO_3D_MAX_DURATION_MS+1},
  })).toThrow()
 })
 it('preserves aspect ratio and even output dimensions',()=>{
  expect(video3DOutputSize(1920,1080)).toEqual({width:1280,height:720})
  expect(video3DOutputSize(1080,1920)).toEqual({width:720,height:1280})
  expect(video3DOutputSize(601,601)).toEqual({width:602,height:602})
  expect(()=>video3DOutputSize(0,1080)).toThrow()
 })
 it('rejects remote GLB buffers and textures before parsing',()=>{
  expect(()=>assertSelfContainedVideo3DGlb(fixtureGlb({asset:{version:'2.0'},
   buffers:[{byteLength:36}],images:[{bufferView:0}]}))).not.toThrow()
  for(const data of [
   {asset:{version:'2.0'},images:[{uri:'https://bad.example/track.png'}]},
   {asset:{version:'2.0'},buffers:[{uri:'../../private.bin'}]},
   {asset:{version:'1.0'}},
  ])expect(()=>assertSelfContainedVideo3DGlb(fixtureGlb(data))).toThrow()
  expect(()=>assertSelfContainedVideo3DGlb(new ArrayBuffer(5))).toThrow()
 })
})
