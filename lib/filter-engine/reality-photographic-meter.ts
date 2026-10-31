import type {ColorParams} from './params'
import {estimateAmbientLight,type AmbientLightEstimate} from './lighting3d'

/** CPU-light, on-device camera-metered photographic correction. No cloud AI,
 * skin-color inference, identity edits, persistent pixels or face whitening.
 * Color is applied through the existing preview / recording shader.
 */
export type PhotographicCorrection=Readonly<{
 exposure:number
 temperature:number
 shadows:number
 highlights:number
}>
export const NEUTRAL_PHOTOGRAPHIC_CORRECTION:PhotographicCorrection=Object.freeze({
 exposure:0,temperature:0,shadows:0,highlights:0,
})
const clamp=(value:number,min:number,max:number)=>
 Number.isFinite(value)?Math.min(max,Math.max(min,value)):0

/** Prioritize a tracked face over a bright window or a dark wall.
 * Samples luminance only; no skin-tone/identity classification is performed.
 * Coordinates refer to the unmirrored video (as with MediaPipe landmarks).
 */
export function estimatePortraitPhotographicLight(
 pixels:Uint8ClampedArray,width:number,height:number,
 face:Readonly<{center:Readonly<{x:number;y:number}>;width:number}>|null,
):AmbientLightEstimate{
 const ambient=estimateAmbientLight(pixels,width,height)
 if(!face||width<4||height<4||pixels.length<width*height*4||
   !Number.isFinite(face.center.x)||!Number.isFinite(face.center.y)||
   !Number.isFinite(face.width)||face.width<.08||face.width>.95)return ambient
 const cx=face.center.x*width,cy=face.center.y*height
 // Face width is normalized in source-video space. Convert it to the
 // sampled pixel grid so portrait and landscape use the same ROI.
 const radiusX=Math.max(1,face.width*width*.38)
 const radiusY=Math.max(1,face.width*width*.52)
 let sum=0,count=0
 for(let y=Math.max(0,Math.floor(cy-radiusY));y<Math.min(height,Math.ceil(cy+radiusY));y++){
  for(let x=Math.max(0,Math.floor(cx-radiusX));x<Math.min(width,Math.ceil(cx+radiusX));x++){
   const dx=(x+.5-cx)/radiusX,dy=(y+.5-cy)/radiusY
   if(dx*dx+dy*dy>1)continue
   const i=(y*width+x)*4
   const v=(.2126*pixels[i]+.7152*pixels[i+1]+.0722*pixels[i+2])/255
   sum+=clamp(v,.02,.95);count++
  }
 }
 if(count<3)return ambient
 return {...ambient,brightness:clamp(ambient.brightness*.38+(sum/count)*.62,.07,.85)}
}

/** Dark scenes: modest shadow lift; bright scenes: protect highlights.
 * Neutralize only a fraction of the camera's color cast to preserve ambience.
 * Raw camera sampling can never recover detail already lost to sensor noise.
 */
export function targetPhotographicCorrection(light:AmbientLightEstimate):PhotographicCorrection{
 const brightness=clamp(light.brightness,0,1)
 const warmth=clamp(light.warmth,-.35,.35)
 const dark=clamp((.44-brightness)/.32,0,1)
 const bright=clamp((brightness-.65)/.25,0,1)
 return {
  exposure:clamp(.20*dark-.12*bright,-.12,.20),
  temperature:clamp(-warmth*.36,-.13,.13),
  shadows:clamp(.17*dark,0,.17),
  highlights:clamp(-.20*bright,-.20,0),
 }
}

/** Smooth against camera AE and flickering lights; wall-clock rather than
 * frame-count based, so slow Android phones don't change the visual response.
 */
export function smoothPhotographicCorrection(
 previous:PhotographicCorrection,next:PhotographicCorrection,elapsedMs:number,
):PhotographicCorrection{
 const elapsed=clamp(elapsedMs,0,2000)
 const alpha=1-Math.exp(-elapsed/1100)
 return {
  exposure:previous.exposure+(next.exposure-previous.exposure)*alpha,
  temperature:previous.temperature+(next.temperature-previous.temperature)*alpha,
  shadows:previous.shadows+(next.shadows-previous.shadows)*alpha,
  highlights:previous.highlights+(next.highlights-previous.highlights)*alpha,
 }
}

export function applyPhotographicCorrection(
 original:ColorParams,correction:PhotographicCorrection,
):ColorParams{
 return {
  ...original,
  exposure:clamp(original.exposure+correction.exposure,-1,1),
  temperature:clamp(original.temperature+correction.temperature,-1,1),
  shadows:clamp(original.shadows+correction.shadows,-1,1),
  highlights:clamp(original.highlights+correction.highlights,-1,1),
 }
}
