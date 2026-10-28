/** Camera-local MediaPipe 52-score (including neutral) to imported GLB
 * blendshapes. The neutral score is never applied to a mesh; exactly 51
 * expression targets can be animated if the authored GLB contains them.
 * Missing morph geometries are NOT synthesized. This is an inference/
 * retargeting adapter, not a claim that a model has ARKit facial anatomy.
 *
 * Official label order: MediaPipe FaceLandmarker blendshapes_graph.cc.
 * The Left/Right suffix denotes the PERSON, not the mirrored viewer.
 */
import {
 getAvatarMorphBindings,type AvatarExpression,
} from './reality-avatar-retarget'

export const MEDIAPIPE_FACE_BLENDSHAPES=[
 '_neutral',
 'browDownLeft','browDownRight','browInnerUp',
 'browOuterUpLeft','browOuterUpRight','cheekPuff',
 'cheekSquintLeft','cheekSquintRight',
 'eyeBlinkLeft','eyeBlinkRight',
 'eyeLookDownLeft','eyeLookDownRight',
 'eyeLookInLeft','eyeLookInRight',
 'eyeLookOutLeft','eyeLookOutRight',
 'eyeLookUpLeft','eyeLookUpRight',
 'eyeSquintLeft','eyeSquintRight',
 'eyeWideLeft','eyeWideRight',
 'jawForward','jawLeft','jawOpen','jawRight',
 'mouthClose','mouthDimpleLeft','mouthDimpleRight',
 'mouthFrownLeft','mouthFrownRight','mouthFunnel',
 'mouthLeft','mouthLowerDownLeft','mouthLowerDownRight',
 'mouthPressLeft','mouthPressRight','mouthPucker','mouthRight',
 'mouthRollLower','mouthRollUpper',
 'mouthShrugLower','mouthShrugUpper',
 'mouthSmileLeft','mouthSmileRight',
 'mouthStretchLeft','mouthStretchRight',
 'mouthUpperUpLeft','mouthUpperUpRight',
 'noseSneerLeft','noseSneerRight',
] as const
export type MediaPipeBlendshape=(typeof MEDIAPIPE_FACE_BLENDSHAPES)[number]
export type ActiveFaceBlendshape=Exclude<MediaPipeBlendshape,'_neutral'>
export type FaceChannelFrame=Readonly<Record<ActiveFaceBlendshape,number>>
export type FullFaceBinding=Readonly<{
 key:ActiveFaceBlendshape;index:number;target:string
}>
export type FaceRigCoverage=Readonly<{
 supported:number;total:51
 missing:readonly ActiveFaceBlendshape[]
 fraction:number
 level:'none'|'starter'|'partial'|'complete'
}>
const ACTIVE=MEDIAPIPE_FACE_BLENDSHAPES.slice(1) as ActiveFaceBlendshape[]
const clamp=(v:number)=>Number.isFinite(v)?Math.min(1,Math.max(0,v)):0
const normalize=(name:string)=>name.replace(/[^a-z0-9]/gi,'').toLowerCase()
export function neutralFaceChannelFrame():FaceChannelFrame{
 return Object.fromEntries(ACTIVE.map(n=>[n,0])) as FaceChannelFrame
}
/** Invalid NaN or Infinity scores become neutral. Do not turn a missing
 * detector frame into invented facial expressions. */
export function faceChannelFrameFromMediaPipe(
 values:Readonly<Record<string,number>>|null|undefined,
):FaceChannelFrame{
 const byName=new Map<string,number>()
 for(const [name,value] of Object.entries(values??{}))
  if(Number.isFinite(value))byName.set(normalize(name),clamp(value))
 return Object.fromEntries(ACTIVE.map(name=>
  [name,byName.get(normalize(name))??0])) as unknown as FaceChannelFrame
}
/** Starter/manual rigs still animate exactly their authored seven channels.
 * Unavailable 44 advanced channels stay at neutral.
 */
export function faceChannelFrameFromStarter(
 values:AvatarExpression,
):FaceChannelFrame{
 const out=neutralFaceChannelFrame() as Record<ActiveFaceBlendshape,number>
 for(const name of [
  'jawOpen','eyeBlinkLeft','eyeBlinkRight','mouthSmileLeft',
  'mouthSmileRight','browInnerUp','mouthPucker',
 ] as const)out[name]=clamp(values[name])
 return out
}
export function smoothFaceChannelFrame(
 previous:FaceChannelFrame,next:FaceChannelFrame,alpha=.3,
):FaceChannelFrame{
 const a=clamp(alpha)
 return Object.fromEntries(ACTIVE.map(name=>[
  name,clamp(previous[name]+(next[name]-previous[name])*a),
 ])) as unknown as FaceChannelFrame
}
/** First use exact 51 canonical names. Then use existing VRM/legacy aliases
 * solely for those canonical channels still absent. No index can be
 * bound twice or copied from a different, similarly named expression.
 */
export function getFullFaceMorphBindings(
 dict:Readonly<Record<string,number>>|undefined,
):readonly FullFaceBinding[]{
 if(!dict)return []
 const entries=Object.entries(dict).filter(([,index])=>
  Number.isSafeInteger(index)&&index>=0&&index<4096)
 const used=new Set<number>(),bound=new Set<string>()
 const result:FullFaceBinding[]=[]
 for(const name of ACTIVE){
  const direct=entries.find(([target,index])=>
   normalize(target)===normalize(name)&&!used.has(index))
  if(!direct)continue
  result.push({key:name,index:direct[1],target:direct[0]})
  used.add(direct[1]);bound.add(name)
 }
 const fallbacks=getAvatarMorphBindings(dict)
 for(const entry of fallbacks){
  if(bound.has(entry.key)||used.has(entry.index))continue
  result.push({key:entry.key,index:entry.index,target:entry.name})
  used.add(entry.index);bound.add(entry.key)
 }
 return result
}
export function inspectFullFaceRig(
 dicts:ReadonlyArray<Readonly<Record<string,number>>|undefined>,
):FaceRigCoverage{
 const names=new Set<ActiveFaceBlendshape>()
 for(const dict of dicts)
  for(const entry of getFullFaceMorphBindings(dict))names.add(entry.key)
 const missing=ACTIVE.filter(name=>!names.has(name))
 const supported=names.size
 return {
  supported,total:51,missing,fraction:supported/51,
  level:supported===51?'complete':
   supported>=15?'partial':supported>0?'starter':'none',
 }
}
