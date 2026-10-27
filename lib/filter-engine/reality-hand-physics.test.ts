import {describe,it,expect} from 'vitest'
import {DEFAULT_CANONICAL_HEAD,estimateMetricFaceScale,validateAuthoringAsset} from './reality-canonical-head'
import {RealityHandPhysics,handGripPoint,type TrackedHand} from './reality-hand-physics'
const frame=(now:number,mirror=false)=>({
 sourceWidth:1000,sourceHeight:1000,outputWidth:1000,outputHeight:1000,
 mirror,now,
})
function hand(now:number,thumb={x:.49,y:.50},index={x:.51,y:.50},
 handedness:'Left'|'Right'='Right'):TrackedHand{
 const landmarks=Array.from({length:21},()=>({x:.50,y:.50,z:0}))
 landmarks[0]={x:.5,y:.70,z:0}
 landmarks[9]={x:.5,y:.50,z:0}
 landmarks[4]={...thumb,z:0}
 landmarks[8]={...index,z:0}
 return {landmarks,handedness,timestamp:now}
}
const home={x:500,y:500,z:18,pitch:0,yaw:0,roll:0}
describe('Reality canonical metric model contracts',()=>{
 it('uses reference units transparently without calling them personal physical measurements',()=>{
  expect(DEFAULT_CANONICAL_HEAD.referenceInterpupillaryDistanceM).toBe(.063)
  expect(DEFAULT_CANONICAL_HEAD.confidence).toBe('nominal-not-measured')
  const estimate=estimateMetricFaceScale({x:.4,y:.5},{x:.6,y:.5},
   {width:1000,height:1000},{width:1000,height:1000})!
  expect(estimate.confidence).toBe('estimated')
  expect(estimate.measuredEyeDistancePx).toBeCloseTo(200)
  expect(estimate.pixelsPerMeter).toBeCloseTo(200/.063)
  expect(estimateMetricFaceScale({x:0,y:0},{x:0,y:0},
   {width:1000,height:1000},{width:1000,height:1000})).toBeNull()
 })
 it('checks first-party GLB, pivot and author-declared physically based materials',()=>{
  const item={id:'glasses-v1',uri:'/face-assets/glasses-v1.glb',category:'glasses' as const,
   units:'meter' as const,pivotM:[0,0,0] as const,
   grippingPointsM:[[0.08,-.03,0]] as const,supportsArticulatedRig:true,
   materials:{pbrMetallicRoughness:true,normalMap:true,occlusionMap:true}}
  expect(validateAuthoringAsset(item)).toBe(item)
  expect(()=>validateAuthoringAsset({...item,uri:'https://other.site/x.glb'}))
   .toThrow('reality_untrusted_authoring_asset')
  expect(()=>validateAuthoringAsset({...item,pivotM:[Infinity,0,0] as const}))
   .toThrow('reality_invalid_metric_pivot')
 })
})
describe('Hands grab, carry and release 3D wearables rather than cancel effects',()=>{
 it('rejects invalid frames and projects mirror exactly once',()=>{
  const a=handGripPoint(hand(100),frame(100))!
  const b=handGripPoint(hand(100),frame(100,true))!
  expect(a.x+b.x).toBeCloseTo(1000)
  expect(a.y).toBeCloseTo(b.y)
  expect(a.pinch).toBeLessThan(.38)
  expect(handGripPoint(hand(100),frame(600))).toBeNull()
  expect(handGripPoint({...hand(100),landmarks:[]},frame(100))).toBeNull()
 })
 it('uses a two-detection pinch threshold and smooth pose interpolation',()=>{
  const physics=new RealityHandPhysics()
  expect(physics.step(home,220,[hand(100)],frame(100)).state).toBe('mounted')
  const grabbed=physics.step(home,220,[hand(220)],frame(220))
  expect(grabbed.state).toBe('grabbed')
  const moved=physics.step(home,220,[
   hand(340,{x:.68,y:.35},{x:.70,y:.35}),
  ],frame(340))
  expect(moved.state).toBe('grabbed')
  expect(moved.pose.x).toBeGreaterThan(home.x)
  expect(moved.pose.y).toBeLessThan(home.y)
  expect(moved.pose.z).toBeGreaterThan(home.z)
 })
 it('rotates the actual virtual object when the hand tilts',()=>{
  const physics=new RealityHandPhysics()
  physics.step(home,220,[hand(100)],frame(100))
  physics.step(home,220,[hand(220)],frame(220))
  const rotated=physics.step(home,220,[hand(340,{x:.50,y:.48},{x:.50,y:.52})],frame(340))
  expect(Math.abs(rotated.pose.roll)).toBeGreaterThan(.05)
  expect(rotated.state).toBe('grabbed')
 })
 it('uses open fingers to release and return to the face by spring motion',()=>{
  const physics=new RealityHandPhysics()
  physics.step(home,220,[hand(100)],frame(100))
  physics.step(home,220,[hand(220)],frame(220))
  const moved=physics.step(home,220,[hand(340,{x:.69,y:.48},{x:.71,y:.48})],frame(340))
  const release=physics.step(home,220,[hand(450,{x:.4,y:.5},{x:.7,y:.5})],frame(450))
  expect(release.state).toBe('returning')
  expect(release.pose.x).toBeGreaterThan(home.x)
  let result=release
  for(let n=0;n<160;n++)result=physics.step(home,220,[],frame(467+n*16))
  expect(result.state).toBe('mounted')
  expect(result.pose.x).toBeCloseTo(home.x,0)
  expect(moved.pose.x).toBeGreaterThan(home.x)
 })
 it('releases safely when the hand disappears, without deleting the effect',()=>{
  const physics=new RealityHandPhysics()
  physics.step(home,220,[hand(100)],frame(100))
  physics.step(home,220,[hand(220)],frame(220))
  expect(physics.step(home,220,[],frame(300)).state).toBe('grabbed')
  const lost=physics.step(home,220,[],frame(600))
  expect(lost.state).toBe('returning')
  expect(lost.pose).toBeDefined()
 })
 it('never allows a distant pinch to steal the glasses',()=>{
  const physics=new RealityHandPhysics()
  const far=hand(100,{x:.05,y:.06},{x:.07,y:.06})
  expect(physics.step(home,220,[far],frame(100)).state).toBe('mounted')
  expect(physics.step(home,220,[{...far,timestamp:220}],frame(220)).state).toBe('mounted')
 })
})
