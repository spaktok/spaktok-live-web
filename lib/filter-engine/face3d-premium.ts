import * as THREE from 'three'
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js'
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
  // A true parented hinge (rather than one static merged path): when the
  // user picks up the glasses, each arm can fold with secondary inertia.
  const hingeX=x+side*.223,hingeY=-.006,hingeZ=.24
  const temple=new THREE.Group()
  temple.name=side<0?'SpakTokTempleLeft':'SpakTokTempleRight'
  temple.position.set(hingeX,hingeY,hingeZ)
  g.add(temple)
  const relative=(points:number[][])=>points.map(([px,py,pz])=>[
   px-hingeX,py-hingeY,pz-hingeZ,
  ])
  path(temple,relative([
   [x+side*.223,-.006,.24],[x+side*.31,-.02,.18],[x+side*.43,-.08,.05],
   [x+side*.55,-.11,-.13],[x+side*.56,-.20,-.27],
  ]),.014,titanium)
  path(temple,relative([
   [x+side*.56,-.18,-.21],[x+side*.56,-.20,-.27],
   [x+side*.56,-.235,-.31],
  ]),.022,acetate,12)
  mesh(g,new THREE.SphereGeometry(.045,12,8),matte(0xe0dce0),side*.09,.06,.20).scale.set(.48,.65,.48)
 }
 path(g,[[-.045,-.038,.265],[0,-.075,.282],[.045,-.038,.265]],.019,titanium,24)
 // Sculpted bridge with raised crest and precise bar reflection.
 path(g,[[-.081,-.057,.288],[0,-.11,.316],[.081,-.057,.288]],.007,paleGold,22)
 return g
}
/** Faceted gemstone mesh: point-cut, intentionally non-spherical faces to
 * produce realistic angular specular highlights under the mobile PBR lights.
 * All polygon faces have flat normals rather than smoothly rounded shading.
 */
function jewelCut(width:number,height:number,depth:number,steps=14){
 const vertices:number[]=[]
 const midpoint=(x:number,y:number,z:number)=>[x,y,z]
 const rings: number[][]=[]
 for(let i=0;i<steps;i++){
  const a=i*Math.PI*2/steps
  // Pointed teardrop/marquise silhouette. Narrow tips at the two ends.
  const x=width*Math.sin(a)*Math.pow(Math.abs(Math.sin(a)),.26)
  const y=height*Math.cos(a)
  rings.push([x,y,depth*.13])
 }
 const pushFace=(a:number[],b:number[],c:number[])=>vertices.push(...a,...b,...c)
 const front=midpoint(0,0,depth),back=midpoint(0,0,-depth*.66)
 for(let i=0;i<steps;i++){
  const j=(i+1)%steps
  const a=rings[i],b=rings[j]
  const insetA=midpoint(a[0]*.73,a[1]*.73,depth*.73)
  const insetB=midpoint(b[0]*.73,b[1]*.73,depth*.73)
  pushFace(a,b,insetB);pushFace(a,insetB,insetA)
  pushFace(insetA,insetB,front)
  pushFace(b,a,back)
 }
 const geometry=new THREE.BufferGeometry()
 geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3))
 geometry.computeVertexNormals()
 return geometry
}
function jewelMaterial(color:number){
 return new THREE.MeshPhysicalMaterial({
  color,metalness:.06,roughness:.075,clearcoat:1,
  clearcoatRoughness:.045,transmission:.12,thickness:.38,
  ior:2.0,iridescence:.68,iridescenceIOR:1.36,
  emissive:new THREE.Color(color).multiplyScalar(.095),
  side:THREE.DoubleSide,
 })
}
function jewelSetting(g:THREE.Group,x:number,y:number,z:number,w:number,h:number,color:number){
 const gold=g.userData.settingMetal as THREE.Material || metal(0xd99069,.17)
 const gemMaterials=g.userData.gemMaterials as Map<number,THREE.Material>|undefined
 let colored=gemMaterials?.get(color)
 if(!colored){colored=jewelMaterial(color);gemMaterials?.set(color,colored)}
 const bezel=mesh(g,new THREE.SphereGeometry(1,12,8),gold,x,y,z-.036)
 bezel.scale.set(w*1.14,h*1.12,.055)
 const gem=mesh(g,jewelCut(w,h,.09,12),colored,x,y,z+.058)
 gem.rotation.y=.05
 // Four prongs hold the jewel into its real raised metal setting.
 for(const sx of [-1,1])for(const sy of [-1,1]){
  const prong=mesh(g,new THREE.SphereGeometry(.013,6,4),gold,
   x+sx*w*.60,y+sy*h*.59,z+.11)
  prong.scale.set(1.2,1.1,.8)
 }
 return gem
}
function spiral(g:THREE.Group,cx:number,cy:number,z:number,scale:number,material:THREE.Material,flip=1){
 const points:number[][]=[]
 for(let i=0;i<=38;i++){
  const t=i/38,phi=t*Math.PI*2.05+.25
  const radius=scale*(1-.87*t)
  points.push([cx+flip*radius*Math.cos(phi),cy+radius*Math.sin(phi),z+.025*Math.sin(phi)])
 }
 path(g,points,.009,material,40)
}

/** Merge all static crown ornaments by shared PBR material.
 * This converts hundreds of child meshes into a small number of GPU draw
 * calls. Preserve independent surface materials, faceted normals and depth.
 */
function combineStaticGeometry(group:THREE.Group):THREE.Group{
 const groups=new Map<THREE.Material,THREE.BufferGeometry[]>()
 const oldMeshes:THREE.Mesh[]=[]
 group.updateMatrixWorld(true)
 group.traverse(item=>{
  if(!(item instanceof THREE.Mesh))return
  const mats=Array.isArray(item.material)?item.material:[item.material]
  if(mats.length!==1)return
  const material=mats[0] as THREE.Material
  let geo=item.geometry.index?item.geometry.toNonIndexed():item.geometry.clone()
  for(const key of Object.keys(geo.attributes)){
   if(key!=='position'&&key!=='normal')geo.deleteAttribute(key)
  }
  if(!geo.getAttribute('normal'))geo.computeVertexNormals()
  geo.applyMatrix4(item.matrixWorld)
  const entries=groups.get(material)||[]
  entries.push(geo);groups.set(material,entries)
  oldMeshes.push(item)
 })
 for(const item of oldMeshes){
  item.parent?.remove(item)
  item.geometry.dispose()
 }
 for(const [material,list] of groups){
  const merged=mergeGeometries(list,false)
  list.forEach(geo=>geo.dispose())
  if(!merged)throw new Error('crown_batch_failed')
  // Weld equal vertices after batching to reduce GLB and GPU memory.
  const welded=mergeVertices(merged,1e-5)
  merged.dispose()
  const batch=new THREE.Mesh(welded,material)
  batch.frustumCulled=false
  group.add(batch)
 }
 group.userData.batchCount=groups.size
 delete group.userData.settingMetal
 delete group.userData.gemMaterials
 return group
}

function coutureCrown():THREE.Group{
 // Three-dimensional, open-filigree royal tiara designed for the user's
 // gemstone crown reference, rather than an emoji or a flat sprite.
 const g=new THREE.Group()
 g.name='SpakTokRoyalCoutureCrown'
 g.userData.settingMetal=metal(0xd99069,.17)
 g.userData.gemMaterials=new Map<number,THREE.Material>()
 const roseGold=metal(0xe6a17c,.18)
 const platinum=metal(0xc7c8e1,.19)
 const fineGold=metal(0xf6d1a3,.14)
 const darkMetal=metal(0x794c51,.24)
 // Light curved frame fitting the skull, NOT a solid opaque cylinder.
 for(const y of [-.59,-.55,-.51]){
  const curve:number[][]=[]
  for(let i=0;i<=48;i++){
   const x=(i/48-.5)*.99
   const back=.045-.20*Math.pow(Math.abs(x)/.50,2)
   curve.push([x,y-.025*Math.cos(x*2),back])
  }
  path(g,curve,y===-.55?.017:.009,y===-.55?roseGold:fineGold,48)
 }
 // Gracefully arched, symmetric support structures with miniature scrolls.
 for(const flip of [-1,1]){
  for(let tier=0;tier<3;tier++){
   const x=flip*(.17+tier*.125)
   const crestY=-.80+tier*.068
   path(g,[
     [flip*.045,-.53,.11],
     [flip*(.11+tier*.025),-.68,.12],
     [x,crestY,.13],
     [x+flip*.08,crestY-.06,.075],
     [x+flip*.12,crestY+.04,.075],
     [x+flip*.02,-.57,.12],
   ],tier===0?.014:.010,roseGold,34)
   spiral(g,x+flip*.047,crestY+.025,.11,.072-tier*0,platinum,flip)
  }
  // Upper tall arches, raised beyond the crown's central stone.
  path(g,[[flip*.02,-.62,.11],[flip*.10,-.92,.08],
    [flip*.20,-1.10,.04],[flip*.28,-.90,.05],
    [flip*.43,-.73,.08],[flip*.49,-.55,.05]],.012,roseGold,46)
  path(g,[[flip*.045,-.57,.14],[flip*.18,-.78,.11],
    [flip*.29,-.88,.08],[flip*.38,-.68,.1]],.008,fineGold,28)
  jewelSetting(g,flip*.27,-.89,.13,.035,.063,0x77cbff)
  jewelSetting(g,flip*.40,-.73,.145,.031,.048,0xf2b2ef)
 }
 // Detailed central gold framework and raised central marquise crystal.
 path(g,[[-.16,-.56,.14],[-.20,-.88,.13],[-.10,-1.13,.08],
  [0,-1.19,.08],[.10,-1.13,.08],[.20,-.88,.13],[.16,-.56,.14]],.013,roseGold,65)
 for(const side of [-1,1]){
  path(g,[[0,-.55,.15],[side*.10,-.68,.14],
    [side*.16,-.82,.15],[side*.08,-.99,.12],[0,-1.02,.12]],.007,platinum,32)
  spiral(g,side*.25,-.69,.12,.079,roseGold,side)
 }
 jewelSetting(g,0,-.92,.23,.135,.232,0xe276ed)
 jewelSetting(g,0,-1.22,.12,.039,.064,0x76c9ff)
 jewelSetting(g,-.115,-1.17,.14,.027,.040,0xfbbae9)
 jewelSetting(g,.115,-1.17,.14,.027,.040,0xf3ccff)
 // Alternating rubies and sapphires along the full head-fitting band.
 for(let i=-10;i<=10;i++){
  const x=i*.047
  const z=.11-.11*Math.pow(Math.abs(x)/.55,2)
  if(Math.abs(i)<=2){continue}
  const color=i%3===0?0x54c8ff:i%3===1?0xe972bd:0xb9d7ff
  jewelSetting(g,x,-.56-.008*Math.cos(i*.6),z+.025,
    .016+(i%2===0?.004:0),.025,color)
 }
 // Micro-diamonds in a real arc following each ornament flourish.
 const gemColors=[0xe5d8ff,0x8bdcfe,0xff8ecf,0xffe7af]
 for(const side of [-1,1])for(let k=0;k<11;k++){
  const t=k/10
  const x=side*(.12+.31*t)
  const y=-.78+.18*t+.025*Math.sin(t*3.1)
  const z=.15-.08*t
  jewelSetting(g,x,y,z,.009,.014,gemColors[(k+(side===-1?1:0))%4])
 }
 // Reflection glints must remain restrained: actual geometry catches PBR light.
 for(const x of [-.48,-.36,-.19,.19,.36,.48]){
  const spec=mesh(g,new THREE.SphereGeometry(.014,10,8),fineGold,x,-.57,.18)
  spec.scale.set(.9,1.5,.7)
 }
 return combineStaticGeometry(g)
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
