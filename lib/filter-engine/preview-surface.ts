/**
 * Camera and transparent AR canvases MUST have the same aspect ratio as their
 * rendered video element. CSS object-cover applied to a 9:16 canvas inside a
 * differently-sized viewport crops the 3D overlay twice and detaches it from
 * the moving face on Android browser toolbars and responsive screens.
 */
export function cameraSurfaceDimensions(
 cssWidth:number,cssHeight:number,outputHeight:number,
):{width:number;height:number}|null{
 if(!Number.isFinite(cssWidth)||!Number.isFinite(cssHeight)||cssWidth<100||cssHeight<100)return null
 const height=Math.round(Math.max(480,Math.min(1600,outputHeight)))
 const width=Math.max(160,Math.round(height*cssWidth/cssHeight))
 return {width,height}
}
