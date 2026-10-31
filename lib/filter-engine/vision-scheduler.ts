/** Single-flight on-device vision inference. Avoid inserting idle gaps
 * greater than model runtime: visible GLB follows the current head, without
 * trying to run overlapping expensive MediaPipe detectors.
 */
export function trackingIntervalMs(
 meanInferenceMs:number,
 cores:number,
 deviceMemoryGb:number|undefined,
 segmentation:boolean,
){
 if(segmentation)return Math.max(125,Math.min(350,meanInferenceMs*1.8))
 const low=cores<=4||(typeof deviceMemoryGb==='number'&&deviceMemoryGb<=3)
 const baseline=low?55:cores<=6?42:33
 return Math.max(baseline,Math.min(230,meanInferenceMs*1.1))
}
/** High end devices drop stale poses earlier; slow phones do not flicker
 * while inference is still running. Never keep a face for >375ms.
 */
export function trackingFreshnessMs(meanInferenceMs:number){
 if(!Number.isFinite(meanInferenceMs)||meanInferenceMs<=0)return 230
 return Math.round(Math.max(200,Math.min(375,meanInferenceMs*1.5+75)))
}
export function updatedMean(previous:number,sample:number){
 const value=Math.max(1,Math.min(500,sample))
 return previous===0?value:previous*.75+value*.25
}
