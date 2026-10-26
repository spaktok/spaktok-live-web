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
 const dist=Math.min(1.02,Math.max(.35,eyes*g.rect.w/g.size)) // tracked eye spacing / face width
 const lx=-dist*.5,rx=-lx
 const mouthOpen=face.expression?.mouthOpen??0
 const leftEyeOpen=face.expression?.leftEyeOpen??1
 const rightEyeOpen=face.expression?.rightEyeOpen??1
 const mouthY=(()=>{const rel={x:(face.mouth.x-(face.leftEye.x+face.rightEye.x)/2)*g.rect.w,y:(face.mouth.y-(face.leftEye.y+face.rightEye.y)/2)*g.rect.h};return (-rel.x*Math.sin(g.rotation)+rel.y*Math.cos(g.rotation))/g.size})()
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
  case 'bunny-ears': {
   for(const side of [-1,1]){
    ctx.save();ctx.translate(side*.35,-.58);ctx.rotate(side*.13);
    ellipse(ctx,0,-.24,.18,.48,'#f6f0f7','#e1d1e1',.025)
    ellipse(ctx,0,-.25,.09,.34,'#f5b6cb')
    ctx.restore()
   }
   ellipse(ctx,g.nose.x,g.nose.y,.095,.064,'#e87fae')
   break
  }
  case 'fox-mask': {
   for(const side of [-1,1]){
    poly(ctx,[side*.12,-.48,side*.53,-.96,side*.62,-.28],'#ef8e3b','#fff4e5')
    poly(ctx,[side*.36,-.53,side*.49,-.8,side*.5,-.48],'#fff0d5')
    ellipse(ctx,side*.36,.26,.19,.16,'#f7d2aa')
   }
   ellipse(ctx,g.nose.x,g.nose.y,.085,.06,'#282735')
   break
  }
  case 'panda': {
   for(const side of [-1,1]){
    ellipse(ctx,side*.46,-.65,.18,.19,'#1d2130')
    ellipse(ctx,side*.38,0,.245,.205,'rgba(22,25,38,.62)')
   }
   ellipse(ctx,g.nose.x,g.nose.y,.095,.065,'#101622')
   break
  }
  case 'tiger': {
   for(const side of [-1,1]){
    poly(ctx,[side*.42,-.4,side*.48,-.76,side*.65,-.53],'#ff9c32','#342d25')
    for(let j=0;j<3;j++){
     const y=-.28+j*.17
     poly(ctx,[side*.61,y,side*.32,y+.07,side*.60,y+.13],'#342721')
    }
   }
   poly(ctx,[-.07,g.nose.y-.02,.07,g.nose.y-.02,0,g.nose.y+.07],'#2d2726')
   break
  }
  case 'deer-antlers': {
   for(const side of [-1,1]){
    line(ctx,side*.30,-.55,side*.47,-1.2,'#89633d',.067)
    line(ctx,side*.40,-.94,side*.65,-1.10,'#89633d',.052)
    line(ctx,side*.36,-.84,side*.17,-1.02,'#89633d',.048)
    ellipse(ctx,side*.42,-.5,.13,.16,'#b68555','#f0cda8')
   }
   break
  }
  case 'devil-horns': {
   for(const side of [-1,1])
    poly(ctx,[side*.24,-.48,side*.43,-1.02,side*.53,-.47],'#df2b65','#ff9fb3')
   break
  }
  case 'angel-halo': {
   ctx.save();ctx.shadowColor='#f9de78';ctx.shadowBlur=.16*g.size
   ellipse(ctx,0,-.95,.50,.13,'rgba(253,226,137,.14)','#ffeaa1',.045)
   ctx.restore()
   break
  }
  case 'elf-ears': {
   for(const side of [-1,1])
    poly(ctx,[side*.48,.13,side*.94,-.16,side*.55,.34],'#efbd99','#a57971')
   break
  }
  case 'wizard-hat':{
   poly(ctx,[-.44,-.5,-.27,-1.32,-.03,-1.12,.20,-.89,.36,-.51],'#45318d','#b6a2ff')
   ellipse(ctx,0,-.50,.59,.09,'#383069','#baa7fa')
   for(const [x,y] of [[-.14,-.79],[.06,-.97],[.12,-.65]]){
    ellipse(ctx,x,y,.038,.04,'#fff6c7')
   }
   break
  }
  case 'cowboy-hat':{
   poly(ctx,[-.43,-.46,-.35,-.96,.30,-.96,.41,-.45],'#8e5635','#f4bd80')
   ellipse(ctx,0,-.44,.71,.10,'#a77144','#e3bd8a')
   line(ctx,-.32,-.59,.33,-.59,'#432b22',.062)
   break
  }
  case 'graduation-cap':{
   poly(ctx,[-.70,-.71,0,-1.08,.70,-.71,0,-.38],'#1b2242','#a9b7ed')
   ellipse(ctx,0,-.62,.32,.07,'#1c2542')
   line(ctx,.51,-.74,.53,-.31,'#d5a53b',.02)
   ellipse(ctx,.53,-.31,.045,.09,'#eec14c')
   break
  }
  case 'pirate-patch': {
   ellipse(ctx,lx,0,.255,.198,'#1a161c','#997650',.032)
   line(ctx,lx-.26,0,-.67,-.23,'#38252c',.047)
   line(ctx,lx+.24,-.05,.64,-.27,'#38252c',.047)
   break
  }
  case 'star-glasses': {
   for(const x of [lx,rx]){
    const coords:number[]=[]
    for(let k=0;k<10;k++){
     const angle=-Math.PI/2+k*Math.PI/5,r=k%2===0?.23:.115
     coords.push(x+Math.cos(angle)*r,Math.sin(angle)*r)
    }
    poly(ctx,coords,'rgba(239,182,79,.72)','#fff5ae')
   }
   line(ctx,lx+.23,0,rx-.23,0,'#ffe2a1',.03)
   break
  }
  case 'pixel-shades':{
   ctx.fillStyle='rgba(14,16,26,.92)'
   for(const x of [lx,rx]){
    ctx.fillRect(x-.24,-.14,.48,.30)
    ctx.fillStyle='#e3e8f6';ctx.fillRect(x-.19,-.11,.15,.029)
    ctx.fillStyle='rgba(14,16,26,.92)'
   }
   ctx.fillRect(lx+.19,-.046,rx-lx-.38,.055)
   break
  }
  case 'monocle':{
   ellipse(ctx,rx,0,.23,.23,'rgba(205,234,255,.14)','#d7b56a',.042)
   line(ctx,rx+.19,.15,rx+.28,.53,'#d5bb80',.025)
   ellipse(ctx,rx-.07,-.07,.035,.04,'#f8f8e8')
   break
  }
  case 'hero-mask':{
   poly(ctx,[-.63,-.15,-.45,-.23,.45,-.23,.63,-.15,.48,.27,-.42,.27],'rgba(38,43,110,.95)','#87baff')
   for(const x of [lx,rx])ellipse(ctx,x,.01,.175,.09,'rgba(0,0,0,.0)')
   break
  }
  case 'ice-crown':{
   for(const x of [-.38,-.19,0,.19,.38]){
    const h=x===0?1.1:.83
    poly(ctx,[x-.13,-.49,x,-h,x+.13,-.49],'rgba(122,219,254,.82)','#dffcff')
   }
   ellipse(ctx,0,-.52,.47,.07,'rgba(122,219,254,.74)','#f1fcff',.015)
   break
  }
  case 'rainbow-cheeks':{
   for(const side of [-1,1])
    for(let k=0;k<4;k++){
     line(ctx,side*.31,.25+k*.049,side*.62,.19+k*.049,
       ['#ff6c8a','#ffd469','#74ecbb','#8ea9ff'][k],.036)
    }
   break
  }
  case 'starry-eyes':{
   const open=(leftEyeOpen+rightEyeOpen)*.5
   if(open>.16){
    for(const x of [lx,rx]){
     const pts:number[]=[]
     const turn=timeSeconds*.6
     for(let k=0;k<10;k++){
      const a=k*Math.PI/5-Math.PI/2+turn*0.12,r=k%2===0?.18:.085
      pts.push(x+r*Math.cos(a),r*Math.sin(a))
     }
     poly(ctx,pts,'rgba(255,205,69,.84)','#fff4bd')
    }
   }
   break
  }
  case 'comic-tears':{
   const opened=Math.min(1,Math.max(0,(leftEyeOpen+rightEyeOpen)*.5))
   for(const x of [lx,rx]){
    const y=.12+.1*Math.sin(timeSeconds*2)
    ellipse(ctx,x+.09,y+.22,.068,.21+.07*(1-opened),'rgba(70,193,248,.84)','#b2efff')
   }
   break
  }
  case 'sparkle-burst':{
   for(let k=0;k<10;k++){
    const angle=k*2.399+timeSeconds*.18
    const distance=.54+.17*Math.sin(timeSeconds*1.4+k)
    const x=Math.cos(angle)*distance,y=Math.sin(angle)*distance-.13
    const radius=.018+.014*(1+Math.sin(timeSeconds*3+k))
    line(ctx,x-radius,y,x+radius,y,'#fff5b4',.017)
    line(ctx,x,y-radius,x,y+radius,'#fff5b4',.017)
   }
   break
  }
  case 'confetti-rain':{
   for(let k=0;k<18;k++){
    const phase=(timeSeconds*.36+k*.234)%1
    const x=Math.sin(k*5.24)*.7,y=-.97+phase*1.94
    ctx.fillStyle=['#ff598e','#ffd76a','#7fedb7','#88bcff'][k%4]
    ctx.save();ctx.translate(x,y);ctx.rotate(timeSeconds+k)
    ctx.fillRect(-.023,-.036,.046,.072);ctx.restore()
   }
   break
  }
  case 'mouth-hearts':{
   const level=mouthOpen
   if(level>.1)for(let k=0;k<3;k++){
    const rise=((timeSeconds*.37+k*.33)%1)*.7
    const x=Math.sin(k*7.19+timeSeconds)*.14
    heart(ctx,x,mouthY-.13-rise,.115+.05*level)
   }
   break
  }
  case 'magic-moustache':{
   const wiggle=mouthOpen*.08+Math.sin(timeSeconds*2)*.01
   for(const side of [-1,1]){
    ctx.beginPath()
    ctx.moveTo(0,mouthY-.06)
    ctx.bezierCurveTo(side*.18,mouthY-.19-wiggle,side*.3,mouthY-.22,
                      side*.42,mouthY-.08+wiggle)
    ctx.bezierCurveTo(side*.36,mouthY+.04,side*.16,mouthY+.07,
                      0,mouthY-.06)
    ctx.fillStyle='#1a1a1e';ctx.fill()
   }
   break
  }
  case 'bubble-mouth':{
   if(mouthOpen>.10){
    for(let k=0;k<4;k++){
     const phase=(timeSeconds*.43+k*.245)%1
     const x=.17*Math.sin(timeSeconds*1.6+k*2.6),y=mouthY-.08-phase*.84
     ellipse(ctx,x,y,.06+k*.01,.065+k*.01,'rgba(119,213,250,.26)','#eafaff',.015)
    }
   }
   break
  }
  case 'sleepy-eyes':{
   for(const x of [lx,rx]){
    const droop=.06+(1-(leftEyeOpen+rightEyeOpen)*.5)*.11
    line(ctx,x-.16,-.03,x+.16,-.03+droop,'#e3cefa',.043)
    for(let k=-1;k<=1;k++)line(ctx,x+k*.085,-.04+droop,x+k*.095,.035+droop,'#dac9f7',.018)
   }
   break
  }
  case 'alien':{
   for(const x of [lx,rx]){
    ellipse(ctx,x,0,.20,.20,'rgba(14,52,36,.75)','#94ffad',.032)
    ellipse(ctx,x,0,.13,.15,'#111b27')
   }
   ellipse(ctx,g.nose.x,g.nose.y,.038,.02,'#5cffab')
   break
  }
  case 'space-helmet':{
   ellipse(ctx,0,.06,.78,.94,'rgba(91,197,252,.07)','#d6f4ff',.042)
   ellipse(ctx,0,.03,.70,.85,'rgba(173,222,250,.035)')
   line(ctx,-.58,.5,.58,.5,'#c9e7ee',.064)
   ellipse(ctx,.49,-.43,.075,.09,'#e7f7ff')
   break
  }
  case 'clown-nose':{
   ellipse(ctx,g.nose.x,g.nose.y,.16,.14,'#ea3943','#ffb3c1',.025)
   ellipse(ctx,g.nose.x-.055,g.nose.y-.046,.045,.035,'rgba(255,255,255,.82)')
   for(const side of [-1,1]){
    ellipse(ctx,side*.48,.32,.11,.07,'rgba(255,99,114,.45)')
   }
   break
  }
  case 'lightning-bolt':{
   poly(ctx,[-.59,-.61,-.26,-.63,-.42,-.24,-.16,-.24,-.62,.36,-.43,-.12,-.68,-.11],
    '#ffdc42','#fff8c6')
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
