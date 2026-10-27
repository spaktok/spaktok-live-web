/** Browser-local avatar expression retargeting. MediaPipe outputs 52 named
 * blendshapes; authored glTF meshes may use ARKit, generic or VRM-style aliases.
 * Absent targets never pretend to animate, and missing faces fail closed.
 */
export const AVATAR_MAX_GLB_BYTES=15*1024*1024
export type AvatarExpression=Readonly<{
 jawOpen:number;eyeBlinkLeft:number;eyeBlinkRight:number
 mouthSmileLeft:number;mouthSmileRight:number;browInnerUp:number;mouthPucker:number
}>
export const NEUTRAL_AVATAR_EXPRESSION:AvatarExpression=Object.freeze({
 jawOpen:0,eyeBlinkLeft:0,eyeBlinkRight:0,mouthSmileLeft:0,
 mouthSmileRight:0,browInnerUp:0,mouthPucker:0,
})
export type AvatarHeadPose=Readonly<{yaw:number;pitch:number;roll:number}>
export const NEUTRAL_AVATAR_HEAD:AvatarHeadPose=Object.freeze({yaw:0,pitch:0,roll:0})
const clamp=(v:number,a:number,b:number)=>Number.isFinite(v)?Math.max(a,Math.min(b,v)):a
const aliases:Readonly<Record<keyof AvatarExpression,readonly string[]>>={
 jawOpen:['jawOpen','mouthOpen','Mouth_Open','viseme_aa','Fcl_MTH_A'],
 eyeBlinkLeft:['eyeBlinkLeft','eyeBlink_L','blink_L','eyeBlink_L','Fcl_EYE_Close_L'],
 eyeBlinkRight:['eyeBlinkRight','eyeBlink_R','blink_R','eyeBlink_R','Fcl_EYE_Close_R'],
 mouthSmileLeft:['mouthSmileLeft','mouthSmile_L','smile_L','Fcl_MTH_Joy_L'],
 mouthSmileRight:['mouthSmileRight','mouthSmile_R','smile_R','Fcl_MTH_Joy_R'],
 browInnerUp:['browInnerUp','browUp','BrowsUp'],
 mouthPucker:['mouthPucker','mouthPout','viseme_O','Fcl_MTH_O'],
}
const keys=Object.keys(NEUTRAL_AVATAR_EXPRESSION) as (keyof AvatarExpression)[]
const normalize=(value:string)=>value.replace(/[^a-z0-9]/gi,'').toLowerCase()
export function avatarExpressionFromMediaPipe(
 values:Readonly<Record<string,number>>|null|undefined,
):AvatarExpression{
 const normalized=new Map<string,number>()
 for(const [k,v] of Object.entries(values??{}))
  if(Number.isFinite(v))normalized.set(normalize(k),clamp(v,0,1))
 const get=(name:keyof AvatarExpression)=>{
  for(const candidate of aliases[name]){
   const v=normalized.get(normalize(candidate))
   if(v!==undefined)return v
  }
  return 0
 }
 return Object.fromEntries(keys.map(key=>[key,get(key)])) as unknown as AvatarExpression
}
export function smoothAvatarExpression(
 previous:AvatarExpression,next:AvatarExpression,alpha=.5,
):AvatarExpression{
 const a=clamp(alpha,0,1)
 return Object.fromEntries(keys.map(key=>
  [key,clamp(previous[key]+(next[key]-previous[key])*a,0,1)]
 )) as unknown as AvatarExpression
}
export function getAvatarMorphBindings(
 dictionary:Readonly<Record<string,number>>|undefined,
):ReadonlyArray<Readonly<{key:keyof AvatarExpression;index:number;name:string}>>{
 if(!dictionary)return []
 const entries=Object.entries(dictionary)
 const used=new Set<number>()
 const matches:{key:keyof AvatarExpression;index:number;name:string}[]=[]
 for(const key of keys){
  for(const alias of aliases[key]){
   const matching=entries.find(([name,index])=>
    normalize(name)===normalize(alias)&&Number.isSafeInteger(index)&&index>=0&&!used.has(index))
   if(matching){
    used.add(matching[1])
    matches.push({key,index:matching[1],name:matching[0]})
    break
   }
  }
 }
 return matches
}
/** Pose inferred from the tracked person's own 2D face, not a 3D face scan.
 * Selfie mirror flips yaw/roll once; portrait offset is not assumed fixed.
 */
export function avatarPoseFromLandmarks(
 points:ReadonlyArray<Readonly<{x:number;y:number;z:number}>>,
 mirror=true,
):AvatarHeadPose|null{
 if(points.length<468)return null
 const ids=[33,263,1,4,168,152] as const
 if(ids.some(i=>!points[i]||![points[i].x,points[i].y,points[i].z].every(Number.isFinite)))
  return null
 const left=points[33],right=points[263],nose=points[4],top=points[168],chin=points[152]
 const width=Math.hypot(right.x-left.x,right.y-left.y)
 const height=Math.abs(chin.y-top.y)
 if(width<.035||width>.85||height<.035||height>.9)return null
 const eyesX=(left.x+right.x)*.5
 const eyesY=(left.y+right.y)*.5
 const factor=mirror?-1:1
 return {
  roll:clamp(Math.atan2(right.y-left.y,right.x-left.x)*factor,-.8,.8),
  yaw:clamp(((nose.x-eyesX)/width-.0)*1.5*factor,-.65,.65),
  pitch:clamp(((nose.y-eyesY)/height-.46)*1.2,-.5,.5),
 }
}
export function easeAvatarPose(previous:AvatarHeadPose,next:AvatarHeadPose,alpha=.5):AvatarHeadPose{
 const a=clamp(alpha,0,1)
 return {yaw:previous.yaw+(next.yaw-previous.yaw)*a,
  pitch:previous.pitch+(next.pitch-previous.pitch)*a,
  roll:previous.roll+(next.roll-previous.roll)*a}
}
export function hasExpressiveAvatarTargets(
 dictionaries:ReadonlyArray<Readonly<Record<string,number>>|undefined>,
):boolean{
 return dictionaries.some(dict=>getAvatarMorphBindings(dict).length>=3)
}
