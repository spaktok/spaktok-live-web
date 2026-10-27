/** SpakTok Reality — bounded, landmark-driven face morph field.
 * Works in normalized camera UV coordinates; does not project a second face.
 * This is a CPU reference solver for the GPU sampling implementation.
 */
export type MorphPoint=Readonly<{x:number;y:number}>
export type MorphControl=Readonly<{index:number;target:MorphPoint;radius:number;strength:number}>
export type MorphSample=Readonly<{x:number;y:number}>
const clamp=(v:number,a:number,b:number)=>Math.min(b,Math.max(a,v))
const finite=(p:MorphPoint)=>Number.isFinite(p.x)&&Number.isFinite(p.y)
/** Inverse sample coordinates for a smooth local image warp.
 * The user's own camera image is sampled at the returned coordinate.
 * The falloff is compact and zero at each control's radius.
 */
export function inverseFaceMorphSample(
 uv:MorphSample,landmarks:ReadonlyArray<MorphPoint>,
 controls:ReadonlyArray<MorphControl>,maxDisplacement=.085,
):MorphSample{
 if(!finite(uv)||!Number.isFinite(maxDisplacement)||maxDisplacement<0||maxDisplacement>.2)
  throw Error('reality_morph_invalid_input')
 let dx=0,dy=0,total=0
 for(const control of controls){
  const source=landmarks[control.index]
  if(!source||!finite(source)||!finite(control.target)||
   !Number.isFinite(control.radius)||control.radius<=0||
   !Number.isFinite(control.strength))continue
  const radius=clamp(control.radius,.005,.5)
  const d=Math.hypot(uv.x-control.target.x,uv.y-control.target.y)
  if(d>=radius)continue
  const t=1-d/radius
  const weight=t*t*(3-2*t)*clamp(control.strength,0,1)
  dx+=(source.x-control.target.x)*weight
  dy+=(source.y-control.target.y)*weight
  total+=weight
 }
 if(total===0)return uv
 const length=Math.hypot(dx,dy)
 const scale=length>maxDisplacement?maxDisplacement/length:1
 return {x:clamp(uv.x+dx*scale,0,1),y:clamp(uv.y+dy*scale,0,1)}
}
/** Derive shape controls from a neutral target without replacing identity.
 * An explicit strength of zero always produces an unmodified frame.
 */
export function buildFaceMorphControls(
 live:ReadonlyArray<MorphPoint>,target:ReadonlyArray<MorphPoint>,
 indices:readonly number[],strength:number,radius=.075,
):MorphControl[]{
 if(!Number.isFinite(strength)||strength<0||strength>1)
  throw Error('reality_morph_invalid_strength')
 if(live.length<468||target.length<468)return []
 return indices.flatMap(index=>{
  const a=live[index],b=target[index]
  if(!a||!b||!finite(a)||!finite(b)||index<0||index>=468)return []
  return [{index,target:{x:a.x+(b.x-a.x)*strength,y:a.y+(b.y-a.y)*strength},radius,strength:1}]
 })
}
