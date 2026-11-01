/** Lightweight, testable LIVE camera performance choices.
 * Face mesh required for the selected AR lens is independent from the
 * EXTRA subdivided mesh used only by the optional sculpt / wireframe tools.
 */
export function shouldRunExtraLiveMesh(
 isLive:boolean,liveMode:boolean,sculptOptIn:boolean,wireframeDebug:boolean,
):boolean{
 return isLive&&liveMode&&(sculptOptIn||wireframeDebug)
}
/** Live render resolution follows conservative device tiers rather than
 * forcing all mobile phones into a soft 720-pixel render target. Actual
 * camera capture/recording constraints and sustained GPU FPS remain separate.
 */
export function choosePreviewSurfaceHeight(
 livePreview:boolean,touchDevice:boolean,cores:number,memoryGb?:number,
):number{
 const knownMemory=Number.isFinite(memoryGb)&&memoryGb!==undefined&&memoryGb>0
 const low=cores<=4||(knownMemory&&memoryGb!<=3)
 if(livePreview&&touchDevice){
  if(low)return 720
  if(cores>=8&&knownMemory&&memoryGb!>=6)return 1080
  return 900
 }
 return low?960:1280
}
