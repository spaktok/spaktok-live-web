import {describe,expect,it} from 'vitest'
import {
 buildLiveSculptWarp,sculptLiveFaceVertices,hasLiveSculpt,
 normalizeLiveSculpt,LIVE_SCULPT_GRID_SIZE,NEUTRAL_LIVE_SCULPT,
} from './reality-live-sculpt-warp'

const canonical=()=>{
 const a=Array.from({length:478},()=>({x:.5,y:.58,z:0}))
 const positions:Record<number,[number,number]>={
  234:[.30,.55],454:[.70,.55],172:[.36,.78],397:[.64,.78],
  152:[.5,.92],33:[.35,.38],133:[.45,.38],
  362:[.55,.38],263:[.65,.38],
  159:[.35,.345],145:[.35,.415],386:[.65,.345],374:[.65,.415],
  1:[.5,.58],4:[.5,.65],94:[.5,.67],168:[.5,.46],
  49:[.465,.61],279:[.535,.61],
 }
 for(const [k,[x,y]] of Object.entries(positions))a[Number(k)]={x,y,z:0}
 return a
}
const vp={sourceWidth:1080,sourceHeight:1080,outputWidth:720,
 outputHeight:720,mirror:true}
const triangles=new Uint16Array([
 234,172,152,234,152,454,454,152,397,
 33,159,133,362,263,386,
  49,1,94,279,94,1,
])
describe('Per-broadcaster personally tracked triangle beauty warp',()=>{
 it('is disabled by default and bounds every user setting',()=>{
  expect(hasLiveSculpt(NEUTRAL_LIVE_SCULPT)).toBe(false)
  expect(normalizeLiveSculpt({jaw:99,nose:-3,eyes:NaN,chin:.33}))
   .toEqual({jaw:.65,chin:.33,eyes:0,nose:0})
  expect(buildLiveSculptWarp(canonical(),triangles,NEUTRAL_LIVE_SCULPT,vp)).toBeNull()
 })
 it('moves only anatomy-relative jaw, chin, eye and nose areas',()=>{
  const lm=canonical()
  const jaw=sculptLiveFaceVertices(lm,{jaw:.6,chin:0,eyes:0,nose:0},1)!
  expect(jaw[172].x).toBeGreaterThan(lm[172].x)
  expect(jaw[397].x).toBeLessThan(lm[397].x)
  const chin=sculptLiveFaceVertices(lm,{jaw:0,chin:.6,eyes:0,nose:0},1)!
  expect(chin[152].y).toBeLessThan(lm[152].y)
  const eye=sculptLiveFaceVertices(lm,{jaw:0,chin:0,eyes:.6,nose:0},1)!
  expect(eye[159].x).toBeLessThan(lm[159].x)
  const nose=sculptLiveFaceVertices(lm,{jaw:0,chin:0,eyes:0,nose:.6},1)!
  expect(nose[49].x).toBeGreaterThan(lm[49].x)
  // A measured pupil center should not fly off screen.
  for(const p of nose)expect([p.x,p.y].every(Number.isFinite)).toBe(true)
 })
 it('creates a bounded inverse displacement RGBA texture on real face triangles',()=>{
  const mesh=buildLiveSculptWarp(canonical(),triangles,
   {jaw:.25,chin:.16,eyes:.18,nose:.15},vp,80)
  expect(mesh).not.toBeNull()
  expect(mesh?.width).toBe(80)
  expect(mesh?.sourcePoints).toBe(478)
  expect(mesh?.triangleCount).toBeGreaterThan(0)
  expect(mesh?.data.length).toBe(80*80*4)
  expect(Array.from(mesh!.data).every(x=>Number.isSafeInteger(x)&&x>=0&&x<=255)).toBe(true)
  const changed=Array.from(mesh!.data).some((v,i)=>i%4<2&&v!==128&&v!==127)
  expect(changed).toBe(true)
 })
 it('has stable top-left UV despite the camera selfie mirror',()=>{
  const lm=canonical(),c={jaw:.2,chin:0,eyes:0,nose:0}
  const a=buildLiveSculptWarp(lm,triangles,c,vp,64)
  const b=buildLiveSculptWarp(lm,triangles,c,{...vp,mirror:false},64)
  expect(a?.data).toEqual(b?.data)
 })
 it('does not process missing face, corrupt topology or extreme memory sizes',()=>{
  const lm=canonical()
  expect(buildLiveSculptWarp([],triangles,{jaw:.3,eyes:0,nose:0,chin:0},vp)).toBeNull()
  expect(buildLiveSculptWarp(lm,triangles,{jaw:.3,eyes:0,nose:0,chin:0},vp,1024)).toBeNull()
  expect(buildLiveSculptWarp(lm,new Uint16Array([478,1,2]),
   {jaw:.3,eyes:0,nose:0,chin:0},vp)).toBeNull()
  expect(buildLiveSculptWarp(lm,triangles,{jaw:.3,eyes:0,nose:0,chin:0},
   {...vp,sourceWidth:0})).toBeNull()
  expect(LIVE_SCULPT_GRID_SIZE).toBeLessThanOrEqual(256)
 })
})
