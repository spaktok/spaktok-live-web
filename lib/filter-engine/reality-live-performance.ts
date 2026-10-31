/** Lightweight, testable LIVE camera performance choices.
 * Face mesh required for the selected AR lens is independent from the
 * EXTRA subdivided mesh used only by the optional sculpt / wireframe tools.
 */
export function shouldRunExtraLiveMesh(
 isLive:boolean,liveMode:boolean,sculptOptIn:boolean,wireframeDebug:boolean,
):boolean{
 return isLive&&liveMode&&(sculptOptIn||wireframeDebug)
}
/** The camera capture stays at its original 720p target; only the internal
 * composite/WebGL surface is downscaled for LIVE on coarse-pointer phones.
 * This does not claim a measured FPS improvement.
 */
export function choosePreviewSurfaceHeight(
 livePreview:boolean,touchDevice:boolean,cores:number,memoryGb?:number,
):number{
 if(livePreview&&touchDevice)return 720
 return cores<=4||(Number.isFinite(memoryGb)&&memoryGb!==undefined&&memoryGb<=3)
  ?960:1280
}
