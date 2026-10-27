import {describe,it,expect} from 'vitest'
import {compileRealityRenderGraph,planRealityRenderGraph} from './reality-render-graph'
import {projectHandMaskPoint,handMatteValid,HAND_CHAINS} from './reality-hand-matte'
import {realityGpuBlendFragmentShader} from './reality-gpu-blend'

describe('SpakTok Render Graph — deterministic compositing',()=>{
 it('orders camera, graded surface, depth, AR, hand foreground, and output',()=>{
  const names=planRealityRenderGraph({gpuV2:true,face:true,handOcclusion:true,post:true})
  expect(names.map(x=>x.id)).toEqual(['camera','beauty','depth','ar','hands','output'])
 })
 it('uses safe legacy planning without unnecessary 3D/hand passes',()=>{
  const names=planRealityRenderGraph({gpuV2:false,face:false,handOcclusion:false,post:false})
  expect(names.map(x=>x.id)).toEqual(['camera','beauty','output'])
  const only3D=planRealityRenderGraph({gpuV2:true,face:true,handOcclusion:false,post:false})
  expect(only3D.map(x=>x.id)).toEqual(['camera','beauty','depth','ar','output'])
 })
 it('rejects invalid forward dependencies and duplicate stage names',()=>{
  expect(()=>compileRealityRenderGraph([
   {id:'a',stage:'tracked-objects',needs:['missing'],enabled:true},
  ])).toThrow('reality_render_dependency')
  expect(()=>compileRealityRenderGraph([
   {id:'a',stage:'camera-background',needs:[],enabled:true},
   {id:'a',stage:'post-and-output',needs:[],enabled:true},
  ])).toThrow('reality_invalid_render_node')
 })
 it('restores only hand pixels via masked GPU foreground composition',()=>{
  expect(realityGpuBlendFragmentShader).toContain('uniform sampler2D uHandMask')
  expect(realityGpuBlendFragmentShader).toContain('mix(mixed,base,mask)')
  expect(realityGpuBlendFragmentShader).toContain('mix(base,reality,clamp(uIntensity,0.0,1.0))')
 })
})
describe('Landmark-only hand matte conservative geometry',()=>{
 const frame={
  sourceWidth:1080,sourceHeight:1920,
  outputWidth:540,outputHeight:960,
  mirror:false,now:1000,
 }
 const pts=Array.from({length:21},()=>({x:.5,y:.5,z:0}))
 const hand={landmarks:pts,handedness:'Right' as const,timestamp:960}
 it('uses every MediaPipe finger chain and a palm rather than an all-frame sticker',()=>{
  expect(HAND_CHAINS).toHaveLength(5)
  expect(HAND_CHAINS.flat().includes(20)).toBe(true)
  expect(HAND_CHAINS.flat().includes(4)).toBe(true)
  expect(handMatteValid(hand,frame.now)).toBe(true)
  expect(handMatteValid({...hand,timestamp:100},frame.now)).toBe(false)
 })
 it('projects the camera crop, mirror and portrait coordinates only once',()=>{
  const p={x:.32,y:.43,z:0}
  const one=projectHandMaskPoint(p,frame)!
  const mirrored=projectHandMaskPoint(p,{...frame,mirror:true})!
  expect(one.x+mirrored.x).toBeCloseTo(540)
  expect(one.y).toBeCloseTo(mirrored.y)
  expect(projectHandMaskPoint(p,{...frame,sourceWidth:0})).toBeNull()
 })
})
