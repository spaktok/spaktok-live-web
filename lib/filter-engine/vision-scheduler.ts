/** CPU inference scheduler: draw frames can remain 30–60 FPS while mesh
 * detection adapts to actual device throughput and battery class.
 * We never allow overlapping inference calls.
 */
export function trackingIntervalMs(
 meanInferenceMs:number,
 cores:number,
 deviceMemoryGb:number | undefined,
 segmentation:boolean,
){
 if(segmentation)return Math.max(125,Math.min(350,meanInferenceMs*1.8))
 const low=cores<=4||(typeof deviceMemoryGb==='number'&&deviceMemoryGb<=3)
 const baseline=low?95:cores<=6?68:43
 return Math.max(baseline,Math.min(250,meanInferenceMs*1.7))
}
export function updatedMean(previous:number,sample:number){
 const value=Math.max(1,Math.min(500,sample))
 return previous===0?value:previous*0.75+value*0.25
}
