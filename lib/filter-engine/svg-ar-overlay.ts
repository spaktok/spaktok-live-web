import type {FaceGeometry} from './renderer'
import {maskCoordinates} from './face-overlay'

export interface FaceSvgPose{
  x:number
  y:number
  size:number
  rotationDeg:number
}
/**
 * SVG uses CSS pixel coordinates. Map the same MediaPipe eye landmarks through
 * the native camera's object-fit:cover crop, then mirror ONLY ONCE.
 *
 * The GPU 3D lens is composited inside a foreignObject and remains WebGL:
 * a true vector SVG cannot reproduce physically based gem refraction.
 */
export function faceSvgPose(
  face:FaceGeometry|null,
  sourceW:number,sourceH:number,
  viewportW:number,viewportH:number,
  mirror:boolean,
):FaceSvgPose|null{
  if(!face)return null
  const g=maskCoordinates(face,sourceW,sourceH,viewportW,viewportH)
  if(!g)return null
  const x=mirror?viewportW-g.center.x:g.center.x
  return {
    x,y:g.center.y,size:g.size,
    rotationDeg:g.rotation*180/Math.PI*(mirror?-1:1),
  }
}
export function svgPoseTransform(p:FaceSvgPose){
  return `translate(${p.x.toFixed(3)} ${p.y.toFixed(3)}) rotate(${p.rotationDeg.toFixed(3)}) scale(${p.size.toFixed(3)})`
}
const glints=[[-.48,-.86,.052],[.53,-.74,.073],[0,-1.15,.08],[-.22,-.65,.036],[.28,-.95,.044]] as const
/** Mirrored SVG vector highlights in the JPEG/MediaRecorder compositor.
 * These are light accents only. The crown/other PBR shapes stay on GPU. */
export function paintSvgAccents(
  ctx:CanvasRenderingContext2D,
  pose:FaceSvgPose,
  strength:number,
  timeSeconds:number,
){
  if(!Number.isFinite(pose.size)||pose.size<=0||strength<=0)return
  ctx.save()
  ctx.translate(pose.x,pose.y)
  ctx.rotate(pose.rotationDeg*Math.PI/180)
  ctx.scale(pose.size,pose.size)
  ctx.globalAlpha=Math.max(0,Math.min(0.7,strength*0.65))
  ctx.lineCap='round'
  for(const [x,y,r] of glints){
    const a=0.55+0.45*Math.sin(timeSeconds*1.5+x*7)
    ctx.strokeStyle='#fffbe6'
    ctx.lineWidth=0.007
    ctx.beginPath()
    ctx.moveTo(x-r*a,y);ctx.lineTo(x+r*a,y)
    ctx.moveTo(x,y-r*a);ctx.lineTo(x,y+r*a)
    ctx.stroke()
  }
  ctx.restore()
}
