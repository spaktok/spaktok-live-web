import type { FaceGeometry } from './renderer'
import type { FaceFxParams } from './params'

/**
 * Transparent on-device Face AR layer. The browser renders the real camera
 * video below this layer; only tracked face artwork is painted here.
 *
 * A second offscreen 2D canvas composites the same artwork for photos/videos,
 * so the recorded asset matches the visible preview.
 */
export function coverCrop(sourceW:number, sourceH:number, targetW:number,targetH:number){
  if(sourceW<=0||sourceH<=0||targetW<=0||targetH<=0)return null
  const scale=Math.max(targetW/sourceW,targetH/sourceH)
  const w=sourceW*scale,h=sourceH*scale
  return {x:(targetW-w)/2,y:(targetH-h)/2,w,h,scale}
}
type Point={x:number;y:number}
export function maskCoordinates(face:FaceGeometry,sourceW:number,sourceH:number,outW:number,outH:number){
 const rect=coverCrop(sourceW,sourceH,outW,outH)
 if(!rect)return null
 const place=(p:Point)=>({x:rect.x+p.x*rect.w,y:rect.y+p.y*rect.h})
 const l=place(face.leftEye),r=place(face.rightEye),nose=place(face.nose)
 const eyeCenter={x:(l.x+r.x)/2,y:(l.y+r.y)/2}
 const size=face.width*sourceH*rect.scale
 if(!Number.isFinite(size)||size<14||size>Math.max(outW,outH)*2.5)return null
 const rotation=Math.atan2(r.y-l.y,r.x-l.x)
 const dx=nose.x-eyeCenter.x,dy=nose.y-eyeCenter.y
 const n={x:(dx*Math.cos(rotation)+dy*Math.sin(rotation))/size,
   y:(-dx*Math.sin(rotation)+dy*Math.cos(rotation))/size}
 return {rect,size,center:eyeCenter,rotation,nose:n}
}
const ellipse=(ctx:CanvasRenderingContext2D,x:number,y:number,rx:number,ry:number,fill:string,stroke?:string,lineWidth=0.02)=>{
 ctx.beginPath();ctx.ellipse(x,y,rx,ry,0,0,Math.PI*2)
 ctx.fillStyle=fill;ctx.fill()
 if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=lineWidth;ctx.stroke()}
}
const line=(ctx:CanvasRenderingContext2D,x1:number,y1:number,x2:number,y2:number,color:string,width:number)=>{
 ctx.beginPath();ctx.moveTo(x1,y1);ctx.lineTo(x2,y2);ctx.strokeStyle=color;ctx.lineWidth=width;ctx.lineCap='round';ctx.stroke()
}
const poly=(ctx:CanvasRenderingContext2D,coords:number[],color:string,stroke?:string)=>{
 ctx.beginPath();ctx.moveTo(coords[0],coords[1])
 for(let i=2;i<coords.length;i+=2)ctx.lineTo(coords[i],coords[i+1])
 ctx.closePath();ctx.fillStyle=color;ctx.fill()
 if(stroke){ctx.strokeStyle=stroke;ctx.lineWidth=0.022;ctx.stroke()}
}
const heart=(ctx:CanvasRenderingContext2D,x:number,y:number,s:number)=>{
 ctx.save();ctx.translate(x,y);ctx.scale(s,s)
 ctx.beginPath();ctx.moveTo(0,0.32)
 ctx.bezierCurveTo(-0.85,-0.16,-0.65,-0.65,0,-0.3)
 ctx.bezierCurveTo(0.65,-0.65,0.85,-0.16,0,0.32)
 ctx.closePath();ctx.fillStyle='#ff477a';ctx.fill()
 ctx.restore()
}
export function drawFaceMask(
 ctx:CanvasRenderingContext2D, face:FaceGeometry|null, effect:FaceFxParams,
 sourceW:number,sourceH:number,outW:number,outH:number,
 mirror:boolean,timeSeconds=0,
){
 if(!face||effect.id==='none'||effect.strength<=0)return false
 const g=maskCoordinates(face,sourceW,sourceH,outW,outH)
 if(!g)return false
 ctx.save()
 if(mirror){ctx.translate(outW,0);ctx.scale(-1,1)}
 ctx.translate(g.center.x,g.center.y);ctx.rotate(g.rotation);ctx.scale(g.size,g.size)
 ctx.globalAlpha=Math.min(1,Math.max(0,effect.strength))
 ctx.lineJoin='round'
 const eyes=Math.hypot(face.leftEye.x-face.rightEye.x,face.leftEye.y-face.rightEye.y)
 const dist=Math.min(.64,Math.max(.3,eyes*sourceW/g.rect.w*1.6)) // stable per-face span
 const lx=-Math.min(.34,dist*.5),rx=-lx
 const pulse=Math.sin(timeSeconds*2.3)*.02
 switch(effect.id){
  case 'neon-glasses':
  case 'midnight-shades': {
   const neon=effect.id==='neon-glasses'
   const ink=neon?'#49e8ff':'#d5b46b'
   for(const x of [lx,rx]){
    ellipse(ctx,x,0,.235,.16,neon?'rgba(19,179,255,.23)':'rgba(6,10,33,.9)',ink,.038)
    line(ctx,x-.13,-.065,x-.025,-.094,'rgba(255,255,255,.85)',.017)
   }
   line(ctx,lx+.225,-.025,rx-.225,-.025,ink,.03)
   line(ctx,lx-.23,-.01,-.63,-.08,ink,.035)
   line(ctx,rx+.23,-.01,.63,-.08,ink,.035)
   break
  }
  case 'cat-ears':{
   poly(ctx,[-.55,-.32,-.47,-.92,-.14,-.54],'#292033','#eec7fa')
   poly(ctx,[.14,-.54,.47,-.92,.55,-.32],'#292033','#eec7fa')
   poly(ctx,[-.46,-.48,-.45,-.75,-.29,-.52],'#f8a6c9')
   poly(ctx,[.29,-.52,.45,-.75,.46,-.48],'#f8a6c9')
   ellipse(ctx,g.nose.x,g.nose.y,.075,.045,'#fa7da8')
   for(let j=-1;j<=1;j++){
    line(ctx,g.nose.x-.11,g.nose.y+.065,-.48,g.nose.y+.04+j*.08,'#fae2ed',.017)
    line(ctx,g.nose.x+.11,g.nose.y+.065,.48,g.nose.y+.04+j*.08,'#fae2ed',.017)
   }
   break
  }
  case 'puppy':{
   ellipse(ctx,-.66,-.42,.20,.40,'#7b4b2d','#e5ba95',.028)
   ellipse(ctx,.66,-.42,.20,.40,'#7b4b2d','#e5ba95',.028)
   ellipse(ctx,-.66,-.42,.11,.26,'#b97c69')
   ellipse(ctx,.66,-.42,.11,.26,'#b97c69')
   ellipse(ctx,g.nose.x,g.nose.y,.16,.105,'#181421')
   ellipse(ctx,g.nose.x-.043,g.nose.y-.038,.043,.021,'#fff2ed')
   break
  }
  case 'royal-crown': {
   poly(ctx,[-.45,-.52,-.49,-.95,-.24,-.67,0,-1.09,.24,-.67,.49,-.95,.45,-.52],'#f4bb34','#fff1aa')
   poly(ctx,[-.47,-.52,.47,-.52,.43,-.43,-.43,-.43],'#dc911c')
   ellipse(ctx,0,-.57,.058,.063,'#3fd4ff')
   ellipse(ctx,-.29,-.54,.043,.044,'#f6659b')
   ellipse(ctx,.29,-.54,.043,.044,'#f6659b')
   break
  }
  case 'butterfly':{
   for(const dir of [-1,1]){
    ellipse(ctx,dir*.59,-.18,.25,.31,'rgba(194,103,255,.88)','#f2ceff',.026)
    ellipse(ctx,dir*.58,.18,.21,.20,'rgba(61,221,234,.84)','#d5faff',.02)
    ellipse(ctx,dir*.63,-.19,.09,.1,'#fff8de')
    line(ctx,dir*.38,.03,dir*.15,-.13,'#ffdffc',.04)
   }
   break
  }
  case 'cyber-visor': {
   ctx.save();ctx.shadowColor='#42efff';ctx.shadowBlur=.1*g.size
   poly(ctx,[-.67,-.2,.67,-.2,.61,.20,-.61,.20],'rgba(7,32,76,.8)','#38eaff')
   ctx.restore()
   for(let k=-4;k<=4;k++)line(ctx,k*.12,-.15,k*.12+.045,.15,'rgba(44,215,248,.42)',.014)
   ellipse(ctx,pulse,.16,.08,.018,'#ff54d3')
   break
  }
  case 'heart-cheeks':{
   heart(ctx,-.45,.26,.24+pulse);heart(ctx,.45,.26,.24+pulse)
   ellipse(ctx,-.56,.15,.05,.035,'#fff5fc');ellipse(ctx,.34,.15,.05,.035,'#fff5fc')
   break
  }
  case 'robot':{
   for(const x of [lx,rx])ellipse(ctx,x,0,.20,.20,'rgba(18,36,63,.80)','#b8eaff',.047)
   line(ctx,lx+.2,0,rx-.2,0,'#a4daea',.048)
   line(ctx,0,-.42,0,-.79,'#d6eafa',.025)
   ellipse(ctx,0,-.84,.07,.07,'#fe5097')
   for(const x of [-.46,.46])ellipse(ctx,x,.26,.065,.055,'#36fce2')
   break
  }
  case 'festival':{
   for(const [x,y,a,b,c] of [[-.56,-.6,.08,.17,'#ff5e98'],[.38,-.71,.08,.16,'#b8e76e'],[-.38,.38,.07,.04,'#80d0ff'],[.5,.24,.06,.05,'#facc56'],[.02,-.93,.07,.14,'#67fff5']] as const){
    ctx.save();ctx.translate(x,y);ctx.rotate(a+timeSeconds*.1);ctx.fillStyle=c
    ctx.fillRect(-b*.3,-b*.4,b*.55,b);ctx.restore()
   }
   break
  }
 }
 ctx.restore()
 return true
}

/** Center-crop like CSS object-fit:cover, with selfie mirroring. */
export function drawCoverFrame(ctx:CanvasRenderingContext2D,video:HTMLVideoElement,width:number,height:number,mirror:boolean){
 const crop=coverCrop(video.videoWidth,video.videoHeight,width,height)
 if(!crop)return false
 ctx.save()
 if(mirror){ctx.translate(width,0);ctx.scale(-1,1)}
 ctx.drawImage(video,crop.x,crop.y,crop.w,crop.h)
 ctx.restore()
 return true
}
