import * as THREE from 'three'
/**
 * Original, authored 3D accessory geometry with PBR materials.
 * Fabric seams, curved arms, lens curvature, metal bezels and micro-gems
 * replace the previous primitive-only Torus/Cone example meshes.
 * Three runs locally on the existing camera, without external asset downloads.
 */
const metal=(color:number,roughness=.22,clearcoat=.65)=>new THREE.MeshPhysicalMaterial({
 color,metalness:.84,roughness,clearcoat,clearcoatRoughness:.11
})
const matte=(color:number,roughness=.52)=>new THREE.MeshStandardMaterial({color,roughness,metalness:.08})
const glow=(color:number)=>new THREE.MeshStandardMaterial({
 color,emissive:color,emissiveIntensity:1.0,roughness:.24,metalness:.32
})
function mesh(group:THREE.Group,geometry:THREE.BufferGeometry,material:THREE.Material,
 x=0,y=0,z=0){
 const item=new THREE.Mesh(geometry,material)
 item.position.set(x,y,z);group.add(item);return item
}
function path(group:THREE.Group,points:number[][],radius:number,material:THREE.Material,segments=38){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>new THREE.Vector3(p[0],p[1],p[2])),false,'catmullrom',.5)
 const segmentCount=Math.max(10,segments)
 return mesh(group,new THREE.TubeGeometry(curve,segmentCount,radius,8,false),material)
}
function gemstone(group:THREE.Group,x:number,y:number,z:number,color:number,size=.065){
 const mat=new THREE.MeshPhysicalMaterial({color,metalness:.06,roughness:.04,
  clearcoat:1,clearcoatRoughness:.02,transmission:.18,thickness:.19,ior:1.58})
 const stone=mesh(group,new THREE.IcosahedronGeometry(size,1),mat,x,y,z)
 stone.scale.set(.83,1.1,.54)
 return stone
}
function luxGlasses():THREE.Group{
 const g=new THREE.Group()
 const titanium=metal(0x9abdcf,.17),paleGold=metal(0xe4c081,.18)
 const acetate=new THREE.MeshPhysicalMaterial({color:0x1a2434,roughness:.21,metalness:.10,clearcoat:.95,clearcoatRoughness:.12})
 const lens=new THREE.MeshPhysicalMaterial({color:0x5b8cb9,metalness:.07,roughness:.08,transparent:true,opacity:.35,
  depthWrite:false,clearcoat:.9,clearcoatRoughness:.045,side:THREE.DoubleSide})
 // Curved lenses with thin rim torques (not flat circles).
 for(const side of [-1,1]){
  const x=side*.265
  const linePoints:number[][]=[]
  for(let k=0;k<=48;k++){
   const theta=k/48*Math.PI*2
   linePoints.push([x+.211*Math.cos(theta),-.012+.167*Math.sin(theta),.24+.018*(1-Math.cos(theta))])
  }
  path(g,linePoints,.018,acetate,48)
  path(g,linePoints.map(v=>[v[0],v[1],v[2]+.018]),.008,paleGold,48)
  const glass=mesh(g,new THREE.SphereGeometry(.22,32,20,0,Math.PI*2,0,Math.PI/2),lens,x,-.012,.20)
  glass.scale.set(1,.83,.19);glass.rotation.x=Math.PI/2
  path(g,[[x-.117,-.081,.285],[x-.071,-.103,.3],[x+.03,-.113,.30]],.008,titanium,16)
  // Joint screws, flexible optical nose pads and folding temple arms.
  const hinge=mesh(g,new THREE.CylinderGeometry(.022,.022,.045,12),paleGold,x+side*.219,-.015,.235)
  hinge.rotation.x=Math.PI/2
  mesh(g,new THREE.SphereGeometry(.014,12,8),titanium,x+side*.238,-.014,.265)
  path(g,[[x+side*.223,-.006,.24],[x+side*.31,-.02,.18],[x+side*.43,-.08,.05],
    [x+side*.55,-.11,-.13],[x+side*.56,-.20,-.27]],.014,titanium)
  path(g,[[x+side*.56,-.18,-.21],[x+side*.56,-.20,-.27],[x+side*.56,-.235,-.31]],.022,acetate,12)
  mesh(g,new THREE.SphereGeometry(.045,12,8),matte(0xe0dce0),side*.09,.06,.20).scale.set(.48,.65,.48)
 }
 path(g,[[-.045,-.038,.265],[0,-.075,.282],[.045,-.038,.265]],.019,titanium,24)
 // Sculpted bridge with raised crest and precise bar reflection.
 path(g,[[-.081,-.057,.288],[0,-.11,.316],[.081,-.057,.288]],.007,paleGold,22)
 return g
}
function coutureCrown():THREE.Group{
 const g=new THREE.Group(),gold=metal(0xe4af43,.21),rose=metal(0xf4c5aa,.2)
 const stone=metal(0xc6deef,.17)
 mesh(g,new THREE.CylinderGeometry(.44,.48,.17,56),gold,0,-.6,0)
 for(const y of [-.69,-.57,-.51]){
  mesh(g,new THREE.TorusGeometry(.46,.019,10,56),y===-.57?rose:gold,0,y,.0).rotation.x=Math.PI/2
 }
 for(let i=0;i<9;i++){
  const x=(i-4)*.1
  const peak=-.83-.16*(1-Math.abs(i-4)/4)
  path(g,[[x-.06,-.54,.11],[x-.045,-.70,.12],[x,peak,.11],[x+.045,-.7,.12],[x+.06,-.54,.11]],.012,gold,24)
  mesh(g,new THREE.SphereGeometry(.04,14,10),rose,x,peak-.009,.13)
  if(i%2===0)gemstone(g,x,-.61,.20,i%4===0?0x4eafff:0xe356a9,.049)
 }
 gemstone(g,0,-.59,.21,0x46e5f8,.088)
 for(const x of [-.21,.21])gemstone(g,x,-.61,.20,0xf34d82,.056)
 for(const i of [-2,-1,0,1,2])mesh(g,new THREE.SphereGeometry(.015,10,8),stone,i*.13,-.73,.13)
 return g
}
function cyberHelmet():THREE.Group{
 const g=new THREE.Group(),carbon=matte(0x131924,.39),silver=metal(0xa1b6d2,.17),dark=metal(0x182534,.23)
 const neon=glow(0x0aa6ff)
 const glass=new THREE.MeshPhysicalMaterial({color:0x1887bf,metalness:.18,roughness:.11,transparent:true,
  opacity:.45,depthWrite:false,clearcoat:1,clearcoatRoughness:.04,side:THREE.DoubleSide})
 const dome=mesh(g,new THREE.SphereGeometry(.62,46,24,0,Math.PI*2,0,Math.PI*.65),carbon,0,-.12,-.1)
 dome.rotation.x=Math.PI
 const visor=mesh(g,new THREE.SphereGeometry(.55,48,26,0,Math.PI,Math.PI*.33,Math.PI*.41),glass,0,.09,.17)
 visor.scale.z=.7;visor.rotation.x=-.1
 path(g,[[-.56,-.16,.22],[-.44,-.31,.36],[0,-.33,.42],[.44,-.31,.36],[.56,-.16,.22]],.021,silver)
 path(g,[[-.58,-.22,.22],[-.44,-.34,.36],[0,-.37,.43],[.44,-.34,.36],[.58,-.22,.22]],.009,neon)
 path(g,[[-.55,-.6,.01],[-.40,-.7,-.02],[0,-.78,-.12],[.40,-.7,-.02],[.55,-.6,.01]],.025,dark)
 for(const side of [-1,1]){
  const pad=mesh(g,new THREE.CylinderGeometry(.13,.13,.095,28),silver,side*.59,.07,.02)
  pad.rotation.z=Math.PI/2
  const core=mesh(g,new THREE.CylinderGeometry(.078,.078,.101,24),neon,side*.625,.07,.02)
  core.rotation.z=Math.PI/2
  path(g,[[side*.52,-.42,.14],[side*.60,-.34,.08],[side*.65,-.10,.02]],.025,dark)
  gemstone(g,side*.37,-.57,.25,0x7efbff,.04)
 }
 mesh(g,new THREE.BoxGeometry(.19,.045,.035),silver,0,-.66,.30)
 for(const dx of [-.07,0,.07])mesh(g,new THREE.BoxGeometry(.016,.025,.045),neon,dx,-.665,.335)
 return g
}
function premiumCap():THREE.Group{
 const g=new THREE.Group()
 const fabric=matte(0x203450,.71),panels=matte(0x293b55,.61)
 const trim=metal(0xb9a0a1,.32),thread=matte(0xa8b5c6,.58)
 const dome=mesh(g,new THREE.SphereGeometry(.53,48,20,0,Math.PI*2,0,Math.PI*.62),fabric,0,-.45,-.09)
 dome.rotation.x=Math.PI
 for(let section=0;section<6;section++){
  const angle=2*Math.PI*section/6
  const points:number[][]=[]
  for(let i=0;i<=14;i++){
   const t=i/14,theta=Math.PI*(1-t*.62)
   points.push([Math.sin(theta)*Math.cos(angle)*.535,-.45+.52*Math.cos(theta),
    -.09+Math.sin(theta)*Math.sin(angle)*.535])
  }
  path(g,points,.005,thread,18)
 }
 const brimShape=new THREE.Shape()
 brimShape.moveTo(-.60,-.44)
 brimShape.bezierCurveTo(-.51,-.53,-.37,-.67,0,-.70)
 brimShape.bezierCurveTo(.37,-.67,.51,-.53,.60,-.44)
 brimShape.bezierCurveTo(.44,-.35,-.30,-.35,-.60,-.44)
 const brim=mesh(g,new THREE.ExtrudeGeometry(brimShape,{depth:.07,bevelEnabled:true,
  bevelThickness:.012,bevelSize:.018,bevelSegments:2,steps:1,curveSegments:20}),panels,0,0,.28)
 brim.rotation.x=-.12
 path(g,[[-.60,-.44,.37],[-.44,-.55,.38],[0,-.67,.38],[.44,-.55,.38],[.60,-.44,.37]],.009,trim)
 mesh(g,new THREE.TorusGeometry(.49,.015,10,48),trim,0,-.47,-.09).rotation.x=Math.PI/2
 const crest=mesh(g,new THREE.CylinderGeometry(.10,.10,.019,6),trim,0,-.60,.44)
 crest.rotation.x=Math.PI/2
 gemstone(g,0,-.60,.46,0xe4cfe9,.06)
 return g
}
/** Accessory materials owned by the returned scene and safely disposed when switched. */
export function makePremiumAccessory(id:string):THREE.Group|null{
 if(id==='3d-lux-glasses')return luxGlasses()
 if(id==='3d-gold-crown')return coutureCrown()
 if(id==='3d-space-visor')return cyberHelmet()
 if(id==='3d-metal-cap')return premiumCap()
 return null
}
