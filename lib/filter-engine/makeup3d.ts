/**
 * SpakTok Face Couture: vertex-attached 3D makeup (478 tracked landmarks).
 * One transparent GPU pass on the actual depth-tracked MediaPipe mesh.
 * Unlike a flat screen overlay, pigment follows yaw, expression and face depth.
 * No photographs, face landmarks or cosmetic preferences leave the device.
 */
export const makeupLooks = [
 {id:'3d-makeup-soft',name:'مكياج ناعم',icon:'🌷',group:'makeup'},
 {id:'3d-makeup-glam',name:'مكياج سهرة',icon:'💄',group:'makeup'},
 {id:'3d-makeup-bridal',name:'إطلالة عروس',icon:'👰',group:'makeup'},
 {id:'3d-makeup-smoky',name:'عيون دخانية',icon:'🖤',group:'makeup'},
 {id:'3d-makeup-rose',name:'وردي مخملي',icon:'🌹',group:'makeup'},
 {id:'3d-makeup-neon',name:'نيون فني',icon:'🪩',group:'makeup'},
 {id:'3d-makeup-golden',name:'توهج ذهبي',icon:'✨',group:'makeup'},
 {id:'3d-makeup-editorial',name:'مكياج فني',icon:'🎨',group:'makeup'},
] as const
export type MakeupLookId=(typeof makeupLooks)[number]['id']
export function isMakeupLook(id:string):id is MakeupLookId{
 return makeupLooks.some(item=>item.id===id)
}
export interface MakeupPalette{
 /** Hex colors (skin remains visibly textured underneath). */
 foundation:string;lip:string;shadow:string;liner:string;blush:string;contour:string;highlight:string
 /** Coverage per cosmetic zone: foundation, lips, shadow, liner, blush, contour, highlight */
 coverage:readonly[number,number,number,number,number,number,number]
 shimmer:number
}
const palettes:Record<MakeupLookId,MakeupPalette>={
 '3d-makeup-soft':{foundation:'#edc8b7',lip:'#be677b',shadow:'#b38b9c',liner:'#473c47',blush:'#ed8da2',contour:'#946e63',highlight:'#fff1da',coverage:[.12,.44,.27,.34,.34,.17,.24],shimmer:.07},
 '3d-makeup-glam':{foundation:'#e8b7a2',lip:'#ba2354',shadow:'#906ca4',liner:'#141a2d',blush:'#e27689',contour:'#78524b',highlight:'#f7e0ae',coverage:[.17,.76,.62,.88,.38,.37,.34],shimmer:.25},
 '3d-makeup-bridal':{foundation:'#f2d7c5',lip:'#c97287',shadow:'#c8a3ac',liner:'#493344',blush:'#ea96a0',contour:'#b78a75',highlight:'#fff7e5',coverage:[.18,.55,.42,.61,.42,.21,.42],shimmer:.35},
 '3d-makeup-smoky':{foundation:'#dab9a9',lip:'#9b3d58',shadow:'#393645',liner:'#141322',blush:'#a87c8f',contour:'#584c4b',highlight:'#e2dee1',coverage:[.08,.66,.83,.94,.22,.36,.22],shimmer:.10},
 '3d-makeup-rose':{foundation:'#f3cbd0',lip:'#d75782',shadow:'#e5a7c2',liner:'#71395d',blush:'#ea87b0',contour:'#a46a83',highlight:'#ffe8f5',coverage:[.14,.64,.52,.64,.50,.18,.35],shimmer:.27},
 '3d-makeup-neon':{foundation:'#d5c6ef',lip:'#b938c9',shadow:'#6c45c7',liner:'#2d165a',blush:'#e175d7',contour:'#5b4180',highlight:'#96eeff',coverage:[.09,.76,.77,.91,.48,.27,.43],shimmer:.60},
 '3d-makeup-golden':{foundation:'#e5c69b',lip:'#ba7966',shadow:'#b68849',liner:'#503c2b',blush:'#cd886b',contour:'#96724d',highlight:'#fff0aa',coverage:[.12,.55,.60,.68,.26,.32,.62],shimmer:.75},
 '3d-makeup-editorial':{foundation:'#d4b4b9',lip:'#993150',shadow:'#633f89',liner:'#221a39',blush:'#ad698c',contour:'#6d4264',highlight:'#ebe4ff',coverage:[.08,.78,.76,.97,.39,.39,.50],shimmer:.25},
}
export function getMakeupPalette(id:MakeupLookId):MakeupPalette{return palettes[id]}
export type TrackedPoint=Readonly<{x:number;y:number;z?:number}>
export type MakeupMasks={masksA:Float32Array;masksB:Float32Array}
const clamp=(v:number)=>Math.max(0,Math.min(1,v))
const valid=(p:TrackedPoint|undefined):p is TrackedPoint=>!!p&&Number.isFinite(p.x)&&Number.isFinite(p.y)
const len=(a:TrackedPoint,b:TrackedPoint,aspect:number)=>{
 const dx=(a.x-b.x)*aspect,dy=a.y-b.y
 return Math.hypot(dx,dy)
}
function centroid(ids:readonly number[],points:ReadonlyArray<TrackedPoint>):TrackedPoint{
 let sx=0,sy=0,count=0
 for(const id of ids){const p=points[id];if(valid(p)){sx+=p.x;sy+=p.y;count++}}
 return {x:sx/Math.max(1,count),y:sy/Math.max(1,count)}
}
function radial(p:TrackedPoint,c:TrackedPoint,rx:number,ry:number,aspect:number){
 const d=Math.hypot((p.x-c.x)*aspect/Math.max(rx,1e-5),(p.y-c.y)/Math.max(ry,1e-5))
 // Smooth, finite, Gaussian falloff. No hard lipstick-colored rectangles.
 return Math.exp(-Math.pow(d,2)*2.3)
}
function segmentDistance(p:TrackedPoint,a:TrackedPoint,b:TrackedPoint,aspect:number){
 const ax=a.x*aspect,ay=a.y,bx=b.x*aspect,by=b.y,px=p.x*aspect,py=p.y
 const dx=bx-ax,dy=by-ay
 const t=clamp(((px-ax)*dx+(py-ay)*dy)/Math.max(dx*dx+dy*dy,1e-12))
 return Math.hypot(px-(ax+t*dx),py-(ay+t*dy))
}
function contourDistance(p:TrackedPoint,indices:readonly number[],points:ReadonlyArray<TrackedPoint>,aspect:number){
 let best=Infinity
 for(let i=0;i<indices.length;i++){
  const a=points[indices[i]],b=points[indices[(i+1)%indices.length]]
  if(valid(a)&&valid(b))best=Math.min(best,segmentDistance(p,a,b,aspect))
 }
 return best
}
function inside(p:TrackedPoint,indices:readonly number[],points:ReadonlyArray<TrackedPoint>,aspect:number){
 let hit=false
 for(let i=0,j=indices.length-1;i<indices.length;j=i++){
  const a=points[indices[i]],b=points[indices[j]]
  if(!valid(a)||!valid(b))continue
  const ax=a.x*aspect,bx=b.x*aspect,x=p.x*aspect
  if((a.y>p.y)!==(b.y>p.y)&&x<(bx-ax)*(p.y-a.y)/(b.y-a.y)+ax)hit=!hit
 }
 return hit
}
const LIP_OUTER=[61,40,37,0,267,270,291,321,314,17,84,91] as const
const LIP_INNER=[78,191,80,81,82,13,312,311,310,415,308,324,318,402,317,14,87,178,88,95] as const
const LEFT_LINER=[33,160,158,157,173,133] as const
const RIGHT_LINER=[362,398,384,385,386,263] as const
function linerWeight(p:TrackedPoint,indices:readonly number[],points:ReadonlyArray<TrackedPoint>,aspect:number,faceWidth:number){
 const d=contourDistance(p,indices,points,aspect)
 return Math.exp(-Math.pow(d/Math.max(faceWidth*.042,.0015),2)*1.25)
}
/** CPU cost: O(478) facial vertices (plus constant small contour segments),
 * one update per new vision inference, not every GPU animation frame. */
export function computeMakeupMasks(points:ReadonlyArray<TrackedPoint>,sourceAspect=1):MakeupMasks{
 const a=new Float32Array(478*4),b=new Float32Array(478*4)
 if(points.length<468||!valid(points[33])||!valid(points[263])||!valid(points[61])||
    !valid(points[291])||!valid(points[234])||!valid(points[454])||sourceAspect<=0)return{masksA:a,masksB:b}
 const leftEye=centroid([33,133,159,145],points)
 const rightEye=centroid([362,263,386,374],points)
 const leftCheek=centroid([50,101,205,117],points)
 const rightCheek=centroid([280,330,425,346],points)
 const leftContour=centroid([123,147,187,234],points)
 const rightContour=centroid([352,376,411,454],points)
 const nose=centroid([6,168,197],points)
 const eyeWidth=Math.max(len(points[33],points[133],sourceAspect),len(points[362],points[263],sourceAspect),.01)
 const width=Math.max(len(points[234],points[454],sourceAspect),.06)
 const lipMargin=width*.022
 const shadowX=eyeWidth*.83,shadowY=eyeWidth*.58
 for(let i=0;i<478;i++){
  const p=points[i]
  if(!valid(p))continue
  const z=i*4
  // Keep the lip color on the real lip surface, not on the teeth or mouth opening.
  const outer=inside(p,LIP_OUTER,points,sourceAspect)
  const inner=inside(p,LIP_INNER,points,sourceAspect)
  const lipDist=contourDistance(p,LIP_OUTER,points,sourceAspect)
  const innerDist=contourDistance(p,LIP_INNER,points,sourceAspect)
  const lips=inner?0:outer?
    clamp(.50+lipDist/Math.max(lipMargin,1e-5)*.55)*clamp(.40+innerDist/Math.max(lipMargin,1e-5)):
    .31*Math.exp(-Math.pow(lipDist/Math.max(lipMargin,1e-5),2)*2)
  const shadow=Math.max(
   radial(p,{x:leftEye.x,y:leftEye.y-eyeWidth*.25},shadowX,shadowY,sourceAspect),
   radial(p,{x:rightEye.x,y:rightEye.y-eyeWidth*.25},shadowX,shadowY,sourceAspect))
  const liner=Math.max(
   linerWeight(p,LEFT_LINER,points,sourceAspect,width),
   linerWeight(p,RIGHT_LINER,points,sourceAspect,width))
  const blush=Math.max(
   radial(p,leftCheek,width*.25,width*.18,sourceAspect),
   radial(p,rightCheek,width*.25,width*.18,sourceAspect))
  const contour=Math.max(
   radial(p,leftContour,width*.19,width*.31,sourceAspect),
   radial(p,rightContour,width*.19,width*.31,sourceAspect))
  const highlight=Math.max(
   radial(p,{x:leftCheek.x,y:leftCheek.y-width*.13},width*.10,width*.075,sourceAspect),
   radial(p,{x:rightCheek.x,y:rightCheek.y-width*.13},width*.10,width*.075,sourceAspect),
   radial(p,nose,width*.05,width*.16,sourceAspect)*.7)
  const foundation=clamp(Math.max(
   radial(p,centroid([1,4,168],points),width*.8,width*.95,sourceAspect)*.55,
   radial(p,leftCheek,width*.46,width*.48,sourceAspect)*.65,
   radial(p,rightCheek,width*.46,width*.48,sourceAspect)*.65))
  a[z]=foundation
  a[z+1]=clamp(lips)
  a[z+2]=clamp(shadow)
  a[z+3]=clamp(liner*.8)
  b[z]=clamp(blush)
  b[z+1]=clamp(contour)
  b[z+2]=clamp(highlight)
  b[z+3]=1
 }
 return {masksA:a,masksB:b}
}
