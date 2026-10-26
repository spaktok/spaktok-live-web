#!/usr/bin/env node
/**
 * Reproducible SpakTok Couture Crown GLB builder. No remote assets, no Python
 * or third-party model licensing. Runs only at build time, not per request.
 * Crown origin: top-of-forehead base y=-0.55; tip y=-1.2, front positive Z.
 */
import * as THREE from 'three'
import {GLTFExporter} from 'three/addons/exporters/GLTFExporter.js'
import {mergeGeometries,mergeVertices} from 'three/addons/utils/BufferGeometryUtils.js'
import {mkdir,writeFile} from 'node:fs/promises'
import {dirname,resolve} from 'node:path'

if(typeof globalThis.FileReader==='undefined'){
 globalThis.FileReader=class {
  result=null
  onload=null
  onloadend=null
  onerror=null
  async readAsArrayBuffer(blob){
   try{this.result=await blob.arrayBuffer();this.onload?.({target:this});this.onloadend?.({target:this})}
   catch(e){this.onerror?.(e);throw e}
  }
  async readAsDataURL(blob){
   try{this.result='data:'+(blob.type||'application/octet-stream')+';base64,'+
    Buffer.from(await blob.arrayBuffer()).toString('base64');this.onload?.({target:this});this.onloadend?.({target:this})}
   catch(e){this.onerror?.(e);throw e}
  }
 }
}
const material=(color,metalness=.9,roughness=.17)=>new THREE.MeshPhysicalMaterial({
 color,metalness,roughness,clearcoat:.48,clearcoatRoughness:.12,side:THREE.DoubleSide
})
const materials={
 rose:material(0xe2a08a,.94,.18),champagne:material(0xf6cd91,.93,.14),
 silver:material(0xbacfe5,.91,.19),dark:material(0x8f5951,.92,.28),
 diamond:material(0xe6f9ff,.12,.075),pink:material(0xe66ae6,.09,.069),
 blue:material(0x48afff,.08,.067),violet:material(0xa56af9,.07,.072),
 cyan:material(0x60f6f5,.07,.07),amber:material(0xffc16b,.08,.085)
}
// IMPORTANT: the live camera is a separate HTML video element BEHIND the
// transparent WebGL overlay. MeshPhysicalMaterial.transmission samples only
// the WebGL scene and cannot refract the DOM video, washing gemstones gray.
// Keep gems physically faceted but opaque until camera-video texture and
// ray-refraction are rendered in ONE shared GPU scene.
for(const key of ['diamond','pink','blue','violet','cyan','amber']){
 const gem=materials[key]
 Object.assign(gem,{transmission:0,ior:1.75,thickness:0,iridescence:.12,
  clearcoat:1,clearcoatRoughness:.035,roughness:.075,metalness:.025})
 gem.emissive.copy(gem.color).multiplyScalar(key==='diamond'?.035:.075)
 gem.emissiveIntensity=.25
}
const batches=new Map()
for(const material of Object.values(materials))batches.set(material,[])
const v=(x,y,z)=>new THREE.Vector3(x,y,z)
function add(geo,mat,pos,scale){
 if(pos)geo.translate(...pos)
 if(scale)geo.scale(...scale)
 let g=geo.index?geo.toNonIndexed():geo
 if(g!==geo)geo.dispose()
 if(!g.getAttribute('normal'))g.computeVertexNormals()
 for(const attribute of Object.keys(g.attributes))if(!['position','normal'].includes(attribute))g.deleteAttribute(attribute)
 batches.get(materials[mat]).push(g)
}
function wire(points,radius,mat,steps=55){
 const curve=new THREE.CatmullRomCurve3(points.map(p=>v(...p)),false,'catmullrom',.55)
 add(new THREE.TubeGeometry(curve,steps,radius,7,false),mat)
}
function spiral(cx,cy,cz,r,side,mat='champagne'){
 const points=[]
 for(let i=0;i<=42;i++){
  const t=i/42,a=t*Math.PI*3.6+.4,rr=r*(1-.88*t)
  points.push([cx+side*rr*Math.cos(a),cy+rr*Math.sin(a),cz+.02*Math.sin(a)])
 }
 wire(points,.007,mat,45)
}
function ring(x,y,z,rx,ry,r,mat='rose'){
 const pts=[]
 for(let i=0;i<=50;i++){
  const a=i/50*Math.PI*2
  pts.push([x+rx*Math.cos(a),y+ry*Math.sin(a),z])
 }
 wire(pts,r,mat,50)
}
function jewel(x,y,z,w,h,mat='pink',sides=14){
 const vert=[],indices=[]
 function tri(a,b,c){const start=vert.length/3;vert.push(...a,...b,...c);indices.push(start,start+1,start+2)}
 const rim=[]
 for(let i=0;i<sides;i++){
  const a=i*Math.PI*2/sides
  rim.push([x+w*Math.sin(a)*(i<sides/2?.78:1),y+h*Math.cos(a),z])
 }
 const table=rim.map(p=>[x+(p[0]-x)*.59,y+(p[1]-y)*.59,z+.056])
 for(let i=0;i<sides;i++){
  const j=(i+1)%sides
  tri(rim[i],rim[j],table[j]);tri(rim[i],table[j],table[i])
  tri(table[i],table[j],[x,y,z+.095])
  tri(rim[j],rim[i],[x,y,z-.065])
 }
 const geo=new THREE.BufferGeometry()
 geo.setAttribute('position',new THREE.Float32BufferAttribute(vert,3))
 geo.setIndex(indices);geo.computeVertexNormals()
 add(geo,mat)
 ring(x,y,z,w*1.08,h*1.08,w>.04?.008:.004)
 if(w>.025)for(const side of [-1,1])for(const upper of [-1,1]){
  add(new THREE.IcosahedronGeometry(w>.05?.011:.008,0),'champagne',
      [x+side*w*.72,y+upper*h*.64,z+.058])
 }
}

/** Discrete jewel faces use distinct dyed-crystal materials. Because each
 * prism facet has its OWN vertices and normal, the gold crown has obvious
 * multi-hue depth even without transmissive access to the HTML camera video. */
function prismaticCenterStone(x,y,z,w,h,sides=24){
 const rim=[],table=[]
 const spectrum=['violet','pink','cyan','blue','violet','amber','pink','diamond']
 for(let i=0;i<sides;i++){
  const a=i/sides*2*Math.PI
  const radius=Math.sin(a)>0?1:.78
  rim.push([x+w*Math.sin(a)*radius,y+h*Math.cos(a),z])
  table.push([x+w*.62*Math.sin(a)*radius,y+h*.62*Math.cos(a),z+.085])
 }
 function face(vertices,mat){
  const geometry=new THREE.BufferGeometry()
  geometry.setAttribute('position',new THREE.Float32BufferAttribute(vertices.flat(),3))
  geometry.computeVertexNormals()
  add(geometry,mat)
 }
 for(let i=0;i<sides;i++){
  const j=(i+1)%sides
  const k=spectrum[(i+Math.floor(i/3))%spectrum.length]
  face([rim[i],rim[j],table[j]],k)
  face([rim[i],table[j],table[i]],spectrum[(i+3)%spectrum.length])
  face([table[i],table[j],[x,y,z+.16]],spectrum[(i+5)%spectrum.length])
  face([rim[j],rim[i],[x,y,z-.095]],'violet')
 }
 ring(x,y,z,w*1.08,h*1.08,.013,'rose')
 ring(x,y,z+.075,w*.69,h*.69,.006,'champagne')
 for(const side of [-1,1])for(const upper of [-1,1]){
  add(new THREE.IcosahedronGeometry(.012,1),'champagne',
      [x+side*w*.77,y+upper*h*.66,z+.065])
 }
}

for(const [y,r,m] of [[-.52,.012,'champagne'],[-.55,.02,'rose'],[-.59,.011,'silver']]){
 const points=[]
 for(let k=0;k<=72;k++){
  const x=(k/72-.5)*1.08,z=.08-.29*Math.pow(Math.abs(x)/.54,2)
  points.push([x,y-.018*(1-(x/.54)**2),z])
 }
 wire(points,r,m,70)
}
for(const side of [-1,1]){
 for(let tier=0;tier<3;tier++){
  const x=side*(.12+tier*.13),tip=-.82+tier*.062
  wire([[side*.045,-.54,.13],[side*(.12+tier*.027),-.70,.14],[x,tip,.14],
    [x+side*.073,tip-.08,.085],[x+side*.115,tip+.045,.085],[x+side*.02,-.55,.12]],
    tier===0?.012:.009,'rose')
  spiral(x+side*.05,tip+.02,.143,.08,side)
 }
 wire([[side*.02,-.62,.13],[side*.09,-.91,.11],[side*.20,-1.10,.07],
  [side*.275,-.93,.08],[side*.43,-.73,.11],[side*.49,-.55,.07]],.012,'rose',75)
 wire([[side*.04,-.56,.14],[side*.18,-.77,.16],[side*.29,-.87,.13],[side*.38,-.68,.135]],.008,'silver')
 spiral(side*.23,-.69,.145,.087,side)
 jewel(side*.27,-.91,.17,.037,.065,'blue')
 jewel(side*.40,-.75,.17,.032,.052,'pink')
}
wire([[-.18,-.56,.15],[-.22,-.85,.16],[-.10,-1.13,.1],[0,-1.20,.11],
 [.1,-1.13,.1],[.22,-.85,.16],[.18,-.56,.15]],.014,'rose',88)
for(const side of [-1,1]){
 wire([[0,-.56,.16],[side*.12,-.7,.16],[side*.17,-.84,.18],
 [side*.09,-.99,.14],[0,-1.02,.15]],.009,'silver',56)
}
ring(0,-.91,.24,.147,.236,.025,'dark')
ring(0,-.91,.28,.137,.23,.012,'champagne')
prismaticCenterStone(0,-.92,.32,.136,.214,24)
jewel(0,-1.22,.20,.039,.065,'blue')
jewel(-.116,-1.16,.19,.027,.043,'diamond')
jewel(.116,-1.16,.19,.027,.043,'diamond')
const palette=['blue','pink','diamond','cyan','amber']
for(let k=-10;k<=10;k++){
 if(Math.abs(k)<3)continue
 const x=k*.048,z=.14-.17*Math.pow(Math.abs(x)/.55,2)
 jewel(x,-.55-.006*Math.cos(k*.6),z+.045,.014,.021,palette[Math.abs(k)%5],10)
}
for(const side of [-1,1]){
 for(let k=0;k<13;k++){
  const t=k/12
  jewel(side*(.12+.34*t),-.79+.2*t+.027*Math.sin(t*3.1),
    .17-.08*t,.008,.014,['diamond','blue','pink','amber'][k%4],10)
 }
 for(let k=0;k<8;k++)jewel(side*(.10+k*.051),
  -.61-.035*Math.sin(k*.5),.165,.008,.01,'diamond',8)
}
const group=new THREE.Group()
group.name='SpakTokRoyalCoutureCrown'
let triangles=0
for(const [material,items] of batches){
 if(!items.length)continue
 const merged=mergeGeometries(items,false)
 if(!merged)throw Error('incompatible_face_asset_geometries')
 triangles+=merged.getAttribute('position').count/3
 items.forEach(item=>item.dispose())
 // Reuse shared curve vertices in glTF instead of duplicating each triangle.
 const indexed=mergeVertices(merged,1e-5)
 merged.dispose()
 const mesh=new THREE.Mesh(indexed,material)
 mesh.name='Couture_'+material.color.getHexString()
 mesh.frustumCulled=false
 group.add(mesh)
}
if(triangles<10000)throw Error('Asset too simple to publish')
const binary=await new GLTFExporter().parseAsync(group,{binary:true,onlyVisible:true})
const target=resolve('public/face-assets/spaktok-royal-couture.glb')
await mkdir(dirname(target),{recursive:true})
await writeFile(target,Buffer.from(binary))
console.log('SpakTok Crown GLB',Buffer.byteLength(binary),'bytes',Math.round(triangles),'triangles',group.children.length,'drawcalls',target)
