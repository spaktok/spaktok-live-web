import {describe,expect,it} from 'vitest'
import {computeMakeupMasks,getMakeupPalette,isMakeupLook,makeupLooks} from './makeup3d'
import {faceFxCatalog} from './params'
const face=Array.from({length:478},()=>({x:.5,y:.49,z:0}))
const set=(i:number,x:number,y:number)=>{face[i]={x,y,z:0}}
const pairs=[
 [33,.36,.42],[133,.45,.42],[159,.405,.402],[145,.405,.440],
 [362,.55,.42],[263,.64,.42],[386,.595,.402],[374,.595,.440],
 [234,.23,.54],[454,.77,.54],
 [61,.43,.69],[40,.45,.68],[37,.47,.662],[0,.5,.662],[267,.53,.662],[270,.55,.68],[291,.57,.69],
 [321,.55,.715],[314,.53,.73],[17,.5,.737],[84,.47,.73],[91,.45,.715],
 [78,.44,.695],[191,.46,.69],[80,.47,.683],[81,.48,.680],[82,.49,.684],[13,.50,.683],
 [312,.51,.684],[311,.52,.680],[310,.53,.683],[415,.54,.690],[308,.56,.695],
 [324,.54,.704],[318,.53,.710],[402,.52,.710],[317,.51,.708],[14,.50,.707],
 [87,.49,.708],[178,.48,.710],[88,.47,.710],[95,.46,.704],
 [50,.36,.56],[101,.33,.57],[205,.35,.61],[117,.32,.6],
 [280,.64,.56],[330,.67,.57],[425,.65,.61],[346,.68,.6],
 [123,.28,.66],[147,.26,.65],[187,.30,.64],
 [352,.72,.66],[376,.74,.65],[411,.70,.64],
 [6,.5,.50],[168,.5,.53],[197,.5,.56],
] as const
for(const [id,x,y] of pairs)set(id,x,y)
describe('landmark-anchored Face Couture makeup',()=>{
 it('provides eight original makeup looks in the same face catalogue',()=>{
  expect(makeupLooks).toHaveLength(8)
  for(const look of makeupLooks){
   expect(isMakeupLook(look.id)).toBe(true)
   expect(faceFxCatalog.some(fx=>fx.id===look.id&&fx.group==='makeup')).toBe(true)
   expect(getMakeupPalette(look.id).coverage.every(x=>x>=0&&x<=1)).toBe(true)
  }
 })
 it('computes 7 semantic makeup masks at 478 vertices, not global color grading',()=>{
  const {masksA,masksB}=computeMakeupMasks(face,9/16)
  expect(masksA.length).toBe(478*4)
  expect(masksB.length).toBe(478*4)
  for(const item of [...masksA,...masksB])expect(item).toBeGreaterThanOrEqual(0)
  for(const item of [...masksA,...masksB])expect(item).toBeLessThanOrEqual(1)
  for(const offset of [0,1,2,3])expect(masksA.some((_,i)=>i%4===offset&&masksA[i]>.01)).toBe(true)
  for(const offset of [0,1,2])expect(masksB.some((_,i)=>i%4===offset&&masksB[i]>.01)).toBe(true)
 })
 it('returns neutral surface when there is no detected face',()=>{
  const result=computeMakeupMasks([],9/16)
  expect(result.masksA.every(v=>v===0)).toBe(true)
  expect(result.masksB.every(v=>v===0)).toBe(true)
 })
 it('makes different looks visually distinguishable by material and intensity',()=>{
  const soft=getMakeupPalette('3d-makeup-soft')
  const neon=getMakeupPalette('3d-makeup-neon')
  expect(soft.shadow).not.toBe(neon.shadow)
  expect(soft.coverage[3]).toBeLessThan(neon.coverage[3])
 })
})
