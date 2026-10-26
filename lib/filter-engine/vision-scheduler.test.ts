import{describe,expect,it}from'vitest'
import{trackingIntervalMs,updatedMean}from'./vision-scheduler'
describe('adaptive local face ML scheduler',()=>{
 it('uses faster tracking when performance allows',()=>{
   expect(trackingIntervalMs(10,8,8,false)).toBe(43)
   expect(trackingIntervalMs(10,4,2,false)).toBe(95)
 })
 it('protects slow devices and heavy background segmentation',()=>{
   expect(trackingIntervalMs(90,8,8,false)).toBeGreaterThanOrEqual(150)
   expect(trackingIntervalMs(35,8,8,true)).toBeGreaterThanOrEqual(125)
 })
 it('smooths inference latency spikes',()=>{
   expect(updatedMean(20,100)).toBe(40)
   expect(updatedMean(0,15)).toBe(15)
 })
})
