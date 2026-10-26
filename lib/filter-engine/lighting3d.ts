/** Camera-only low-resolution light sampling for physically based AR assets.
 * Never stores, uploads or transmits video pixels. */
export type AmbientLightEstimate={brightness:number;warmth:number;side:number}
const clip=(v:number,min:number,max:number)=>Math.max(min,Math.min(max,v))
export function estimateAmbientLight(data:Uint8ClampedArray,width:number,height:number):AmbientLightEstimate{
 if(width<2||height<2||data.length<width*height*4)return{brightness:.55,warmth:0,side:0}
 let luminance=0,red=0,blue=0,left=0,right=0,ln=0,rn=0,n=0
 for(let y=0;y<height;y+=2)for(let x=0;x<width;x+=2){
  const i=(y*width+x)*4
  const r=data[i]/255,g=data[i+1]/255,b=data[i+2]/255
  const lum=.2126*r+.7152*g+.0722*b
  // Prevent a few overexposed spots dominating the adjustment.
  const clipped=Math.min(.95,Math.max(.02,lum))
  luminance+=clipped;red+=r;blue+=b;n++
  if(x<width/2){left+=clipped;ln++}else{right+=clipped;rn++}
 }
 if(!n||!ln||!rn)return{brightness:.55,warmth:0,side:0}
 const brightness=clip(luminance/n,.07,.85)
 const warmth=clip((red-blue)/n,-.35,.35)
 const l=left/ln,r=right/rn
 return {brightness,warmth,side:clip((l-r)/Math.max(.12,l+r),-.6,.6)}
}

/** Bounded, low-resolution camera-light estimate to guide the AR rig.
 * Not a real scene light probe or calibrated HDR environment capture.
 */
export function adaptiveJewelryLight(sample:AmbientLightEstimate) {
 const b=clip(sample.brightness,.07,.85)
 const w=clip(sample.warmth,-.35,.35)
 const side=clip(sample.side,-.6,.6)
 const exposure=clip(.75+b*.65,.8,1.25)
 return {
  fill:clip(1.35*exposure,.9,1.7),
  key:clip(2.3*exposure,1.55,3.1),
  rim:clip(.7*(.95+b*.2),.55,.9),
  horizontalOffset:side*240,
  red:1,
  green:clip(.91-w*.10,.83,.96),
  blue:clip(.83-w*.30,.7,.96),
 }
}
