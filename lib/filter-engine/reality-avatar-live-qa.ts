/** Conservative live face QA: evaluates real tracker frames, not claimed
 * device benchmarks. Only usable, timely and sufficiently covered rigs pass.
 */
export type LiveFaceQASample=Readonly<{
 timestampMs:number;inferenceMs:number;hasFace:boolean
 validPose:boolean;blendshapeCount:number
}>
export type LiveFaceQAReport=Readonly<{
 samples:number;detected:number;usable:number
 detectionRate:number;usableRate:number
 p95InferenceMs:number|null;medianInferenceMs:number|null
 rigCoverage:number;verdict:'insufficient'|'fail'|'review'
 warnings:readonly string[]
}>
const finite=(n:number)=>Number.isFinite(n)&&n>=0
const percentile=(values:readonly number[],p:number)=>{
 if(!values.length)return null
 const sorted=[...values].sort((a,b)=>a-b)
 return sorted[Math.ceil(p*(sorted.length-1))]
}
export function evaluateLiveFaceQA(
 samples:readonly LiveFaceQASample[],rigCoverage:number,
):LiveFaceQAReport{
 const valid=samples.filter(s=>finite(s.timestampMs)&&finite(s.inferenceMs)
  &&Number.isSafeInteger(s.blendshapeCount)&&s.blendshapeCount>=0
  &&s.blendshapeCount<=52)
 const detected=valid.filter(s=>s.hasFace).length
 const usable=valid.filter(s=>s.hasFace&&s.validPose&&s.blendshapeCount>=7).length
 const inference=valid.map(s=>s.inferenceMs)
 const p95InferenceMs=percentile(inference,.95)
 const medianInferenceMs=percentile(inference,.5)
 const detectionRate=valid.length?detected/valid.length:0
 const usableRate=valid.length?usable/valid.length:0
 const warnings:string[]=[]
 if(valid.length<120)warnings.push('Record at least 120 valid frames before evaluating')
 if(rigCoverage<7)warnings.push('Imported GLB exposes fewer than seven face channels')
 if(detectionRate<.9)warnings.push('Face detection below 90% of sampled frames')
 if(usableRate<.85)warnings.push('Usable tracking below 85% of sampled frames')
 if(p95InferenceMs!==null&&p95InferenceMs>75)
  warnings.push('95th-percentile inference exceeds 75 ms')
 const verdict=valid.length<120?'insufficient':
  warnings.length?'fail':'review'
 return {samples:valid.length,detected,usable,detectionRate,usableRate,
  p95InferenceMs,medianInferenceMs,rigCoverage,verdict,warnings}
}
