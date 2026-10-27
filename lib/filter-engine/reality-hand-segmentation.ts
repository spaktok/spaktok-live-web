import {BrushMode,type InteractiveSegmenter} from '@mediapipe/tasks-vision'
import type {TrackedHand} from './reality-hand-physics'
/** Local, point-prompted pixel mask; NOT a hand-specific classifier.
 * Retain only pixels inside the known 21-point hand bounding region to
 * prevent an accidental face/background segmentation from covering AR.
 */
export type RealitySemanticHand=Readonly<{
 timestamp:number
 width:number;height:number
 rgba:Uint8ClampedArray
 handCenter:Readonly<{x:number;y:number}>
}>
export function handDetectionCenter(hand:TrackedHand){
 const points=hand.landmarks
 if(points.length!==21)return null
 const a=points[0],b=points[9]
 if(!a||!b||![a.x,a.y,b.x,b.y].every(Number.isFinite))return null
 return {x:(a.x+b.x)/2,y:(a.y+b.y)/2}
}
export function semanticHandMaskFromConfidence(
 hand:TrackedHand,
 data:Float32Array,
 modelWidth:number,modelHeight:number,
 now:number,
 maxOutput=320,
):RealitySemanticHand|null{
 const center=handDetectionCenter(hand)
 if(!center||!Number.isSafeInteger(modelWidth)||!Number.isSafeInteger(modelHeight)||
  modelWidth<16||modelHeight<16||
  data.length!==modelWidth*modelHeight||
  now-hand.timestamp>400||hand.timestamp>now+50)return null
 const pts=hand.landmarks
 if(pts.some(p=>![p.x,p.y].every(Number.isFinite)))return null
 const xs=pts.map(p=>p.x),ys=pts.map(p=>p.y)
 const minx=Math.max(0,Math.min(...xs)-.05),maxx=Math.min(1,Math.max(...xs)+.05)
 const miny=Math.max(0,Math.min(...ys)-.05),maxy=Math.min(1,Math.max(...ys)+.05)
 if(maxx-minx<.02||maxy-miny<.02)return null
 const w=Math.min(modelWidth,maxOutput),h=Math.max(1,Math.round(w*modelHeight/modelWidth))
 const rgba=new Uint8ClampedArray(w*h*4)
 let count=0
 for(let y=0;y<h;y++){
  const v=(y+.5)/h
  if(v<miny||v>maxy)continue
  const yy=Math.max(0,Math.min(modelHeight-1,Math.floor(v*modelHeight)))
  for(let x=0;x<w;x++){
   const u=(x+.5)/w
   if(u<minx||u>maxx)continue
   const xx=Math.max(0,Math.min(modelWidth-1,Math.floor(u*modelWidth)))
   const score=data[yy*modelWidth+xx]
   const alpha=Math.round(Math.max(0,Math.min(1,(score-.35)*2.0))*255)
   if(alpha<25)continue
   const i=(y*w+x)*4
   rgba[i]=255;rgba[i+1]=255;rgba[i+2]=255;rgba[i+3]=alpha
   count++
  }
 }
 if(count<10)return null
 return {timestamp:now,width:w,height:h,rgba,handCenter:center}
}
/** One-shot inference on a real video frame. The caller provides a
 * downscaled unmirrored source canvas; no pixels are transmitted anywhere.
 * On-device model inference is synchronous/blocking and therefore QA gated.
 */
export function segmentHandOnce(
 segmenter:InteractiveSegmenter,
 input:HTMLCanvasElement,
 hand:TrackedHand,
 at:number,
):RealitySemanticHand|null{
 const center=handDetectionCenter(hand)
 if(!center)return null
 segmenter.setImage(input)
 const mask=segmenter.segment([{
  brushMode:BrushMode.POSITIVE,
  point:[{x:Math.min(.99,Math.max(.01,center.x)),
    y:Math.min(.99,Math.max(.01,center.y))}],
  isCompleted:true,
 }])
 try{
  return semanticHandMaskFromConfidence(hand,mask.getAsFloat32Array(),
   mask.width,mask.height,at)
 }finally{mask.close()}
}
export function semanticHandMaskFresh(
 mask:RealitySemanticHand|null,
 hand:TrackedHand|null,
 now:number,
):boolean{
 if(!mask||!hand||now-mask.timestamp>680||now<mask.timestamp)return false
 const next=handDetectionCenter(hand)
 return !!next&&Math.hypot(next.x-mask.handCenter.x,next.y-mask.handCenter.y)<.045
}
