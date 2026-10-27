/** Non-destructive, identity-preserving face sculpting.
 * This changes pixels of the person's OWN camera frame. It never draws a
 * second face, photo or proprietary likeness texture onto their face.
 * A single source photograph is NOT a 3D scan or measured target shape.
 */
export type FaceMorphSettings=Readonly<{
  strength:number
  cheeks:number
  jaw:number
  eyes:number
  nose:number
  lips:number
  chin:number
}>
export const DEFAULT_FACE_MORPH:FaceMorphSettings=Object.freeze({
  strength:.58,
  cheeks:.38,
  jaw:.27,
  eyes:.24,
  nose:.22,
  lips:.16,
  chin:.13,
})
export const NEUTRAL_FACE_MORPH:FaceMorphSettings=Object.freeze({
  strength:0,cheeks:0,jaw:0,eyes:0,nose:0,lips:0,chin:0,
})
export type FaceMorphFeature=Exclude<keyof FaceMorphSettings,'strength'>
export const FACE_MORPH_FEATURES:readonly FaceMorphFeature[]=[
 'cheeks','jaw','eyes','nose','lips','chin',
] as const
const bounded=(n:number)=>Number.isFinite(n)?Math.max(0,Math.min(1,n)):0
export function normalizeFaceMorph(
 input:Partial<FaceMorphSettings>|null|undefined,
):FaceMorphSettings{
 const value=input??DEFAULT_FACE_MORPH
 return {
  strength:bounded(value.strength??DEFAULT_FACE_MORPH.strength),
  cheeks:bounded(value.cheeks??DEFAULT_FACE_MORPH.cheeks),
  jaw:bounded(value.jaw??DEFAULT_FACE_MORPH.jaw),
  eyes:bounded(value.eyes??DEFAULT_FACE_MORPH.eyes),
  nose:bounded(value.nose??DEFAULT_FACE_MORPH.nose),
  lips:bounded(value.lips??DEFAULT_FACE_MORPH.lips),
  chin:bounded(value.chin??DEFAULT_FACE_MORPH.chin),
 }
}
export function cameraMorphForEffect(
 id:string,strength:number,
 custom:Partial<FaceMorphSettings>|undefined,
):FaceMorphSettings|null{
 if(id!=='face-morph')return null
 const shape=normalizeFaceMorph(custom)
 return {...shape,strength:bounded(strength)}
}
/** To guide authoring, not automatically extract a target face identity. */
export function faceMorphIsActive(
 settings:FaceMorphSettings|null|undefined,faceWidth:number,
):boolean{
 return !!settings&&settings.strength>.001&&
  Number.isFinite(faceWidth)&&faceWidth>.035
}
