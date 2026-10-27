import * as THREE from 'three'
import type {TrackedHand,HandPoint} from './reality-hand-physics'
import type {RealitySemanticHand} from './reality-hand-segmentation'

export type HandMatteFrame=Readonly<{
 sourceWidth:number;sourceHeight:number
 outputWidth:number;outputHeight:number
 mirror:boolean;now:number
}>
export const HAND_CHAINS:readonly (readonly number[])[]=[
 [0,1,2,3,4],[5,6,7,8],[9,10,11,12],
 [13,14,15,16],[17,18,19,20],
] as const

export function projectHandMaskPoint(p:HandPoint,f:HandMatteFrame){
 if(![p.x,p.y,f.sourceWidth,f.sourceHeight,f.outputWidth,f.outputHeight]
  .every(Number.isFinite)||f.sourceWidth<=0||f.sourceHeight<=0||
  f.outputWidth<=0||f.outputHeight<=0)return null
 const scale=Math.max(f.outputWidth/f.sourceWidth,f.outputHeight/f.sourceHeight)
 const x=(f.outputWidth-f.sourceWidth*scale)/2+p.x*f.sourceWidth*scale
 const y=(f.outputHeight-f.sourceHeight*scale)/2+p.y*f.sourceHeight*scale
 return {x:f.mirror?f.outputWidth-x:x,y}
}
export function handMatteValid(hand:TrackedHand,now:number){
 return hand.landmarks.length===21&&Number.isFinite(hand.timestamp)&&
  now>=hand.timestamp&&now-hand.timestamp<330&&
  hand.landmarks.every(p=>[p.x,p.y].every(Number.isFinite))
}

/** Approximate foreground hand matte, NOT pixel-accurate hand segmentation.
 * Construct a palm polygon and rounded finger strokes from 21 landmarks.
 * Small feather radius hides aliasing; a real segmentation mask may replace
 * this matte via the same single-channel texture contract in future.
 */
export class RealityHandMatte {
 readonly canvas:HTMLCanvasElement
 readonly texture:THREE.CanvasTexture
 readonly width:number
 readonly height:number
 private readonly ctx:CanvasRenderingContext2D
 private previousKey=''
 private semanticCanvas:HTMLCanvasElement|null=null
 constructor(outWidth:number,outHeight:number){
  if(!(outWidth>0&&outHeight>0))throw Error('hand_matte_bad_dimensions')
  this.width=Math.min(384,Math.round(outWidth))
  this.height=Math.max(1,Math.round(this.width*outHeight/outWidth))
  this.canvas=document.createElement('canvas')
  this.canvas.width=this.width
  this.canvas.height=this.height
  const ctx=this.canvas.getContext('2d',{alpha:true})
  if(!ctx)throw Error('hand_matte_context_unavailable')
  this.ctx=ctx
  this.texture=new THREE.CanvasTexture(this.canvas)
  this.texture.colorSpace=THREE.NoColorSpace
  this.texture.minFilter=THREE.LinearFilter
  this.texture.magFilter=THREE.LinearFilter
  this.texture.generateMipmaps=false
  this.texture.needsUpdate=true
 }
 update(hands:readonly TrackedHand[],frame:HandMatteFrame):boolean{
  const fresh=hands.filter(h=>handMatteValid(h,frame.now))
  if(!fresh.length){this.previousKey='';return false}
  const key=fresh.map(h=>h.timestamp+':'+h.handedness).join('|')
   +':'+frame.mirror+':'+frame.sourceWidth+':'+frame.sourceHeight
  if(key===this.previousKey)return true
  this.previousKey=key
  const ctx=this.ctx
  ctx.clearRect(0,0,this.width,this.height)
  ctx.save()
  ctx.scale(this.width/frame.outputWidth,this.height/frame.outputHeight)
  ctx.fillStyle='rgba(255,255,255,1)'
  ctx.strokeStyle='rgba(255,255,255,1)'
  for(const hand of fresh){
   const points=hand.landmarks.map(p=>projectHandMaskPoint(p,frame))
   if(points.some(p=>!p))continue
   const p=points as {x:number;y:number}[]
   const palm=Math.hypot(p[0].x-p[9].x,p[0].y-p[9].y)
   if(!Number.isFinite(palm)||palm<8)continue
   const width=Math.max(3,palm*.22)
   // Narrow conservative palm. Only pixels under landmark-inferred silhouette
   // are restored in front of the object; no all-foreground camera plane.
   ctx.beginPath()
   for(const [i,index] of [0,1,2,5,9,13,17].entries()){
    const v=p[index]
    if(i===0)ctx.moveTo(v.x,v.y)
    else ctx.lineTo(v.x,v.y)
   }
   ctx.closePath()
   ctx.fill()
   ctx.lineCap='round';ctx.lineJoin='round'
   for(let j=0;j<HAND_CHAINS.length;j++){
    const joints=HAND_CHAINS[j]
    ctx.beginPath()
    for(const [k,id] of joints.entries()){
     const v=p[id];if(k===0)ctx.moveTo(v.x,v.y);else ctx.lineTo(v.x,v.y)
    }
    ctx.lineWidth=width*(j===0?.73:j===1?.65:j===2?.72:.62)
    ctx.stroke()
   }
  }
  ctx.restore()
  this.texture.needsUpdate=true
  return true
 }
 /** Promote a fresh point-guided segmentation mask over the skeleton matte.
  * Source-image coordinates map into the same cover crop and mirror as video.
  * A semantic result is deliberately restricted to the observed hand box.
  */
 applySemantic(mask:RealitySemanticHand,frame:HandMatteFrame){
  if(!this.semanticCanvas)this.semanticCanvas=document.createElement('canvas')
  const scratch=this.semanticCanvas
  if(scratch.width!==mask.width||scratch.height!==mask.height){
   scratch.width=mask.width;scratch.height=mask.height
  }
  const ctx0=scratch.getContext('2d')
  if(!ctx0)return false
  ctx0.putImageData(new ImageData(mask.rgba,mask.width,mask.height),0,0)
  const ctx=this.ctx
  ctx.clearRect(0,0,this.width,this.height)
  ctx.save()
  ctx.scale(this.width/frame.outputWidth,this.height/frame.outputHeight)
  if(frame.mirror){ctx.translate(frame.outputWidth,0);ctx.scale(-1,1)}
  const scale=Math.max(frame.outputWidth/frame.sourceWidth,
   frame.outputHeight/frame.sourceHeight)
  ctx.drawImage(scratch,(frame.outputWidth-frame.sourceWidth*scale)/2,
   (frame.outputHeight-frame.sourceHeight*scale)/2,
   frame.sourceWidth*scale,frame.sourceHeight*scale)
  ctx.restore()
  this.previousKey=''
  this.texture.needsUpdate=true
  return true
 }
 resize(outWidth:number,outHeight:number){
  return new RealityHandMatte(outWidth,outHeight)
 }
 dispose(){this.texture.dispose()}
}
