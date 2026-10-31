import {describe,expect,it} from 'vitest'
import{trackingIntervalMs,trackingFreshnessMs,updatedMean}from'./vision-scheduler'
describe('adaptive low-lag local face ML scheduler',()=>{
 it('avoids unnecessary idle between fast face detections',()=>{
   expect(trackingIntervalMs(10,8,8,false)).toBe(33)
   expect(trackingIntervalMs(10,4,2,false)).toBe(55)
   expect(trackingIntervalMs(90,8,8,false)).toBeCloseTo(99)
   expect(trackingIntervalMs(90,4,2,false)).toBeCloseTo(99)
 })
 it('respects slow devices and expensive segmentation',()=>{
   expect(trackingIntervalMs(450,4,2,false)).toBe(230)
   expect(trackingIntervalMs(35,8,8,true)).toBeGreaterThanOrEqual(125)
 })
 it('limits stale-3D-frame duration as face inference varies',()=>{
   expect(trackingFreshnessMs(10)).toBe(200)
   expect(trackingFreshnessMs(95)).toBe(218)
   expect(trackingFreshnessMs(300)).toBe(375)
   expect(trackingFreshnessMs(0)).toBe(230)
 })
 it('smooths occasional inference latency spikes',()=>{
   expect(updatedMean(20,100)).toBe(40)
   expect(updatedMean(0,15)).toBe(15)
 })
})
