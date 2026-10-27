/** Device-local 21-point hand/prop interactions.
 * State is per-effect, not per-person; hand detection NEVER removes a filter.
 * World distances/depth are NOT metric from monocular image-space landmarks.
 */
export type HandPoint=Readonly<{x:number;y:number;z?:number}>
export type TrackedHand=Readonly<{
 landmarks:ReadonlyArray<HandPoint>
 handedness?:'Left'|'Right'|'Unknown'
 timestamp:number
}>
export type HandFrame=Readonly<{
 sourceWidth:number;sourceHeight:number
 outputWidth:number;outputHeight:number
 mirror:boolean;now:number
}>
export type ObjectPose=Readonly<{
 x:number;y:number;z:number
 pitch:number;yaw:number;roll:number
}>
export type HandInteraction=Readonly<{
 state:'mounted'|'grabbed'|'returning'
 pose:ObjectPose
 hand:'Left'|'Right'|'Unknown'|null
 pinch:number
}>
type Grip=Readonly<{
 x:number;y:number;angle:number;pinch:number
 handedness:'Left'|'Right'|'Unknown'
 timestamp:number
}>
const clamp=(v:number,a:number,b:number)=>Math.max(a,Math.min(b,v))
const angleDiff=(a:number,b:number)=>Math.atan2(Math.sin(a-b),Math.cos(a-b))
const decay=(deltaMs:number,speed:number)=>1-Math.exp(-Math.max(0,Math.min(80,deltaMs))*speed/1000)
function mapPoint(p:HandPoint,f:HandFrame):{x:number;y:number}|null{
 if(!Number.isFinite(p.x)||!Number.isFinite(p.y)||![f.sourceWidth,f.sourceHeight,
  f.outputWidth,f.outputHeight].every(n=>Number.isFinite(n)&&n>0))return null
 const zoom=Math.max(f.outputWidth/f.sourceWidth,f.outputHeight/f.sourceHeight)
 const x=(f.outputWidth-f.sourceWidth*zoom)/2+p.x*f.sourceWidth*zoom
 return {x:f.mirror?f.outputWidth-x:x,
   y:(f.outputHeight-f.sourceHeight*zoom)/2+p.y*f.sourceHeight*zoom}
}
/** Detect thumb/index pinch with hand-size normalization and a directional
 * grip frame that can tilt a 3D object while carrying it. */
export function handGripPoint(hand:TrackedHand,frame:HandFrame):Grip|null{
 const lm=hand.landmarks
 if(lm.length!==21||!Number.isFinite(hand.timestamp)||frame.now-hand.timestamp>320||
    hand.timestamp>frame.now+50)return null
 const thumb=mapPoint(lm[4],frame),index=mapPoint(lm[8],frame)
 const wrist=mapPoint(lm[0],frame),middle=mapPoint(lm[9],frame)
 if(!thumb||!index||!wrist||!middle)return null
 const palm=Math.hypot(wrist.x-middle.x,wrist.y-middle.y)
 if(!Number.isFinite(palm)||palm<9)return null
 const dist=Math.hypot(thumb.x-index.x,thumb.y-index.y)/palm
 if(!Number.isFinite(dist))return null
 return {x:(thumb.x+index.x)/2,y:(thumb.y+index.y)/2,
  angle:Math.atan2(index.y-thumb.y,index.x-thumb.x),
  pinch:dist,handedness:hand.handedness??'Unknown',
  timestamp:hand.timestamp}
}

/** Hysteretic grip + interpolated damped object transform:
 * - two consecutive pinched detections close to an object => grab
 * - hand translates AND tilts the object (relative finger rotation)
 * - wide fingers or tracking loss => release
 * - the object animates home instead of vanishing/following rigidly.
 * Same pure controller can power hats, glasses, hair props and jewelry.
 */
export class RealityHandPhysics {
 private mode:'mounted'|'grabbed'|'returning'='mounted'
 private current:ObjectPose|null=null
 private offset={x:0,y:0}
 private angleOnGrab=0
 private lastGrip:Grip|null=null
 private candidateStamp=-1
 private candidateCount=0
 private lastTime=0
 private heldHand:'Left'|'Right'|'Unknown'|null=null
 private fingerDistance=Infinity
 private candidateAngle=0
 private previousHandPoint:{x:number;y:number}|null=null
 reset(){this.mode='mounted';this.current=null;this.offset={x:0,y:0};
  this.lastGrip=null;this.candidateStamp=-1;this.candidateCount=0;
  this.lastTime=0;this.heldHand=null;this.previousHandPoint=null;
  this.fingerDistance=Infinity;this.candidateAngle=0}
 step(base:ObjectPose,headWidth:number,hands:readonly TrackedHand[],frame:HandFrame):HandInteraction{
  if(![base.x,base.y,base.z,base.pitch,base.yaw,base.roll,headWidth,frame.now]
    .every(Number.isFinite)||headWidth<=0) {
   this.reset();return {state:'mounted',pose:base,hand:null,pinch:Infinity}
  }
  const dt=this.lastTime?clamp(frame.now-this.lastTime,0,80):16
  this.lastTime=frame.now
  const observations=hands.map(h=>handGripPoint(h,frame)).filter((p):p is Grip=>p!==null)
  let selected:Grip|undefined
  if(this.mode==='grabbed'){
   const target=this.previousHandPoint
   selected=observations
    .filter(p=>this.heldHand==='Unknown'||p.handedness===this.heldHand)
    .sort((a,b)=>target?
      Math.hypot(a.x-target.x,a.y-target.y)-Math.hypot(b.x-target.x,b.y-target.y):0)[0]
   // Only accept hand detections genuinely newer than the currently held one.
   if(selected&&this.lastGrip&&selected.timestamp<this.lastGrip.timestamp)selected=undefined
   if(selected&&selected.pinch<.61){
    this.lastGrip=selected
    this.previousHandPoint={x:selected.x,y:selected.y}
    this.fingerDistance=selected.pinch
   }else if((selected&&selected.pinch>=.61)||
     (this.lastGrip&&frame.now-this.lastGrip.timestamp>320)){
    this.mode='returning'
    this.heldHand=null;this.lastGrip=null;this.candidateCount=0
   }
  }else{
   selected=observations.filter(p=>p.pinch<.38)
    .sort((a,b)=>Math.hypot(a.x-base.x,a.y-base.y)-
      Math.hypot(b.x-base.x,b.y-base.y))[0]
   const eligible=selected&&Math.hypot(selected.x-base.x,selected.y-base.y)
     <Math.max(40,headWidth*.72)
   if(eligible&&selected){
    if(selected.timestamp!==this.candidateStamp){
     this.candidateCount++
     this.candidateStamp=selected.timestamp
    }
    if(this.candidateCount>=2){
     this.mode='grabbed';this.lastGrip=selected
     this.heldHand=selected.handedness
     this.angleOnGrab=selected.angle
     this.previousHandPoint={x:selected.x,y:selected.y}
     this.fingerDistance=selected.pinch
     const reference=this.current??base
     this.offset={x:reference.x-selected.x,y:reference.y-selected.y}
    }
   }else{this.candidateCount=0;this.candidateStamp=-1}
  }
  const previous=this.current??base
  let desired:ObjectPose=base
  if(this.mode==='grabbed'&&this.lastGrip){
   const hand=this.lastGrip
   const tilt=clamp(angleDiff(hand.angle,this.angleOnGrab),-.85,.85)
   desired={
    x:clamp(hand.x+this.offset.x,base.x-headWidth*2,base.x+headWidth*2),
    y:clamp(hand.y+this.offset.y,base.y-headWidth*2,base.y+headWidth*2),
    z:base.z+headWidth*.20,
    pitch:base.pitch+tilt*.20,
    yaw:base.yaw+tilt*.14,
    roll:base.roll+tilt*.85,
   }
  }
  const smooth=decay(dt,this.mode==='grabbed'?16:8)
  const lerp=(a:number,b:number)=>a+(b-a)*smooth
  const current:ObjectPose={
   x:lerp(previous.x,desired.x),y:lerp(previous.y,desired.y),
   z:lerp(previous.z,desired.z),
   pitch:lerp(previous.pitch,desired.pitch),
   yaw:lerp(previous.yaw,desired.yaw),
   roll:previous.roll+angleDiff(desired.roll,previous.roll)*smooth,
  }
  this.current=current
  if(this.mode==='returning'&&
    Math.hypot(current.x-base.x,current.y-base.y)<1.5&&
    Math.abs(angleDiff(current.roll,base.roll))<.015)
    this.mode='mounted'
  return {state:this.mode,pose:current,hand:this.heldHand,pinch:this.fingerDistance}
 }
 get state(){return this.mode}
}
