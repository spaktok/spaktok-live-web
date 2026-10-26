import {describe,expect,it,vi} from 'vitest'
import * as THREE from 'three'
import {backgroundModes,faceFxCatalog,filterPresets,fxList,neutralBeauty} from './params'
import {
 REALITY_EFFECTS,REALITY_MANIFEST_VERSION,
 assertRealityEffect,getRealityEffect,getFaceRealityEffect,
} from './reality-effect-manifest'
import {RealityEffectRuntime} from './reality-effect-runtime'
import {resolveRealityAnchor,solveRealityMount} from './reality-effect-anchors'
import {crownMountPosition} from './face3d'

describe('SpakTok universal Reality Effect contract',()=>{
 it('covers EVERY face effect, color preset, background and post processor',()=>{
  const faceIds=faceFxCatalog.filter(x=>x.id!=='none').map(x=>x.id)
  for(const id of faceIds)expect(getRealityEffect(id)?.id).toBe(id)
  for(const f of filterPresets)expect(getRealityEffect('grade:'+f.id)?.kind).toBe('color-grade')
  for(const fx of fxList)expect(getRealityEffect('post:'+fx)?.kind).toBe('post-process')
  for(const bg of backgroundModes)expect(getRealityEffect('background:'+bg)?.kind).toBe('background')
  for(const key of Object.keys(neutralBeauty))expect(getRealityEffect('beauty:'+key)?.kind).toBe('face-deform')
  expect(new Set(REALITY_EFFECTS.map(x=>x.id)).size).toBe(REALITY_EFFECTS.length)
  expect(getFaceRealityEffect('none')).toBeNull()
  expect(getRealityEffect('unknown')).toBeNull()
  for(const def of REALITY_EFFECTS){
   expect(def.schemaVersion).toBe(REALITY_MANIFEST_VERSION)
   expect(()=>assertRealityEffect(def)).not.toThrow()
  }
 })
 it('reports actual authored 3D assets, never procedural geometry as HD',()=>{
  const crown=getRealityEffect('3d-gold-crown')!
  const crystal=getRealityEffect('3d-crystal')!
  expect(crown.quality).toBe('authored-glb')
  expect(crown.asset?.uri).toContain('spaktok-owner-crown-mobile.glb')
  expect(crystal.asset?.uri).toContain('spaktok-crystal.glb')
  expect(getRealityEffect('3d-lux-glasses')?.quality).toBe('procedural-preview')
  expect(getRealityEffect('3d-makeup-bridal')?.quality).toBe('tracked-mesh')
  expect(getRealityEffect('neon-glasses')?.quality).toBe('shader-only')
 })
 it('fails closed for external, traversal and cross-origin asset paths',()=>{
  const base=getRealityEffect('3d-crystal')!
  for(const bad of [
   'https://evil.example/steal.glb','//evil.example/model.glb',
   '/face-assets/../secrets.glb','/face-assets/model.glb?download=1',
   '/face-assets/%2e%2e/model.glb',
  ]){
   expect(()=>assertRealityEffect({...base,asset:{...base.asset!,uri:bad}}))
    .toThrow('reality_unsafe_asset_path')
  }
 })
 it('loads the authored mesh with user-defined calibration',async()=>{
  const load=vi.fn(async(uri:string)=>({asset:uri,prepared:false}))
  const calibrate=vi.fn((node:{asset:string;prepared:boolean})=>{node.prepared=true})
  const create=vi.fn(()=>({asset:'preview',prepared:false}))
  const runtime=new RealityEffectRuntime({loadAuthoredGLB:load,
   createProceduralPreview:create,calibrateAuthored:calibrate})
  const result=await runtime.instantiate(getRealityEffect('3d-gold-crown')!)
  expect(result.source).toBe('authored-glb')
  expect(result.quality).toBe('hd')
  expect(result.node.prepared).toBe(true)
  expect(load).toHaveBeenCalledOnce()
  expect(create).not.toHaveBeenCalled()
 })
 it('releases a partially loaded GLB if pivot calibration fails',async()=>{
  const dispose=vi.fn()
  const runtime=new RealityEffectRuntime({
    loadAuthoredGLB:async()=>({id:1}),
    calibrateAuthored:()=>{throw Error('invalid authoring scale')},
    disposeFailedAuthored:dispose,
    createProceduralPreview:()=>({id:2}),
  })
  const result=await runtime.instantiate(getRealityEffect('3d-gold-crown')!)
  expect(result.source).toBe('procedural-preview')
  expect(dispose).toHaveBeenCalledOnce()
  expect(dispose).toHaveBeenCalledWith({id:1})
 })
 it('degrades gracefully when an authored GLB is unavailable',async()=>{
  const runtime=new RealityEffectRuntime({
   loadAuthoredGLB:async()=>{throw Error('offline')},
   createProceduralPreview:()=>({preview:true}),
   calibrateAuthored:()=>{},
  })
  const result=await runtime.instantiate(getRealityEffect('3d-crystal')!)
  expect(result.quality).toBe('fallback')
  expect(result.source).toBe('procedural-preview')
  expect(result.node.preview).toBe(true)
  const makeup=await runtime.instantiate(getRealityEffect('3d-makeup-glam')!)
  expect(makeup.source).toBe('tracked-surface')
  await expect(runtime.instantiate(getRealityEffect('grade:original')!))
    .rejects.toThrow('reality_not_a_3d_effect')
 })
})

describe('Face-space anchors follow moving, tilted and mirrored heads',()=>{
 const points=Array.from({length:478},()=>({x:.5,y:.5,z:0}))
 points[10]={x:.32,y:.18,z:-.03}
 points[1]={x:.51,y:.49,z:0}
 points[33]={x:.40,y:.41,z:0}
 points[263]={x:.60,y:.41,z:0}
 points[168]={x:.50,y:.45,z:0}
 points[152]={x:.51,y:.85,z:0}

 it('projects forehead, eyes, nose and chin via one cover crop',()=>{
  const a=resolveRealityAnchor('forehead_center',points,720,1280,360,640,false)!
  expect(a.x).toBeCloseTo(.32*360)
  expect(a.y).toBeCloseTo(.18*640)
  const mirror=resolveRealityAnchor('forehead_center',points,720,1280,360,640,true)!
  expect(a.x+mirror.x).toBeCloseTo(360)
  expect(mirror.y).toBeCloseTo(a.y)
  const eyes=resolveRealityAnchor('eyes_center',points,720,1280,360,640,false,{x:160,y:245})!
  expect(eyes).toMatchObject({x:160,y:245})
  expect(resolveRealityAnchor('chin',points,720,1280,360,640,false)!.y).toBeGreaterThan(a.y)
 })
 it('does not claim approximate ears and scalp are precision anchors',()=>{
  expect(resolveRealityAnchor('left_ear',points,720,1280,360,640,false)!.approximate).toBe(true)
  expect(resolveRealityAnchor('head_top',points,720,1280,360,640,false)!.approximate).toBe(true)
  expect(resolveRealityAnchor('nose_tip',points,720,1280,360,640,false)!.approximate).toBe(false)
 })
 it('matches the legacy crown pivot under pitch, yaw, roll and translation',()=>{
  const pose={x:220,y:370,width:174,roll:.42,yaw:.31,pitch:-.18}
  const forehead={x:175,y:200,approximate:false}
  const out=solveRealityMount(forehead,pose.width,pose,[0,-.55,0],[0,-.018])!
  const old=crownMountPosition(pose,forehead)
  expect(out.x).toBeCloseTo(old.x,4)
  expect(out.y).toBeCloseTo(old.y,4)
  const moved=solveRealityMount({...forehead,x:forehead.x+30,y:forehead.y+40},
   pose.width,pose,[0,-.55,0],[0,-.018])!
  expect(moved.x-out.x).toBeCloseTo(30)
  expect(moved.y-out.y).toBeCloseTo(40)
 })
 it('uses the same XYZ Euler rotation convention as Three.js',()=>{
  const a={x:245,y:318,approximate:false},p={pitch:.4,yaw:-.6,roll:.35}
  const width=201,local=[.12,-.53,.14] as const
  const expected=new THREE.Vector3(...local).multiplyScalar(width)
    .applyEuler(new THREE.Euler(p.pitch*.7,p.yaw*.75,p.roll))
  const position=solveRealityMount(a,width,p,local)!
  expect(position.x).toBeCloseTo(a.x-expected.x,4)
  expect(position.y).toBeCloseTo(a.y-expected.y,4)
  expect(position.z).toBeCloseTo(18-expected.z,4)
 })
 it('rejects invalid or incomplete tracked faces rather than floating assets',()=>{
  expect(resolveRealityAnchor('nose_tip',[],720,1280,360,640,false)).toBeNull()
  expect(resolveRealityAnchor('chin',points,0,1280,360,640,false)).toBeNull()
  expect(solveRealityMount({x:0,y:0,approximate:false},0,{pitch:0,yaw:0,roll:0})).toBeNull()
 })
})
