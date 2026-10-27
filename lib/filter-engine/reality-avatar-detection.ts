/** MediaPipe face adapter for live avatar fallback.
 * All input points are inferred locally. This never performs any remote upload.
 */
export type AvatarLandmark=Readonly<{x:number;y:number;z:number}>
export type AvatarTrackingIssue='no-video'|'too-dark'|'no-face'|'pose-unavailable'|'model-error'|'ok'
const clamp=(n:number,a:number,b:number)=>Number.isFinite(n)?Math.max(a,Math.min(b,n)):a
const ratio=(a:AvatarLandmark,b:AvatarLandmark,aspect:number)=>
 Math.hypot((a.x-b.x)*aspect,a.y-b.y)
export function avatarLandmarkExpression(
 points:ReadonlyArray<AvatarLandmark>,aspect:number,
):Readonly<{jawOpen:number;eyeBlinkLeft:number;eyeBlinkRight:number}>|null{
 if(points.length<468||!Number.isFinite(aspect)||aspect<=0||aspect>5)return null
 const ids=[13,14,61,291,33,133,159,145,362,263,386,374]
 if(ids.some(i=>!points[i]||![points[i].x,points[i].y,points[i].z].every(Number.isFinite)))return null
 const mouthWidth=ratio(points[61],points[291],aspect)
 const leftWidth=ratio(points[33],points[133],aspect)
 const rightWidth=ratio(points[362],points[263],aspect)
 if(mouthWidth<.008||leftWidth<.008||rightWidth<.008)return null
 const mouthRatio=ratio(points[13],points[14],aspect)/mouthWidth
 const leftEyeRatio=ratio(points[159],points[145],aspect)/leftWidth
 const rightEyeRatio=ratio(points[386],points[374],aspect)/rightWidth
 return {
  jawOpen:clamp((mouthRatio-.035)*3.6,0,1),
  eyeBlinkLeft:clamp((.24-leftEyeRatio)/.17,0,1),
  eyeBlinkRight:clamp((.24-rightEyeRatio)/.17,0,1),
 }
}
/** Regularly sample a TINY camera preview to assess lighting, not identity.
 * Low brightness may explain missing detection but doesn't prove causation.
 */
export function avatarLuminance(
 pixels:Uint8ClampedArray|Uint8Array,
):number|null{
 if(!pixels.length||pixels.length%4!==0)return null
 let total=0,valid=0
 for(let i=0;i<pixels.length;i+=4){
  if(pixels[i+3]<128)continue
  total+=.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2]
  valid++
 }
 return valid?total/valid:null
}
export function chooseAvatarTrackerIssue(args:Readonly<{
 videoReady:boolean;hasFace:boolean;poseValid:boolean;
 brightness:number|null;inferenceFailed:boolean
}>):AvatarTrackingIssue{
 if(!args.videoReady)return 'no-video'
 if(args.inferenceFailed)return 'model-error'
 if(!args.hasFace)return args.brightness!==null&&args.brightness<61?'too-dark':'no-face'
 if(!args.poseValid)return 'pose-unavailable'
 return 'ok'
}
export const avatarTrackingIssueArabic:Readonly<Record<AvatarTrackingIssue,string>>={
 'no-video':'الكاميرا لم تُجهّز إطارًا صالحًا للتتبع بعد',
 'too-dark':'الإضاءة ضعيفة؛ وجّه وجهك نحو مصدر ضوء أمامك',
 'no-face':'الكاميرا تعمل لكن النموذج لم يجد وجهًا واضحًا بعد',
 'pose-unavailable':'تم اكتشاف الوجه لكن وضع الرأس غير صالح؛ اقترب وواجه الكاميرا',
 'model-error':'تعذّر تنفيذ نموذج التتبع؛ يمكن إعادة التشغيل أو التبديل إلى CPU',
 'ok':'اكتشاف الوجه والتعابير نشط',
}
